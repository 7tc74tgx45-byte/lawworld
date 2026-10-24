// Progress, gating, gaps and stats (T03). Pure JS: no Phaser, no DOM, no storage.
//
// All functions are immutable: they take a progress object and return a new one.
// The progress object is plain JSON so the save system (T04) can store it as-is:
//   {
//     subsections: { [id]: { status:'explored'|'consolidated', attempts, lastPlayed, lastOutcome } },
//     gaps:  [{ subsectionId, concept, stage, firstSeen, lastSeen, timesMissed, resolved }],
//     stats: { caseRecall, statutoryInterpretation, application, iracFluency }   // points
//   }
// Only `explored` and `consolidated` are stored. `locked` and `available` are derived from
// prerequisites, so changing the curriculum (new vault notes) never corrupts a save.
//
// Learning rules enforced here (VISION §1):
//  - Only an evaluated encounter result moves a subsection. Consolidation is recomputed from
//    the stage verdicts with computeOutcome(); a result that merely *claims* "consolidated" is not trusted.
//  - Opening and leaving without answering anything changes nothing.
//  - `explored` never unlocks anything: only `consolidated` prerequisites do.
//  - Consolidated is never downgraded by a later weaker attempt.

import { flattenSubsections, subsectionIndex } from './curriculum.js';
import { computeOutcome } from './encounter.js';

export const STATES = ['locked', 'available', 'explored', 'consolidated'];
export const STAT_KEYS = ['caseRecall', 'statutoryInterpretation', 'application', 'iracFluency'];
export const STAT_LABELS = {
  caseRecall: 'Case Recall',
  statutoryInterpretation: 'Statutory Interpretation',
  application: 'Application',
  iracFluency: 'IRAC Fluency',
};
/** Points a verdict is worth on a stat. Trying earns a little; precision earns more. */
export const VERDICT_POINTS = { missing: 0, partial: 1, solid: 3 };

export function createProgress() {
  return {
    subsections: {},
    gaps: [],
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
  };
}

/** Fill in anything missing from a loaded object, without throwing. */
export function normaliseProgress(p) {
  const base = createProgress();
  if (!p || typeof p !== 'object') return base;
  return {
    subsections: p.subsections && typeof p.subsections === 'object' ? { ...p.subsections } : base.subsections,
    gaps: Array.isArray(p.gaps) ? p.gaps.map((g) => ({ ...g })) : base.gaps,
    stats: { ...base.stats, ...(p.stats && typeof p.stats === 'object' ? p.stats : {}) },
  };
}

const iso = (now) => (now === undefined ? new Date() : new Date(now)).toISOString();
export const conceptKey = (c) => String(c ?? '').trim().toLowerCase();

// ---------------------------------------------------------------------------
// Gating
// ---------------------------------------------------------------------------

function indexOf(curriculumOrIndex) {
  return curriculumOrIndex instanceof Map ? curriculumOrIndex : subsectionIndex(curriculumOrIndex);
}

const storedStatus = (progress, id) => progress.subsections?.[id]?.status ?? null;

/** Direct prerequisites that have not been at least *explored* yet (what the padlock lists).
 * explored is enough to unlock the next building; consolidated remains the quality goal
 * and is flagged visually on buildings that need revisiting.
 */
export function unmetPrerequisites(curriculumOrIndex, progress, id) {
  const sub = indexOf(curriculumOrIndex).get(id);
  if (!sub) return [];
  const unlocked = new Set(['explored', 'consolidated']);
  return sub.prerequisites.filter((p) => !unlocked.has(storedStatus(progress, p)));
}

/** locked | available | explored | consolidated. Unknown ids are 'locked'. */
export function subsectionState(curriculumOrIndex, progress, id) {
  const index = indexOf(curriculumOrIndex);
  if (!index.has(id)) return 'locked';
  const stored = storedStatus(progress, id);
  if (stored === 'consolidated' || stored === 'explored') return stored;
  return unmetPrerequisites(index, progress, id).length ? 'locked' : 'available';
}

/** { [id]: state } for every subsection in the curriculum. */
export function computeStates(curriculum, progress) {
  const index = subsectionIndex(curriculum);
  const out = {};
  for (const id of index.keys()) out[id] = subsectionState(index, progress, id);
  return out;
}

/** Every transitive prerequisite of `id` (not including `id`). */
export function prerequisiteClosure(curriculumOrIndex, id) {
  const index = indexOf(curriculumOrIndex);
  const seen = new Set();
  const walk = (x) => {
    for (const p of index.get(x)?.prerequisites ?? []) {
      if (!seen.has(p)) {
        seen.add(p);
        walk(p);
      }
    }
  };
  walk(id);
  return [...seen];
}

