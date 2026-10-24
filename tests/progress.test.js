import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curriculum } from '../src/data/curriculum.js';
import { makeDistrict, subsectionIndex } from '../src/logic/curriculum.js';
import { createEncounter } from '../src/logic/encounter.js';
import { createOfflineTutor } from '../src/api/offlineTutor.js';
import { demoSubsection } from '../src/data/demoSubsection.js';
import {
  createProgress, normaliseProgress, subsectionState, computeStates, unmetPrerequisites, prerequisiteClosure,
  computeRollups, districtRollup, isBrazierLit, applyEncounterResult, logGap, resolveGaps, recordRetrieval,
  openGaps, statGainsFromResult, statLevel, awardStat,
} from '../src/logic/progress.js';

const index = subsectionIndex(curriculum);
const T = (n) => `2026-10-24T01:0${n}:00.000Z`;

// --- helpers -------------------------------------------------------------

/** Progress with the given ids stored as consolidated / explored. */
function withStatus(ids, status, base = createProgress()) {
  const subsections = { ...base.subsections };
  for (const id of ids) subsections[id] = { status, attempts: 1 };
  return { ...base, subsections };
}

/** A hand-built encounter result (the shape enc.result() returns). */
function fakeResult(id, { verdicts = {}, irac = {}, hit = {}, mcq = 3, mcqHit = [], gaps = [], finished = true, exchanges = 10 } = {}) {
  const stages = {};
  for (const n of [2, 3, 4, 5]) {
    const v = n in verdicts ? verdicts[n] : 'solid';
    stages[n] = { answered: v !== null, verdict: v, iracScore: irac[n] ?? null, conceptsHit: hit[n] ?? [] };
  }
  return { subsectionId: id, finished, exchanges, stages, checkpoint: { correct: mcq, total: 3, answered: 3, conceptsHit: mcqHit }, gaps };
}

// A tiny curriculum so the gating tests do not depend on vault data.
const mini = {
  modules: [{ id: 'm', regions: [{ id: 'r', districts: [
    makeDistrict({ id: 'duty', title: 'Duty', sourceFile: 'a.md', subs: [['d', 'Duty of Care', 'D', ['c1'], [], []]] }),
    makeDistrict({ id: 'breach', title: 'Breach', sourceFile: 'b.md', after: ['duty.d'], subs: [['b', 'Breach', 'B', [], [], []]] }),
    makeDistrict({ id: 'caus', title: 'Causation', sourceFile: 'c.md', after: ['duty.d', 'breach.b'], subs: [['c1', 'Causation', 'C', [], [], []], ['c2', 'Remoteness', 'R', [], [], []]] }),
  ] }] }],
};

// --- gating --------------------------------------------------------------

test('fresh game: entry subsections available, dependants locked', () => {
  const p = createProgress();
  assert.equal(subsectionState(mini, p, 'duty.d'), 'available');
  assert.equal(subsectionState(mini, p, 'breach.b'), 'locked');
  assert.equal(subsectionState(mini, p, 'caus.c1'), 'locked');
  assert.equal(subsectionState(mini, p, 'does-not-exist'), 'locked');
});

test('Causation stays locked until Duty of Care and Breach are consolidated (mini)', () => {
  let p = withStatus(['duty.d'], 'consolidated');
  assert.equal(subsectionState(mini, p, 'breach.b'), 'available');
  assert.equal(subsectionState(mini, p, 'caus.c1'), 'locked', 'Duty alone is not enough');
  assert.deepEqual(unmetPrerequisites(mini, p, 'caus.c1'), ['breach.b']);
  p = withStatus(['breach.b'], 'consolidated', p);
  assert.equal(subsectionState(mini, p, 'caus.c1'), 'available');
  assert.equal(subsectionState(mini, p, 'caus.c2'), 'locked', 'c2 needs c1');
});

test('explored does not unlock anything', () => {
  const p = withStatus(['duty.d', 'breach.b'], 'explored');
  assert.equal(subsectionState(mini, p, 'duty.d'), 'explored');
  assert.equal(subsectionState(mini, p, 'caus.c1'), 'locked');
  // explored duty does not open breach either
  const q = withStatus(['duty.d'], 'explored');
  assert.equal(subsectionState(mini, q, 'breach.b'), 'locked');
});

