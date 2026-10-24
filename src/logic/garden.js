// Knowledge garden (T13). Pure JS: seeds, plots, growth, withering and spaced-repetition target choice.
//
// Rules (VISION §4):
//  - Seeds come only from solid answers in an evaluated encounter (seedsFromResult).
//  - A seed is planted in a hub plot against a concept: an open gap first, otherwise a consolidated topic.
//  - Watering means answering a retrieval question on that concept. Only a solid answer grows the plant;
//    a partial answer keeps it alive; a missing answer does nothing. Nothing grows by clicking.
//  - A plant not watered for 3 in-game days withers. Watering a withered plant revives it (no growth).
//  - Retrieval targets: open gaps first (most missed), then consolidated subsections not seen for longest.

import { openGaps, recordRetrieval, conceptKey } from './progress.js';
import { flattenSubsections } from './curriculum.js';

// One in-game "study day" = 8 real hours, so a plant withers after 24 real hours unwatered. Spaced repetition only
// works on a human timescale: a 20-minute day would wither the whole garden between two evening sessions.
export const GAME_DAY_MS = 8 * 60 * 60 * 1000;
export const WITHER_DAYS = 3;
/** A plant watered less than this long ago is still damp: it cannot be watered again (no grinding one concept). */
export const DAMP_MS = 10 * 60 * 1000;
export const MAX_STAGE = 4; // 0 seed, 1 sprout, 2 sapling, 3 young tree, 4 tree
export const STAGE_NAMES = ['seed', 'sprout', 'sapling', 'young tree', 'tree'];
export const PLOT_COUNT_BASE = 12;   // plots available from the very first session
export const PLOTS_PER_UNLOCK = 4;   // additional plots per 2 consolidated subsections
export const PLOT_COUNT_MAX = 40;    // hard ceiling
export const plotIdFor = (i) => `plot-${i}`;

/** How many plots are active given the current save (scales with consolidations). */
export function activePlotCount(save) {
  const subs = save?.progress?.subsections ?? {};
  const consolidated = Object.values(subs).filter(s => s.status === 'consolidated').length;
  const bonus = Math.floor(consolidated / 2) * PLOTS_PER_UNLOCK;
  return Math.min(PLOT_COUNT_MAX, PLOT_COUNT_BASE + bonus);
}

const ms = (t) => (t === undefined ? Date.now() : new Date(t).getTime());
const iso = (t) => new Date(ms(t)).toISOString();

/** One seed per solid answered stage 2-5 (a first-time, evaluated, typed answer). Unanswered stages earn nothing. */
export function seedsFromResult(result) {
  if (!result?.stages) return 0;
  return [2, 3, 4, 5].filter((n) => result.stages[n]?.answered && result.stages[n].verdict === 'solid').length;
}

/** At most this many seeds per subsection per calendar day: replaying one building cannot farm seeds (QA finding). */
export const MAX_SEEDS_PER_SUBSECTION_PER_DAY = 4;

/** Seeds this result may actually pay, given the sessions already logged (each records the seeds it paid). */
export function seedsAllowed(result, sessions = [], now) {
  const day = iso(now).slice(0, 10);
  const already = (sessions ?? [])
    .filter((s) => s.subsectionId === result?.subsectionId && typeof s.date === 'string' && s.date.slice(0, 10) === day)
    .reduce((n, s) => n + (s.seeds ?? 0), 0);
  return Math.max(0, Math.min(seedsFromResult(result), MAX_SEEDS_PER_SUBSECTION_PER_DAY - already));
}

export const gardenOf = (save) => (Array.isArray(save?.garden?.plots) ? save.garden.plots : []);

/** 'withered' when unwatered for WITHER_DAYS in-game days, else 'growing' (or 'grown' at the top stage). */
export function plotStatus(plot, now) {
  const last = Date.parse(plot.lastWatered ?? plot.plantedAt ?? '');
  if (Number.isFinite(last) && ms(now) - last > WITHER_DAYS * GAME_DAY_MS) return 'withered';
  return plot.stage >= MAX_STAGE ? 'grown' : 'growing';
}