// ---------------------------------------------------------------------------
// Rollups
// ---------------------------------------------------------------------------

function tally(ids, states) {
  const counts = { locked: 0, available: 0, explored: 0, consolidated: 0 };
  for (const id of ids) counts[states[id] ?? 'locked']++;
  return counts;
}

function rollupFromCounts(counts) {
  const total = STATES.reduce((n, s) => n + counts[s], 0);
  let status;
  if (total === 0) status = 'empty';
  else if (counts.consolidated === total) status = 'consolidated'; // hearth/brazier lights
  else if (counts.explored + counts.consolidated > 0) status = 'in-progress';
  else if (counts.locked === total) status = 'locked';
  else status = 'available';
  return { total, counts, status, fraction: total ? counts.consolidated / total : 0 };
}

/** A district is consolidated only when *all* its subsections are. */
export function districtRollup(district, states) {
  return rollupFromCounts(tally(district.subsections.map((s) => s.id), states));
}

export function regionRollup(region, states) {
  return rollupFromCounts(tally(region.districts.flatMap((d) => d.subsections.map((s) => s.id)), states));
}

export function isBrazierLit(district, states) {
  return districtRollup(district, states).status === 'consolidated';
}

/** { states, districts:{[id]}, regions:{[id]}, modules:{[id]} } in one pass. */
export function computeRollups(curriculum, progress) {
  const states = computeStates(curriculum, progress);
  const districts = {};
  const regions = {};
  const modules = {};
  for (const m of curriculum.modules) {
    const mIds = [];
    for (const r of m.regions) {
      regions[r.id] = regionRollup(r, states);
      for (const d of r.districts) {
        districts[d.id] = districtRollup(d, states);
        d.subsections.forEach((s) => mIds.push(s.id));
      }
    }
    modules[m.id] = rollupFromCounts(tally(mIds, states));
  }
  return { states, districts, regions, modules };
}

// ---------------------------------------------------------------------------
// Gap log
// ---------------------------------------------------------------------------

const sameGap = (g, subsectionId, concept) => g.subsectionId === subsectionId && conceptKey(g.concept) === conceptKey(concept);

/** Log a missed/partial concept. Re-missing a resolved gap re-opens it. */
export function logGap(progress, { subsectionId, concept, stage }, now) {
  if (!subsectionId || !conceptKey(concept)) return progress;
  const t = iso(now);
  const found = progress.gaps.some((g) => sameGap(g, subsectionId, concept));
  const gaps = found
    ? progress.gaps.map((g) =>
        sameGap(g, subsectionId, concept)
          ? { ...g, stage: stage ?? g.stage, lastSeen: t, timesMissed: g.timesMissed + 1, resolved: false }
          : g
      )
    : [...progress.gaps, { subsectionId, concept: String(concept).trim(), stage: stage ?? null, firstSeen: t, lastSeen: t, timesMissed: 1, resolved: false }];
  return { ...progress, gaps };
}

/** Mark open gaps for these concepts (in this subsection) resolved. */
export function resolveGaps(progress, subsectionId, concepts, now) {
  const keys = new Set((concepts ?? []).map(conceptKey));
  if (!keys.size) return progress;
  const t = iso(now);
  let changed = false;
  const gaps = progress.gaps.map((g) => {
    if (g.subsectionId === subsectionId && !g.resolved && keys.has(conceptKey(g.concept))) {
      changed = true;
      return { ...g, resolved: true, lastSeen: t };
    }
    return g;
  });
  return changed ? { ...progress, gaps } : progress;
}

/**
 * A later retrieval answer on a concept (garden watering, client advice, next encounter).
 * Solid resolves an open gap; anything weaker logs/re-opens it. Solid on a concept that was
 * never a gap changes nothing.
 */
export function recordRetrieval(progress, { subsectionId, concept, verdict, stage }, now) {
  if (verdict === 'solid') return resolveGaps(progress, subsectionId, [concept], now);
  return logGap(progress, { subsectionId, concept, stage }, now);
}