test('real curriculum: tort Causation is locked until Duty and Breach prerequisites are consolidated', () => {
  const target = 'tort-causation.but-for';
  const closure = prerequisiteClosure(index, target);
  assert.ok(closure.includes('tort-duty.caparo'), 'Duty of Care (Caparo) gates causation');
  assert.ok(closure.includes('tort-breach.reasonable-person'), 'Breach gates causation');
  assert.equal(subsectionState(curriculum, createProgress(), target), 'locked');

  // Everything required except the Breach subsections: still locked.
  const dutyOnly = closure.filter((id) => !id.startsWith('tort-breach.'));
  assert.equal(subsectionState(curriculum, withStatus(dutyOnly, 'consolidated'), target), 'locked');

  // Everything required, but Breach only explored: still locked.
  const breachIds = closure.filter((id) => id.startsWith('tort-breach.'));
  let p = withStatus(closure.filter((id) => !breachIds.includes(id)), 'consolidated');
  p = withStatus(breachIds, 'explored', p);
  assert.equal(subsectionState(curriculum, p, target), 'locked');

  // Fully consolidated: opens.
  assert.equal(subsectionState(curriculum, withStatus(closure, 'consolidated'), target), 'available');
  // And consolidating the target's own prerequisites in the real data does not unlock later causation.
  assert.equal(subsectionState(curriculum, withStatus(closure, 'consolidated'), 'tort-causation.nai'), 'locked');
});

test('computeStates covers every subsection with a valid state', () => {
  const states = computeStates(curriculum, createProgress());
  assert.equal(Object.keys(states).length, index.size);
  for (const s of Object.values(states)) assert.ok(['locked', 'available'].includes(s));
  assert.ok(Object.values(states).includes('available'));
});

test('a stored status survives even if prerequisites are later unmet (curriculum changes)', () => {
  const p = withStatus(['caus.c1'], 'consolidated');
  assert.equal(subsectionState(mini, p, 'caus.c1'), 'consolidated');
});

// --- rollups -------------------------------------------------------------

test('district is consolidated only when ALL its subsections are', () => {
  const caus = mini.modules[0].regions[0].districts[2];
  let p = withStatus(['caus.c1'], 'consolidated');
  let states = computeStates(mini, p);
  let r = districtRollup(caus, states);
  assert.equal(r.status, 'in-progress');
  assert.equal(r.fraction, 0.5);
  assert.equal(isBrazierLit(caus, states), false);

  p = withStatus(['caus.c2'], 'explored', p);
  assert.equal(districtRollup(caus, computeStates(mini, p)).status, 'in-progress', 'explored last subsection is not enough');

  p = withStatus(['caus.c2'], 'consolidated', p);
  states = computeStates(mini, p);
  assert.equal(districtRollup(caus, states).status, 'consolidated');
  assert.equal(isBrazierLit(caus, states), true);
});

test('rollup statuses: locked, available, in-progress, counts add up', () => {
  const rollups = computeRollups(mini, createProgress());
  assert.equal(rollups.districts.duty.status, 'available');
  assert.equal(rollups.districts.breach.status, 'locked');
  assert.equal(rollups.districts.caus.status, 'locked');
  assert.deepEqual(rollups.districts.caus.counts, { locked: 2, available: 0, explored: 0, consolidated: 0 });
  assert.equal(rollups.regions.r.total, 4);
  assert.equal(rollups.regions.r.status, 'available');
  assert.equal(rollups.modules.m.total, 4);
});

test('region and module rollups consolidate only when every district is', () => {
  const all = ['duty.d', 'breach.b', 'caus.c1', 'caus.c2'];
  let r = computeRollups(mini, withStatus(all.slice(0, 3), 'consolidated'));
  assert.equal(r.regions.r.status, 'in-progress');
  assert.equal(r.districts.duty.status, 'consolidated');
  assert.equal(r.districts.breach.status, 'consolidated');
  r = computeRollups(mini, withStatus(all, 'consolidated'));
  assert.equal(r.regions.r.status, 'consolidated');
  assert.equal(r.modules.m.status, 'consolidated');
  assert.equal(r.regions.r.fraction, 1);
});