/** A plant unwatered for this many in-game days shows the "needs water" icon (it can be watered once not damp). */
export const THIRSTY_DAYS = 1;

/** True when the plant is overdue for water: withered, or unwatered for THIRSTY_DAYS, and not still damp. Empty plots never are. */
export function needsWater(plot, now) {
  if (!plot) return false;
  if (dampRemainingMs(plot, now) > 0) return false;
  return plotStatus(plot, now) === 'withered' || daysSinceWatered(plot, now) >= THIRSTY_DAYS;
}

/** Real milliseconds until a damp plant can be watered again (0 when it is thirsty, or withered). */
export function dampRemainingMs(plot, now) {
  if (plotStatus(plot, now) === 'withered') return 0;
  const last = Date.parse(plot.lastWatered ?? plot.plantedAt ?? '');
  if (!Number.isFinite(last)) return 0;
  return Math.max(0, DAMP_MS - (ms(now) - last));
}

/** In-game days left before the plant withers (0 once withered). */
export function daysUntilWither(plot, now) {
  return Math.max(0, WITHER_DAYS - daysSinceWatered(plot, now));
}

/** Days (fractional, in-game) since the plot was last watered. */
export function daysSinceWatered(plot, now) {
  const last = Date.parse(plot.lastWatered ?? plot.plantedAt ?? '');
  return Number.isFinite(last) ? Math.max(0, (ms(now) - last) / GAME_DAY_MS) : 0;
}

/** When the subsection was last studied or retrieved (ISO, '' if never). Older = more due. */
const seenAt = (progress, id) => {
  const s = progress.subsections?.[id] ?? {};
  return String([s.lastPlayed, s.lastReviewed].filter(Boolean).sort().pop() ?? '');
};

/**
 * What a plot needs next, in order of the spaced-repetition rule: open gaps first (most missed), then
 * consolidated subsections ordered by least recently played. Concepts already planted are skipped.
 * Returns [{ subsectionId, concept, kind: 'gap'|'consolidated' }].
 */
export function retrievalTargets(curriculum, progress, plots = []) {
  const taken = new Set(plots.map((p) => `${p.subsectionId}|${conceptKey(p.concept)}`));
  const out = [];
  for (const g of openGaps(progress)) {
    if (!taken.has(`${g.subsectionId}|${conceptKey(g.concept)}`)) out.push({ subsectionId: g.subsectionId, concept: g.concept, kind: 'gap' });
  }
  const consolidated = flattenSubsections(curriculum)
    .filter((s) => progress.subsections?.[s.id]?.status === 'consolidated')
    .sort((a, b) => seenAt(progress, a.id).localeCompare(seenAt(progress, b.id)));
  for (const s of consolidated) {
    const concept = (s.keyConcepts ?? []).find((c) => !taken.has(`${s.id}|${conceptKey(c)}`));
    if (concept) out.push({ subsectionId: s.id, concept, kind: 'consolidated' });
  }
  return out;
}

/** Plant a seed in an empty plot. Fails (save unchanged) without a seed, with a taken/invalid plot, or no concept. */
export function plantSeed(save, plotId, { subsectionId, concept }, now) {
  const plots = gardenOf(save);
  const n = Number(String(plotId).replace('plot-', ''));
  if (!Number.isInteger(n) || n < 0 || n >= PLOT_COUNT_MAX) return { ok: false, reason: 'no-such-plot', save };
  if (plots.some((p) => p.id === plotId)) return { ok: false, reason: 'plot-taken', save };
  if (!(save.inventory?.seeds > 0)) return { ok: false, reason: 'no-seed', save };
  if (!subsectionId || !conceptKey(concept)) return { ok: false, reason: 'no-concept', save };
  if (plots.some((p) => p.subsectionId === subsectionId && conceptKey(p.concept) === conceptKey(concept))) return { ok: false, reason: 'already-planted', save };
  const t = iso(now);
  const plot = { id: plotId, seedId: `seed-${t}`, subsectionId, concept: String(concept).trim(), stage: 0, plantedAt: t, lastWatered: t };
  return { ok: true, save: { ...save, inventory: { ...save.inventory, seeds: save.inventory.seeds - 1 }, garden: { plots: [...plots, plot] } } };
}

