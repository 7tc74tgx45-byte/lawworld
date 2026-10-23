import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEncounter, computeOutcome, MIN_EXCHANGES } from '../src/logic/encounter.js';
import { createOfflineTutor } from '../src/api/offlineTutor.js';
import { OFFLINE_BANK } from '../src/data/offlineBank.js';
import { demoSubsection } from '../src/data/demoSubsection.js';

const SOLID_2 =
  'An offer is a proposal where one party is willing to be bound on set terms. Acceptance is an unqualified agreement to exactly those terms, and once they match the parties are legally bound. A shop price tag is only an invitation to treat, so the shop is not bound.';
const SOLID_3 =
  'An offer shows an objective intention to be bound on acceptance; an invitation to treat only invites offers. Acceptance must be unqualified and mirror the offer, and a counter-offer destroys the original offer (Hyde v Wrench). Acceptance generally must be communicated and received (Entores), but under the postal rule in Adams v Lindsell acceptance is complete on posting. An offer can be revoked until acceptance but revocation must be communicated (Byrne v Van Tienhoven). Section 57 Sale of Goods Act 1979 deals with auction sales and the hammer.';
const SOLID_4 =
  'Carlill v Carbolic Smoke Ball: the company advertised £100 to anyone who caught flu after using the smoke ball, and deposited money at the bank. The court held it was a unilateral offer to the whole world, accepted by performance without notifying the company, and not a mere puff. It matters because it shows an advert can be an offer, not just an invitation to treat.';
const SOLID_5 =
  'Issue: whether a contract formed at 50p. Rule: goods on display are an invitation to treat (Fisher v Bell) and in self-service the customer makes the offer at the till (Pharmaceutical Society v Boots). Application: Alice picking up the tin is not acceptance; her offer is made at the till and the cashier accepts, so Bob can refuse. Conclusion: no contract has formed, so the shop need not sell at 50p.';

const MCQ = OFFLINE_BANK[demoSubsection.id][6].questions;

async function setup() {
  const enc = createEncounter(demoSubsection, createOfflineTutor());
  await enc.next(); // intro
  await enc.next(); // stage 2 prompt
  return enc;
}

async function playToVerdict(enc, answers, mcqPicks) {
  for (const a of answers) {
    let r = await enc.submit(a);
    assert.ok(r.ok, 'open answer accepted');
    // Clear any follow-ups with the same strong answer (bounded).
    let guard = 0;
    while (r.prompt?.isFollowUp && guard++ < 3) r = await enc.submit(a);
  }
  let r;
  for (const pick of mcqPicks) r = await enc.submit(pick);
  // Verdict may ask a reflection question when fewer than 8 exchanges.
  let guard = 0;
  while (!r.done && guard++ < 4) r = await enc.submit('I feel least sure about the exceptions to the postal rule and revocation.');
  return r;
}

test('cannot consolidate without answering', async () => {
  const enc = await setup();
  assert.equal(enc.result().outcome, 'explored');
  assert.equal(enc.result().finished, false);
  const left = enc.leave();
  assert.equal(left.outcome, 'explored');
  assert.equal(computeOutcome({ stages: {}, checkpoint: { correct: 3 } }), 'explored');
});

test('short answer is rejected and not counted', async () => {
  const enc = await setup();
  const before = enc.status().exchanges;
  const r = await enc.submit('too short');
  assert.equal(r.ok, false);
  assert.equal(r.rejected, true);
  assert.equal(enc.status().exchanges, before);
  assert.equal(enc.status().stage, 2);
  assert.equal(enc.result().stages[2].answered, false);
});

test('hints nudge but never leak the model answer', async () => {
  const enc = await setup();
  const bank = OFFLINE_BANK[demoSubsection.id];
  for (const stage of [2, 3, 4, 5]) {
    for (const h of bank[stage].hints) {
      assert.notEqual(h.trim(), '');
      assert.ok(!bank[stage].modelAnswer.includes(h), `hint ${stage} is not inside the model answer`);
      assert.ok(h.length < bank[stage].modelAnswer.length);
    }
  }
  // Stage 5 hints must not name the cases the answer needs.
  for (const h of bank[5].hints) assert.ok(!/fisher|boots/i.test(h));
  const r1 = await enc.hint();
  const r2 = await enc.hint();
  const r3 = await enc.hint();
  for (const r of [r1, r2]) {
    const text = r.messages[0].text;
    assert.match(text, /^Hint:/);
    assert.ok(!text.includes(bank[2].modelAnswer.slice(0, 40)));
  }
  assert.match(r3.messages[0].text, /nudges/);
  assert.equal(enc.status().exchanges, 0, 'hints are not exchanges');
});