test('real curriculum rollups: every district and region present, nothing consolidated at start', () => {
  const r = computeRollups(curriculum, createProgress());
  assert.equal(Object.keys(r.regions).length, 4);
  for (const d of Object.values(r.districts)) assert.notEqual(d.status, 'consolidated');
  for (const reg of Object.values(r.regions)) assert.equal(reg.counts.consolidated, 0);
});

// --- encounter results -> progress --------------------------------------

test('leaving without answering changes nothing', () => {
  const p = createProgress();
  const next = applyEncounterResult(p, fakeResult('duty.d', { verdicts: { 2: null, 3: null, 4: null, 5: null }, exchanges: 0, finished: false }));
  assert.equal(next, p);
});

test('leaving mid-session makes the subsection explored, which does not unlock dependants', () => {
  const res = fakeResult('duty.d', { finished: false, exchanges: 3, verdicts: { 2: 'solid', 3: null, 4: null, 5: null } });
  const p = applyEncounterResult(createProgress(), res, { now: T(1) });
  assert.equal(p.subsections['duty.d'].status, 'explored');
  assert.equal(subsectionState(mini, p, 'duty.d'), 'explored');
  assert.equal(subsectionState(mini, p, 'breach.b'), 'locked');
});

test('a solid finished encounter consolidates and unlocks the next subsection', () => {
  const p = applyEncounterResult(createProgress(), fakeResult('duty.d'), { now: T(1) });
  assert.equal(p.subsections['duty.d'].status, 'consolidated');
  assert.equal(subsectionState(mini, p, 'breach.b'), 'available');
});

test('the result cannot talk its way to consolidated: the rule is recomputed', () => {
  const claims = { ...fakeResult('duty.d', { verdicts: { 3: 'partial' } }), outcome: 'consolidated' };
  assert.equal(applyEncounterResult(createProgress(), claims).subsections['duty.d'].status, 'explored');
  const lowMcq = applyEncounterResult(createProgress(), { ...fakeResult('duty.d', { mcq: 1 }), outcome: 'consolidated' });
  assert.equal(lowMcq.subsections['duty.d'].status, 'explored');
  const unfinished = applyEncounterResult(createProgress(), { ...fakeResult('duty.d', { finished: false }), outcome: 'consolidated' });
  assert.equal(unfinished.subsections['duty.d'].status, 'explored');
  const skipped = applyEncounterResult(createProgress(), fakeResult('duty.d', { verdicts: { 4: null } }));
  assert.equal(skipped.subsections['duty.d'].status, 'explored');
});

test('a later weaker attempt never downgrades consolidated', () => {
  let p = applyEncounterResult(createProgress(), fakeResult('duty.d'), { now: T(1) });
  p = applyEncounterResult(p, fakeResult('duty.d', { verdicts: { 5: 'missing' }, mcq: 0 }), { now: T(2) });
  assert.equal(p.subsections['duty.d'].status, 'consolidated');
  assert.equal(p.subsections['duty.d'].attempts, 2);
  assert.equal(p.subsections['duty.d'].lastOutcome, 'explored');
});

test('input progress is never mutated', () => {
  const p = createProgress();
  const snap = JSON.stringify(p);
  applyEncounterResult(p, fakeResult('duty.d', { gaps: [{ concept: 'x', stage: 3 }] }));
  assert.equal(JSON.stringify(p), snap);
});

// --- gaps ----------------------------------------------------------------

