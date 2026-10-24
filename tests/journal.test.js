import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curriculum } from '../src/data/curriculum.js';
import { flattenSubsections } from '../src/logic/curriculum.js';
import { createProgress, logGap } from '../src/logic/progress.js';
import { buildJournal, statBars, revisitList, moduleTree } from '../src/logic/journal.js';
import { recordSession, recentSessions, normaliseSessions, MAX_SESSIONS_KEPT } from '../src/logic/sessionLog.js';
import { createSaveStore } from '../src/logic/saveStore.js';
import { normaliseSave, createFreshSave } from '../src/logic/save.js';

const subs = flattenSubsections(curriculum);
const first = subs.find((s) => s.prerequisites.length === 0 && subs.some((x) => x.prerequisites.includes(s.id)));

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
};

test('stat bars: four stats with level and fill between 0 and 1', () => {
  const p = createProgress();
  p.stats.caseRecall = 7; // level 1 (needs 5), 2 into the next 10
  const bars = statBars(p);
  assert.equal(bars.length, 4);
  const cr = bars.find((b) => b.key === 'caseRecall');
  assert.equal(cr.label, 'Case Recall');
  assert.equal(cr.level, 1);
  assert.equal(cr.intoLevel, 2);
  assert.ok(bars.every((b) => b.fraction >= 0 && b.fraction < 1));
  assert.equal(bars.find((b) => b.key === 'iracFluency').level, 0);
});

test('revisit list: open gaps only, with the building, district and module they live in', () => {
  let p = createProgress();
  p = logGap(p, { subsectionId: first.id, concept: 'postal rule', stage: 3 }, 1000);
  p = logGap(p, { subsectionId: first.id, concept: 'postal rule', stage: 3 }, 2000);
  p = logGap(p, { subsectionId: 'gone.building', concept: 'orphan', stage: 2 }, 3000);
  p = { ...p, gaps: [...p.gaps, { subsectionId: first.id, concept: 'resolved one', stage: 2, firstSeen: 'a', lastSeen: 'b', timesMissed: 1, resolved: true }] };
  const list = revisitList(curriculum, p);
  assert.equal(list.length, 2);
  assert.equal(list[0].concept, 'postal rule'); // most missed first
  assert.equal(list[0].timesMissed, 2);
  assert.equal(list[0].building, first.title);
  assert.equal(list[0].stageLabel, 'Precision');
  assert.ok(list[0].district && list[0].module && list[0].known);
  assert.equal(list[1].known, false); // curriculum changed: kept, flagged, no crash
  assert.ok(!list.some((g) => g.concept === 'resolved one'));
});

test('module tree: every subsection appears with its derived state, locked ones say what unlocks them', () => {
  const p = createProgress();
  p.subsections[first.id] = { status: 'explored', attempts: 1 };
  const tree = moduleTree(curriculum, p);
  assert.equal(tree.length, curriculum.modules.length);
  const flat = tree.flatMap((m) => m.districts.flatMap((d) => d.subsections));
  assert.equal(flat.length, subs.length);
  assert.equal(flat.find((s) => s.id === first.id).state, 'explored');
  const locked = flat.filter((s) => s.state === 'locked');
  assert.ok(locked.length > 0);
  assert.ok(locked.every((s) => s.needs.length > 0));
  // explored does not unlock: a dependant of `first` is still locked and names `first`
  const dependant = subs.find((s) => s.prerequisites.includes(first.id));
  const row = flat.find((s) => s.id === dependant.id);
  assert.equal(row.state, 'locked');
  assert.ok(row.needs.includes(first.title));
});

test('module tree counts open gaps per building', () => {
  let p = createProgress();
  p = logGap(p, { subsectionId: first.id, concept: 'a', stage: 2 }, 1);
  p = logGap(p, { subsectionId: first.id, concept: 'b', stage: 3 }, 1);
  const row = moduleTree(curriculum, p).flatMap((m) => m.districts.flatMap((d) => d.subsections)).find((s) => s.id === first.id);
  assert.equal(row.gaps, 2);
});

test('session log: newest first, capped at 10 in the journal and 50 in the save, bad entries dropped', () => {
  let s = [];
  for (let i = 0; i < 60; i++) {
    s = recordSession(s, { subsectionId: 'x.y', tutor: 'Dr Chen', exchanges: 9, finished: true, gaps: [{ concept: 'c' }] }, { subsection: { title: 'Y', module: 'M' }, outcome: 'explored', now: Date.UTC(2026, 0, 1, 0, i) });
  }
  assert.equal(s.length, MAX_SESSIONS_KEPT);
  const recent = recentSessions(s);
  assert.equal(recent.length, 10);
  assert.ok(Date.parse(recent[0].date) > Date.parse(recent[9].date));
  assert.equal(recent[0].gaps, 1);
  assert.deepEqual(normaliseSessions([null, 5, { subsectionId: 'a' }, { subsectionId: 'a', date: 'not a date' }]), []);
  assert.equal(recordSession([], { exchanges: 3 }, {}).length, 0); // no subsection id: not a session
});

test('save store logs a session with the recomputed outcome, and leaving without answering logs nothing', () => {
  const store = createSaveStore({ storage: memStorage(), now: () => Date.UTC(2026, 5, 1) });
  // The engine *claims* consolidated but the stages say otherwise: the log must say explored.
  const lying = {
    subsectionId: first.id, outcome: 'consolidated', finished: true, tutor: 'Dr Chen', exchanges: 9,
    stages: { 2: { answered: true, verdict: 'partial' }, 3: { answered: true, verdict: 'partial' }, 4: { answered: true, verdict: 'partial' }, 5: { answered: true, verdict: 'partial' } },
    checkpoint: { correct: 3, total: 3, answered: 3, conceptsHit: [] },
    gaps: [{ concept: 'consideration', stage: 3 }],
  };
  assert.equal(store.applyEncounter(lying, { subsection: first }), true);
  assert.equal(store.state.sessions.length, 1);
  assert.equal(store.state.sessions[0].outcome, 'explored');
  assert.deepEqual(store.state.sessions[0].gapConcepts, ['consideration']);
  assert.equal(store.applyEncounter({ subsectionId: first.id, exchanges: 0, stages: {}, gaps: [] }, { subsection: first }), false);
  assert.equal(store.state.sessions.length, 1);
});

test('older saves without a sessions list load with an empty one', () => {
  const { sessions, ...old } = createFreshSave(1);
  assert.deepEqual(normaliseSave(old).sessions, []);
});

test('buildJournal bundles stats, tree, revisit and sessions', () => {
  const j = buildJournal(curriculum, createFreshSave(1));
  assert.equal(j.stats.length, 4);
  assert.equal(j.tree.length, 4);
  assert.deepEqual(j.revisit, []);
  assert.deepEqual(j.sessions, []);
});