/** Open gaps, optionally filtered; most-missed first, then least recently seen. */
export function openGaps(progress, { subsectionId, subsectionIds } = {}) {
  const ids = subsectionIds ? new Set(subsectionIds) : null;
  return progress.gaps
    .filter((g) => !g.resolved && (!subsectionId || g.subsectionId === subsectionId) && (!ids || ids.has(g.subsectionId)))
    .sort((a, b) => b.timesMissed - a.timesMissed || String(a.lastSeen).localeCompare(String(b.lastSeen)));
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** level L needs 5*L*(L+1)/2 points: 5, 15, 30, 50 ... */
export function statLevel(points) {
  let level = 0;
  while ((5 * (level + 1) * (level + 2)) / 2 <= points) level++;
  const floor = (5 * level * (level + 1)) / 2;
  const next = (5 * (level + 1) * (level + 2)) / 2;
  return { level, points, intoLevel: points - floor, needed: next - floor, fraction: (points - floor) / (next - floor) };
}

export function awardStat(progress, key, points) {
  if (!STAT_KEYS.includes(key) || !(points > 0)) return progress;
  return { ...progress, stats: { ...progress.stats, [key]: progress.stats[key] + points } };
}

const answeredStage = (result, n) => {
  const s = result.stages?.[n];
  return s && s.answered && s.verdict ? s : null;
};

/**
 * Stat gains an evaluated encounter earns (pure; does not apply them).
 *  - caseRecall:              authority stage (4) verdict
 *  - statutoryInterpretation: precision stage (3) verdict, only when the subsection has statutes
 *  - application:             scenario stage (5) verdict
 *  - iracFluency:             IRAC structure score (0-4) from the scenario stage
 * Stages the player did not answer earn nothing, and "I'm not sure" (verdict missing) earns 0.
 */
export function statGainsFromResult(result, subsection) {
  const gains = { caseRecall: 0, statutoryInterpretation: 0, application: 0, iracFluency: 0 };
  const s3 = answeredStage(result, 3);
  const s4 = answeredStage(result, 4);
  const s5 = answeredStage(result, 5);
  if (s4) gains.caseRecall = VERDICT_POINTS[s4.verdict] ?? 0;
  if (s3 && subsection?.statutes?.length) gains.statutoryInterpretation = VERDICT_POINTS[s3.verdict] ?? 0;
  if (s5) gains.application = VERDICT_POINTS[s5.verdict] ?? 0;
  const irac = [2, 3, 4, 5]
    .map((n) => result.stages?.[n]?.iracScore)
    .filter((x) => typeof x === 'number');
  if (irac.length) gains.iracFluency = Math.max(0, Math.min(4, Math.round(Math.max(...irac))));
  return gains;
}

// ---------------------------------------------------------------------------
// Applying an encounter result
// ---------------------------------------------------------------------------

const hasEngagement = (result) =>
  (result.exchanges ?? 0) > 0 || [2, 3, 4, 5].some((n) => result.stages?.[n]?.answered);

/**
 * Fold an encounter result (from enc.result() / enc.leave()) into progress.
 * @param {object} progress
 * @param {object} result   encounter result
 * @param {{ subsection?: object, now?: number|string|Date }} opts
 */
export function applyEncounterResult(progress, result, { subsection, now } = {}) {
  if (!result?.subsectionId || !hasEngagement(result)) return progress;
  const t = iso(now);
  const id = result.subsectionId;

  // The gatekeeper is the evaluation, not the claimed outcome.
  const outcome = result.finished && result.stages && result.checkpoint
    ? computeOutcome({ stages: result.stages, checkpoint: result.checkpoint })
    : 'explored';

  const prev = progress.subsections[id];
  const status = prev?.status === 'consolidated' || outcome === 'consolidated' ? 'consolidated' : 'explored';
  let next = {
    ...progress,
    subsections: {
      ...progress.subsections,
      [id]: { status, attempts: (prev?.attempts ?? 0) + 1, lastPlayed: t, lastOutcome: outcome },
    },
  };

  // Gaps: first resolve what was answered solidly now, then log what was missed.
  const solidConcepts = [2, 3, 4, 5].flatMap((n) => {
    const s = result.stages?.[n];
    return s?.answered && s.verdict === 'solid' ? s.conceptsHit ?? [] : [];
  });
  next = resolveGaps(next, id, [...solidConcepts, ...(result.checkpoint?.conceptsHit ?? [])], t);

  const seen = new Set();
  for (const g of result.gaps ?? []) {
    const key = conceptKey(g.concept);
    if (!key || seen.has(key)) continue; // a concept counts as missed once per encounter
    seen.add(key);
    next = logGap(next, { subsectionId: id, concept: g.concept, stage: g.stage }, t);
  }

  // Stats from the evaluated answers.
  const gains = statGainsFromResult(result, subsection);
  for (const k of STAT_KEYS) next = awardStat(next, k, gains[k]);
  return next;
}

/** Convenience for UI: all subsections of the curriculum that currently carry open gaps. */
export function subsectionsWithGaps(curriculum, progress) {
  const ids = new Set(openGaps(progress).map((g) => g.subsectionId));
  return flattenSubsections(curriculum).filter((s) => ids.has(s.id));
}