test('gap log has the specified shape and counts repeats', () => {
  let p = logGap(createProgress(), { subsectionId: 'duty.d', concept: 'proximity', stage: 3 }, T(1));
  assert.deepEqual(p.gaps[0], { subsectionId: 'duty.d', concept: 'proximity', stage: 3, firstSeen: T(1), lastSeen: T(1), timesMissed: 1, resolved: false });
  p = logGap(p, { subsectionId: 'duty.d', concept: ' Proximity ', stage: 3 }, T(2));
  assert.equal(p.gaps.length, 1, 'same concept is the same gap');
  assert.equal(p.gaps[0].timesMissed, 2);
  assert.equal(p.gaps[0].firstSeen, T(1));
  assert.equal(p.gaps[0].lastSeen, T(2));
  p = logGap(p, { subsectionId: 'breach.b', concept: 'proximity', stage: 3 }, T(2));
  assert.equal(p.gaps.length, 2, 'same concept in another subsection is separate');
});

test('gaps from an encounter are logged, once per concept per encounter', () => {
  const res = fakeResult('duty.d', {
    verdicts: { 3: 'partial' }, mcq: 3,
    gaps: [{ concept: 'proximity', stage: 3 }, { concept: 'proximity', stage: 6 }, { concept: 'policy', stage: 4 }],
  });
  const p = applyEncounterResult(createProgress(), res, { now: T(1) });
  assert.equal(p.gaps.length, 2);
  assert.equal(p.gaps.find((g) => g.concept === 'proximity').timesMissed, 1);
});

test('gaps resolve when later answered solidly, and re-open if missed again', () => {
  let p = applyEncounterResult(createProgress(), fakeResult('duty.d', { verdicts: { 3: 'partial' }, gaps: [{ concept: 'Proximity', stage: 3 }] }), { now: T(1) });
  assert.equal(openGaps(p).length, 1);
  assert.equal(p.subsections['duty.d'].status, 'explored');

  // Second encounter: solid, and credits the concept.
  p = applyEncounterResult(p, fakeResult('duty.d', { hit: { 3: ['proximity'] } }), { now: T(2) });
  assert.equal(openGaps(p).length, 0);
  assert.equal(p.gaps[0].resolved, true);
  assert.equal(p.gaps[0].timesMissed, 1);
  assert.equal(p.subsections['duty.d'].status, 'consolidated');

  // Missed again later: re-opened.
  p = recordRetrieval(p, { subsectionId: 'duty.d', concept: 'proximity', verdict: 'partial', stage: 3 }, T(3));
  assert.equal(p.gaps[0].resolved, false);
  assert.equal(p.gaps[0].timesMissed, 2);
});

test('a partial answer does not resolve a gap; a solid retrieval does', () => {
  let p = logGap(createProgress(), { subsectionId: 'duty.d', concept: 'proximity', stage: 3 }, T(1));
  const before = p;
  // concept credited only by a partial stage: no resolution
  p = applyEncounterResult(p, fakeResult('duty.d', { verdicts: { 3: 'partial' }, hit: { 3: ['proximity'] } }), { now: T(2) });
  assert.equal(openGaps(p).length, 1);
  p = recordRetrieval(before, { subsectionId: 'duty.d', concept: 'proximity', verdict: 'solid' }, T(3));
  assert.equal(openGaps(p).length, 0);
});

test('solid retrieval on a concept that was never a gap changes nothing', () => {
  const p = createProgress();
  assert.equal(recordRetrieval(p, { subsectionId: 'duty.d', concept: 'x', verdict: 'solid' }), p);
  assert.equal(resolveGaps(p, 'duty.d', []), p);
});

test('checkpoint concepts answered correctly resolve gaps', () => {
  let p = logGap(createProgress(), { subsectionId: 'duty.d', concept: 'neighbour principle', stage: 6 }, T(1));
  p = applyEncounterResult(p, fakeResult('duty.d', { mcqHit: ['Neighbour principle'] }), { now: T(2) });
  assert.equal(openGaps(p).length, 0);
});

test('openGaps filters and orders by times missed', () => {
  let p = createProgress();
  p = logGap(p, { subsectionId: 'a', concept: 'one', stage: 2 }, T(1));
  p = logGap(p, { subsectionId: 'a', concept: 'two', stage: 2 }, T(2));
  p = logGap(p, { subsectionId: 'a', concept: 'two', stage: 2 }, T(3));
  p = logGap(p, { subsectionId: 'b', concept: 'three', stage: 2 }, T(1));
  assert.deepEqual(openGaps(p).map((g) => g.concept), ['two', 'one', 'three']);
  assert.deepEqual(openGaps(p, { subsectionId: 'b' }).map((g) => g.concept), ['three']);
  assert.deepEqual(openGaps(p, { subsectionIds: ['a'] }).length, 2);
});

