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

export const GAME_DAY_MS = 20 * 60 * 1000; // one in-game day = 20 real minutes of the save clock
export const WITHER_DAYS = 3;
export const MAX_STAGE = 4; // 0 seed, 1 sprout, 2 sapling, 3 young tree, 4 tree
export const STAGE_NAMES = ['seed', 'sprout', 'sapling', 'young tree', 'tree'];
export const PLOT_COUNT = 6;
export const plotIdFor = (i) => `plot-${i}`;

const ms = (t) => (t === undefined ? Date.now() : new Date(t).getTime());
const iso = (t) => new Date(ms(t)).toISOString();

/** One seed per solid answered stage 2-5 (a first-time, evaluated, typed answer). Unanswered stages earn nothing. */
export function seedsFromResult(result) {
  if (!result?.stages) return 0;
  return [2, 3, 4, 5].filter((n) => result.stages[n]?.answered && result.stages[n].verdict === 'solid').length;
}

export const gardenOf = (save) => (Array.isArray(save?.garden?.plots) ? save.garden.plots : []);

/** 'withered' when unwatered for WITHER_DAYS in-game days, else 'growing' (or 'grown' at the top stage). */
export function plotStatus(plot, now) {
  const last = Date.parse(plot.lastWatered ?? plot.plantedAt ?? '');
  if (Number.isFinite(last) && ms(now) - last > WITHER_DAYS * GAME_DAY_MS) return 'withered';
  return plot.stage >= MAX_STAGE ? 'grown' : 'growing';
}

/** Days (fractional, in-game) since the plot was last watered. */
export function daysSinceWatered(plot, now) {
  const last = Date.parse(plot.lastWatered ?? plot.plantedAt ?? '');
  return Number.isFinite(last) ? Math.max(0, (ms(now) - last) / GAME_DAY_MS) : 0;
}

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
    .sort((a, b) => String(progress.subsections[a.id].lastPlayed ?? '').localeCompare(String(progress.subsections[b.id].lastPlayed ?? '')));
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
  if (!Number.isInteger(n) || n < 0 || n >= PLOT_COUNT) return { ok: false, reason: 'no-such-plot', save };
  if (plots.some((p) => p.id === plotId)) return { ok: false, reason: 'plot-taken', save };
  if (!(save.inventory?.seeds > 0)) return { ok: false, reason: 'no-seed', save };
  if (!subsectionId || !conceptKey(concept)) return { ok: false, reason: 'no-concept', save };
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
  const t = iso(now);
  const withered = plotStatus(plot, now) === 'withered';
  let next = plot;
  if (verdict === 'solid') next = { ...plot, lastWatered: t, stage: withered ? plot.stage : Math.min(MAX_STAGE, plot.stage + 1) };
  else if (verdict === 'partial') next = { ...plot, lastWatered: t };
  const progress = recordRetrieval(save.progress, { subsectionId: plot.subsectionId, concept: plot.concept, verdict, stage: null }, t);
  return {
    ok: true, grew: next.stage > plot.stage, revived: withered && verdict !== 'missing',
    save: { ...save, progress, garden: { plots: plots.map((p) => (p.id === plotId ? next : p)) } },
  };
}

/** Everything the garden scene draws: one entry per plot slot. */
export function gardenView(save, now) {
  const plots = gardenOf(save);
  return Array.from({ length: PLOT_COUNT }, (_, i) => {
    const plot = plots.find((p) => p.id === plotIdFor(i));
    if (!plot) return { id: plotIdFor(i), empty: true };
    return { ...plot, empty: false, status: plotStatus(plot, now), stageName: STAGE_NAMES[plot.stage] ?? 'tree', days: daysSinceWatered(plot, now) };
  });
}
