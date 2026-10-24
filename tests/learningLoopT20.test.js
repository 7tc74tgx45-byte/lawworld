import test from 'node:test';
import assert from 'node:assert/strict';
import { createEncounterRecorder, recordOnPageHide } from '../src/logic/encounterRecorder.js';
import { createEncounter } from '../src/logic/encounter.js';
import { MIN_QUESTION_CHARS } from '../src/logic/encounterRules.js';
import { createOfflineTutor } from '../src/api/offlineTutor.js';
import { demoSubsection } from '../src/data/demoSubsection.js';
import { createSaveStore } from '../src/logic/saveStore.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test('the recorder records once: a verdict then Leave, or pagehide then close, never counts twice', () => {
  const seen = [];
  const rec = createEncounterRecorder((r) => seen.push(r));
  assert.equal(rec.finish({ n: 1 }), true);
  assert.equal(rec.leave({ n: 2 }), false);
  assert.deepEqual(seen, [{ n: 1 }]);

  const seen2 = [];
  const rec2 = createEncounterRecorder((r) => seen2.push(r));
  const engine = { leave: () => ({ n: 'left' }) };
  assert.equal(recordOnPageHide(engine, rec2), true);
  assert.equal(recordOnPageHide(engine, rec2), false);
  rec2.leave({ n: 'close' }); // the overlay's own close afterwards
  assert.deepEqual(seen2, [{ n: 'left' }]);
  assert.equal(recordOnPageHide(null, createEncounterRecorder(() => {})), false);
});

test('pagehide mid-encounter keeps evaluated answers as explored progress', async () => {
  const tutor = createOfflineTutor();
  const engine = createEncounter({ subsection: demoSubsection, tutor });
  await engine.next();
  const p = await engine.next(); // stage 2 prompt
  assert.equal(p.stage, 2);
  const model = tutor.generate(2, { subsection: demoSubsection, priorGaps: [] }).modelAnswer;
  await engine.submit(model);

  const store = createSaveStore({ storage: memoryStorage() });
  const rec = createEncounterRecorder((res) => store.applyEncounter(res, { subsection: demoSubsection }));
  assert.equal(recordOnPageHide(engine, rec), true);
  const st = store.state.progress.subsections[demoSubsection.id];
  assert.ok(st, 'the subsection was recorded');
  assert.equal(st.status, 'explored');
  assert.equal(store.state.sessions.length, 1);
  // the engine refuses further play after leaving
  const r = await engine.submit('some further answer that is long enough');
  assert.equal(r.rejected, true);
});

test('the encounter engine accepts a short real question (5+ chars) and rejects shorter', async () => {
  const asked = [];
  const tutor = { ...createOfflineTutor(), answerQuestion: (q) => { asked.push(q); return { text: 'ok', external: false }; } };
  const engine = createEncounter({ subsection: demoSubsection, tutor });
  await engine.next();
  assert.equal((await engine.ask('a'.repeat(MIN_QUESTION_CHARS - 1))).rejected, true);
  const r = await engine.ask('a'.repeat(MIN_QUESTION_CHARS));
  assert.equal(r.ok, true);
  assert.equal(asked.length, 1);
});