// --- stats ---------------------------------------------------------------

test('stat gains follow the stage that earns them', () => {
  const sub = { statutes: ['Occupiers Liability Act 1957'] };
  const g = statGainsFromResult(fakeResult('x', { verdicts: { 3: 'solid', 4: 'partial', 5: 'solid' }, irac: { 5: 3 } }), sub);
  assert.deepEqual(g, { caseRecall: 1, statutoryInterpretation: 3, application: 3, iracFluency: 3 });
});

test('statutory interpretation only moves when the subsection has statutes', () => {
  const g = statGainsFromResult(fakeResult('x'), { statutes: [] });
  assert.equal(g.statutoryInterpretation, 0);
  assert.equal(g.caseRecall, 3);
});

test('unanswered and "not sure" stages earn nothing', () => {
  const g = statGainsFromResult(fakeResult('x', { verdicts: { 3: null, 4: 'missing', 5: null } }), { statutes: ['s'] });
  assert.deepEqual(g, { caseRecall: 0, statutoryInterpretation: 0, application: 0, iracFluency: 0 });
});

test('IRAC fluency is clamped to 0-4', () => {
  assert.equal(statGainsFromResult(fakeResult('x', { irac: { 5: 9 } }), {}).iracFluency, 4);
  assert.equal(statGainsFromResult(fakeResult('x', { irac: { 5: -2 } }), {}).iracFluency, 0);
});

test('applying a result adds to stats; leaving with nothing does not', () => {
  const sub = { statutes: ['s'] };
  const p = applyEncounterResult(createProgress(), fakeResult('x', { irac: { 5: 4 } }), { subsection: sub });
  assert.deepEqual(p.stats, { caseRecall: 3, statutoryInterpretation: 3, application: 3, iracFluency: 4 });
  const q = applyEncounterResult(p, fakeResult('x', { irac: { 5: 2 } }), { subsection: sub });
  assert.equal(q.stats.caseRecall, 6);
  assert.equal(q.stats.iracFluency, 6);
});

test('statLevel thresholds and awardStat guards', () => {
  assert.equal(statLevel(0).level, 0);
  assert.equal(statLevel(5).level, 1);
  assert.equal(statLevel(14).level, 1);
  assert.equal(statLevel(15).level, 2);
  const p = createProgress();
  assert.equal(awardStat(p, 'nonsense', 3), p);
  assert.equal(awardStat(p, 'caseRecall', 0), p);
  assert.equal(awardStat(p, 'caseRecall', 2).stats.caseRecall, 2);
});

test('normaliseProgress tolerates junk', () => {
  assert.deepEqual(normaliseProgress(null), createProgress());
  assert.deepEqual(normaliseProgress({ stats: { caseRecall: 4 }, gaps: 'x' }).stats.caseRecall, 4);
  assert.deepEqual(normaliseProgress({ gaps: 'x' }).gaps, []);
});

// --- integration with the real engine -----------------------------------

test('a real offline encounter left after a couple of answers becomes explored and logs gaps', async () => {
  const enc = createEncounter(demoSubsection, createOfflineTutor());
  await enc.next();
  await enc.next();
  await enc.submit('Offers are something a shop does and acceptance is somewhat vague really.');
  const res = enc.leave();
  const p = applyEncounterResult(createProgress(), res, { subsection: demoSubsection, now: T(1) });
  assert.equal(p.subsections[demoSubsection.id].status, 'explored');
  assert.ok(p.gaps.length > 0, 'a thin answer logs gaps');
  assert.equal(p.stats.caseRecall, 0);
});

test('opening a real encounter and leaving without answering changes nothing', async () => {
  const enc = createEncounter(demoSubsection, createOfflineTutor());
  await enc.next();
  const p = createProgress();
  assert.equal(applyEncounterResult(p, enc.leave(), { subsection: demoSubsection }), p);
});
