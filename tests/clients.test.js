import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClientEncounter } from '../src/logic/clientEncounter.js';
import { clientCandidates, pickClientCase, clientReward, applyClientResult, onCooldown, normaliseClients } from '../src/logic/clients.js';
import { createFreshSave, normaliseSave } from '../src/logic/save.js';
import { logGap } from '../src/logic/progress.js';
import { curriculum } from '../src/data/curriculum.js';
import { flattenSubsections } from '../src/logic/curriculum.js';

const SUB = { id: 'mock', title: 'Mock', keyConcepts: ['alpha'], statutes: ['s 1'], keyCases: ['A v B'] };
const LONG = 'You are probably not bound because the rule is X and here it applies.';
const SECRET = 'the secret model answer says alpha beta gamma delta epsilon zeta eta theta iota';

function tutor(verdicts, opts = {}) {
  const q = [...verdicts];
  return {
    clientScenario: () => ({ text: 'A problem.', modelAnswer: SECRET }),
    evaluate: () => {
      const v = q.length > 1 ? q.shift() : q[0];
      return { verdict: v, feedback: `fb-${v}`, conceptsHit: v === 'missing' ? [] : ['alpha'], conceptsMissed: v === 'solid' ? [] : ['beta'], followUp: 'More?', iracScore: 3 };
    },
    hint: () => (opts.leaky ? SECRET : 'a nudge'),
  };
}

test('client case: short advice is rejected and not counted', async () => {
  const e = createClientEncounter({ subsection: SUB, tutor: tutor(['solid']) });
  await e.start();
  const r = await e.submit('too short');
  assert.equal(r.rejected, true);
  assert.equal(e.result().evaluations.length, 0);
});

test('client case: thin advice gets exactly one follow-up, then a verdict', async () => {
  const e = createClientEncounter({ subsection: SUB, tutor: tutor(['partial', 'partial']) });
  await e.start();
  const r1 = await e.submit(LONG);
  assert.equal(r1.done, false);
  const r2 = await e.submit(LONG + ' more');
  assert.equal(r2.done, true);
  assert.equal(e.result().evaluations.length, 2);
});

test('client case: solid advice ends at once; hints never leak; no submit after the end', async () => {
  const e = createClientEncounter({ subsection: SUB, tutor: tutor(['solid'], { leaky: true }) });
  await e.start();
  const h = await e.hint();
  assert.ok(!h.messages[0].text.includes('epsilon zeta'));
  const r = await e.submit(LONG);
  assert.equal(r.done, true);
  assert.equal((await e.submit(LONG)).rejected, true);
});

test('client case: "I\'m not sure" caps the verdict at partial and logs missing concepts', async () => {
  const e = createClientEncounter({ subsection: SUB, tutor: tutor(['solid']) });
  await e.start();
  await e.notSure();
  const r = await e.submit(LONG);
  assert.equal(r.done, true);
  const res = e.result();
  const reward = clientReward(res, 'contract', SUB);
  assert.equal(reward.verdict, 'partial');
});

test('reward is recomputed from evaluations; nothing answered earns nothing', async () => {
  const e = createClientEncounter({ subsection: SUB, tutor: tutor(['solid']) });
  await e.start();
  assert.equal(clientReward(e.result(), 'contract', SUB).amount, 0);
  await e.submit(LONG);
  const r = clientReward(e.result(), 'contract', SUB);
  assert.equal(r.material, 'precedentScrolls');
  assert.equal(r.amount, 3);
  assert.equal(r.stats.application, 3);
  const fresh = createFreshSave();
  const same = applyClientResult(fresh, { subsectionId: 'mock', evaluations: [] }, { regionId: 'contract' });
  assert.equal(same.save, fresh);
  assert.equal(same.reward, null);
});

test('applyClientResult adds materials, stats, cooldown, and resolves/logs gaps', async () => {
  let save = createFreshSave();
  save = { ...save, progress: logGap(save.progress, { subsectionId: 'mock', concept: 'alpha', stage: 3 }) };
  const e = createClientEncounter({ subsection: SUB, tutor: tutor(['solid']) });
  await e.start();
  await e.submit(LONG);
  const now = Date.parse('2026-01-01T10:00:00Z');
  const { save: next, reward } = applyClientResult(save, e.result(), { regionId: 'tort', slotId: 'client-tort', subsection: SUB, now });
  assert.equal(next.inventory.materials.caseReports, reward.amount);
  assert.ok(next.progress.stats.application >= 3);
  assert.equal(next.progress.gaps[0].resolved, true);
  assert.equal(onCooldown(next.clients, 'client-tort', now + 1000), true);
  assert.equal(onCooldown(next.clients, 'client-tort', now + 10 * 60 * 1000), false);
  assert.equal(normaliseSave(next).clients.served, 1); // survives the save schema
});

test('candidates need an explored or consolidated subsection, and open gaps raise the weight', () => {
  const subs = flattenSubsections(curriculum).filter((s) => s.id.startsWith('contract'));
  const first = subs.find((s) => s.prerequisites.length === 0) ?? subs[0];
  const fresh = createFreshSave().progress;
  assert.equal(clientCandidates(curriculum, fresh, 'contract').length, 0);
  let p = { ...fresh, subsections: { [first.id]: { status: 'explored' } } };
  const base = clientCandidates(curriculum, p, 'contract');
  assert.equal(base.length, 1);
  p = logGap(p, { subsectionId: first.id, concept: 'x', stage: 3 });
  assert.ok(clientCandidates(curriculum, p, 'contract')[0].weight > base[0].weight);
  assert.equal(pickClientCase([], () => 0), null);
  assert.equal(pickClientCase(base, () => 0).subsection.id, first.id);
  assert.deepEqual(normaliseClients(null), { cooldowns: {}, recent: [], served: 0 });
});