test('engine never exposes the answer key in prompts', async () => {
  const enc = await setup();
  const r = await enc.submit(SOLID_2);
  assert.ok(r.prompt);
  assert.equal(r.prompt.modelAnswer, undefined);
  assert.equal(r.prompt.correct, undefined);
});

test('leaving mid-session returns explored and keeps progress', async () => {
  const enc = await setup();
  await enc.submit(SOLID_2);
  const res = enc.leave();
  assert.equal(res.outcome, 'explored');
  assert.equal(res.finished, false);
  assert.equal(res.stages[2].answered, true);
  assert.equal(res.exchanges, 1);
});

test('"I\'m not sure" logs a gap and asks for a restatement', async () => {
  const enc = await setup();
  const r = await enc.notSure();
  assert.ok(enc.result().gaps.length > 0);
  assert.equal(r.prompt.isFollowUp, true);
  assert.equal(enc.result().stages[2].verdict, 'missing');
});

test('asking a question answers from the bank and counts as no exchange', async () => {
  const enc = await setup();
  const r = await enc.ask('What is the postal rule exactly?');
  assert.match(r.messages[1].text, /Adams v Lindsell/);
  assert.equal(enc.status().exchanges, 0);
});

test('thin answers trigger at most two follow-ups per stage', async () => {
  const enc = await setup();
  let r = await enc.submit('An offer is something people do in shops generally.');
  assert.equal(r.prompt.isFollowUp, true);
  r = await enc.submit('Still only a vague answer about shops and offers really.');
  assert.equal(r.prompt.isFollowUp, true);
  r = await enc.submit('A third vague answer about contracts and shops and so on.');
  assert.equal(r.prompt.isFollowUp, undefined);
  assert.equal(enc.status().stage, 3);
  assert.equal(enc.result().stages[2].followUps, 2);
  assert.ok(enc.result().gaps.length > 0);
});

test('MCQ must be one of the options', async () => {
  const enc = await setup();
  await enc.submit(SOLID_2);
  await enc.submit(SOLID_3);
  await enc.submit(SOLID_4);
  await enc.submit(SOLID_5);
  assert.equal(enc.status().stage, 6);
  const r = await enc.submit(9);
  assert.equal(r.ok, false);
  assert.equal(enc.result().checkpoint.answered, 0);
});

test('full solid run is consolidated', async () => {
  const enc = await setup();
  const r = await playToVerdict(enc, [SOLID_2, SOLID_3, SOLID_4, SOLID_5], MCQ.map((q) => q.correct));
  assert.equal(r.done, true);
  const res = enc.result();
  assert.equal(res.stages[3].verdict, 'solid');
  assert.equal(res.stages[5].verdict, 'solid');
  assert.equal(res.checkpoint.correct, 3);
  assert.ok(res.exchanges >= MIN_EXCHANGES);
  assert.equal(res.outcome, 'consolidated');
  assert.match(res.verdictText, /CONSOLIDATED/);
});

test('good answers but checkpoint 1/3 stays explored with gaps', async () => {
  const enc = await setup();
  const wrong = MCQ.map((q, i) => (i === 0 ? q.correct : (q.correct + 1) % q.options.length));
  await playToVerdict(enc, [SOLID_2, SOLID_3, SOLID_4, SOLID_5], wrong);
  const res = enc.result();
  assert.equal(res.checkpoint.correct, 1);
  assert.equal(res.outcome, 'explored');
  assert.ok(res.gaps.length >= 2);
});

test('stage 5 not solid prevents consolidation', async () => {
  const enc = await setup();
  const weak5 = 'The shop has to sell at 50p because the price was on the shelf, I think.';
  await playToVerdict(enc, [SOLID_2, SOLID_3, SOLID_4, weak5], MCQ.map((q) => q.correct));
  const res = enc.result();
  assert.notEqual(res.stages[5].verdict, 'solid');
  assert.equal(res.outcome, 'explored');
});

test('no verdict before the minimum number of exchanges', async () => {
  const enc = await setup();
  // 4 answers + 3 MCQs = 7 exchanges: the verdict must be held back for a reflection.
  await enc.submit(SOLID_2);
  await enc.submit(SOLID_3);
  await enc.submit(SOLID_4);
  await enc.submit(SOLID_5);
  for (const q of MCQ) await enc.submit(q.correct);
  assert.equal(enc.status().done, false);
  assert.equal(enc.status().stage, 7);
  const r = await enc.submit('The part I find hardest is when the postal rule does not apply.');
  assert.equal(r.done, true);
  assert.ok(enc.result().exchanges >= MIN_EXCHANGES);
});