/**
 * Fold a retrieval answer into the save. verdict comes from the tutor's evaluation of a typed answer.
 * solid: +1 stage (revives a withered plant at the same stage), gap resolved. partial: watered, no growth, gap logged.
 * missing: nothing is watered and the gap is logged.
 */
export function waterPlot(save, plotId, verdict, now) {
  const plots = gardenOf(save);
  const plot = plots.find((p) => p.id === plotId);
  if (!plot) return { ok: false, reason: 'no-plant', save };
  if (!['solid', 'partial', 'missing'].includes(verdict)) return { ok: false, reason: 'bad-verdict', save };
  if (dampRemainingMs(plot, now) > 0) return { ok: false, reason: 'damp', save };
  const t = iso(now);
  const withered = plotStatus(plot, now) === 'withered';
  // Every attempt counts as a retrieval round (even a missed one) so the next question is of a different kind.
  const rounds = (plot.waterings ?? 0) + 1;
  let next = { ...plot, waterings: rounds };
  if (verdict === 'solid') next = { ...plot, waterings: rounds, lastWatered: t, stage: withered ? plot.stage : Math.min(MAX_STAGE, plot.stage + 1) };
  else if (verdict === 'partial') next = { ...plot, waterings: rounds, lastWatered: t };
  let progress = recordRetrieval(save.progress, { subsectionId: plot.subsectionId, concept: plot.concept, verdict, stage: null }, t);
  const sub = progress.subsections?.[plot.subsectionId];
  if (sub) progress = { ...progress, subsections: { ...progress.subsections, [plot.subsectionId]: { ...sub, lastReviewed: t } } };
  return {
    ok: true, grew: next.stage > plot.stage, revived: withered && verdict !== 'missing',
    save: { ...save, progress, garden: { plots: plots.map((p) => (p.id === plotId ? next : p)) } },
  };
}

/**
 * Braziers (VISION §4): a district's brazier lights when every subsection in it is consolidated, and then stays
 * lit for good (stored in save.braziers.lit), even if a later vault note adds a building to that district.
 * Returns { save, lit: Set<districtId>, newlyLit: [districtId] }; the save is returned unchanged when nothing is new.
 */
export function syncBraziers(save, districts, states) {
  const stored = new Set(save.braziers?.lit ?? []);
  const known = new Set(districts.map((d) => d.id));
  const earned = districts
    .filter((d) => d.subsections.length > 0 && d.subsections.every((s) => states[s.id] === 'consolidated'))
    .map((d) => d.id);
  const newlyLit = earned.filter((id) => !stored.has(id));
  const lit = new Set([...[...stored].filter((id) => known.has(id)), ...earned]);
  if (!newlyLit.length) return { save, lit, newlyLit };
  return { save: { ...save, braziers: { ...save.braziers, lit: [...stored, ...newlyLit] } }, lit, newlyLit };
}

/** Everything the garden scene draws: one entry per plot slot. */
export function gardenView(save, now) {
  const plots = gardenOf(save);
  return Array.from({ length: activePlotCount(save) }, (_, i) => {
    const plot = plots.find((p) => p.id === plotIdFor(i));
    if (!plot) return { id: plotIdFor(i), empty: true };
    return { ...plot, empty: false, status: plotStatus(plot, now), stageName: STAGE_NAMES[plot.stage] ?? 'tree', days: daysSinceWatered(plot, now), damp: dampRemainingMs(plot, now) > 0, thirsty: needsWater(plot, now) };
  });
}
