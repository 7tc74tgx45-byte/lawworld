import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewState, messageView, pipStates } from '../src/logic/encounterView.js';
import { createEncounter } from '../src/logic/encounter.js';
import { createOfflineTutor } from '../src/api/offlineTutor.js';
import { demoSubsection } from '../src/data/demoSubsection.js';

test('viewState: intro has Continue only; open stages have a textbox, hint and not-sure; MCQ has options and no textbox', () => {
  const info = viewState({ kind: 'info' });
  assert.equal(info.submitLabel, 'Continue');
  assert.equal(info.showInput, false);
  assert.equal(info.showHint, false);

  const open = viewState({ kind: 'open' });
  assert.deepEqual([open.showInput, open.showSubmit, open.showHint, open.showNotSure, open.showAsk], [true, true, true, true, true]);
  assert.equal(open.submitLabel, 'Submit');

  const mcq = viewState({ kind: 'mcq' });
  assert.deepEqual([mcq.showOptions, mcq.showInput, mcq.showSubmit, mcq.showHint, mcq.showNotSure], [true, false, false, true, true]);
});

test('viewState: ask mode shows a box with a send button, even on MCQ and intro; finished shows only Close', () => {
  for (const kind of ['open', 'mcq', 'info']) {
    const v = viewState({ kind, mode: 'ask' });
    assert.equal(v.showInput, true, kind);
    assert.equal(v.showSubmit, true, kind);
    assert.equal(v.submitLabel, 'Send question');
    assert.equal(v.askLabel, 'Cancel question');
  }
  const done = viewState({ kind: 'verdict', finished: true });
  assert.deepEqual([done.showInput, done.showSubmit, done.showHint, done.showNotSure, done.showAsk, done.showOptions], [false, false, false, false, false, false]);
  assert.equal(done.leaveLabel, 'Close');
});

test('a Submit button is only ever offered next to a textbox (or as the intro Continue): no skip control', () => {
  for (const kind of ['open', 'mcq', 'verdict']) {
    const v = viewState({ kind });
    if (v.showSubmit) assert.equal(v.showInput, true, kind);
  }
  const info = viewState({ kind: 'info' });
  assert.equal(info.showSubmit, true);
  assert.equal(info.submitLabel, 'Continue');
});

test('pipStates: seven pips, done before, now at the stage, all done when finished', () => {
  assert.deepEqual(pipStates(1, false), ['now', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
  assert.deepEqual(pipStates(4, false), ['done', 'done', 'done', 'now', 'todo', 'todo', 'todo']);
  assert.deepEqual(pipStates(7, true), Array(7).fill('done'));
});

test('messageView labels hints, external answers and verdicts', () => {
  assert.match(messageView({ role: 'tutor', kind: 'hint' }).className, /hint/);
  assert.equal(messageView({ role: 'tutor', kind: 'hint' }).label, 'Hint');
  const ext = messageView({ role: 'tutor', kind: 'answer', external: true });
  assert.match(ext.className, /external/);
  assert.match(ext.label, /not from your notes/i);
  assert.match(messageView({ role: 'tutor', kind: 'feedback', correct: false }, 'Dr Chen').className, /wrong/);
  assert.equal(messageView({ role: 'player', kind: 'open' }).label, '');
});

test('driving the engine the way the overlay does reaches a verdict in offline mode', async () => {
  const tutor = createOfflineTutor({ personaId: 'chen' });
  const engine = createEncounter({ subsection: demoSubsection, tutor, priorGaps: [] });
  let res = await engine.next();
  const kinds = [res.prompt.kind];
  let guard = 0;
  while (!res.done && guard++ < 60) {
    const v = viewState({ kind: res.prompt.kind });
    if (res.prompt.kind === 'info') res = await engine.next();
    else if (res.prompt.kind === 'mcq') {
      assert.equal(v.showOptions, true);
      res = await engine.submit(0);
    } else if (res.prompt.reflection) {
      res = await engine.submit('The part I am least sure about is how the postal rule interacts with revocation.');
    } else {
      const ans = tutor.generate(res.stage, { subsection: demoSubsection, priorGaps: [] }).modelAnswer;
      res = await engine.submit(ans ?? 'I would explain the rule in my own words here.');
    }
    kinds.push(res.prompt.kind);
  }
  assert.equal(res.done, true);
  assert.equal(res.prompt.kind, 'verdict');
  assert.ok(kinds.includes('mcq'));
  const r = engine.result();
  assert.equal(r.finished, true);
  assert.ok(['consolidated', 'explored'].includes(r.outcome));
  assert.ok(r.exchanges >= 8);
});
