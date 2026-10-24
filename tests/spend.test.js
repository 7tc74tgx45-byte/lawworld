// T21: spending materials on extra hints and early braziers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curriculum } from '../src/data/curriculum.js';
import { locateSubsection, allDistricts, flattenSubsections } from '../src/logic/curriculum.js';
import { createFreshSave, normaliseSave } from '../src/logic/save.js';
import { createEncounter, MAX_HINTS, MAX_EXTRA_HINTS } from '../src/logic/encounter.js';
import { computeStates } from '../src/logic/progress.js';
import { syncBraziers } from '../src/logic/garden.js';
import { buildJournal } from '../src/logic/journal.js';
import { describeDoor } from '../src/logic/doorInfo.js';
import { createOfflineTutor, extraStageNudge } from '../src/api/offlineTutor.js';
import { OFFLINE_BANK } from '../src/data/offlineBank.js';
import {
  HINT_COST, BRAZIER_COST, hintPayment, hintOffer, buyExtraHint, refundHint, brazierOffers, lightBrazierEarly,
} from '../src/logic/spend.js';

const FIRST = 'contract-intro.what-is-contract';
const where = locateSubsection(curriculum, FIRST);
const DISTRICT = where.district.id;

const withMats = (mats) => {
  const s = createFreshSave();
  return { ...s, inventory: { ...s.inventory, materials: { ...s.inventory.materials, ...mats } } };
};
const explored = (s) => ({ ...s, progress: { ...s.progress, subsections: { ...s.progress.subsections, [FIRST]: { status: 'explored' } } } });

// ---- extra hints: pure rules ------------------------------------------------

test('an extra hint costs one material, preferring the building region\'s own', () => {
  const s = withMats({ precedentScrolls: 2, ink: 5 });
  assert.equal(hintPayment(s, 'contract'), 'precedentScrolls');
  const r = buyExtraHint(s, 'contract');
  assert.ok(r.ok);
  assert.equal(r.save.inventory.materials.precedentScrolls, 2 - HINT_COST);
  assert.equal(r.save.inventory.materials.ink, 5);
  assert.equal(s.inventory.materials.precedentScrolls, 2, 'the original save is not mutated');
});

test('with none of the local material, the richest other material pays; with none at all, nothing is bought', () => {
  const s = withMats({ ink: 3, caseReports: 1 });
  assert.equal(hintPayment(s, 'contract'), 'ink');
  const broke = createFreshSave();
  const r = buyExtraHint(broke, 'contract');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-materials');
  assert.equal(r.save, broke);
  assert.equal(hintOffer(broke, 'contract').canAfford, false);
  assert.match(hintOffer(broke, 'contract').text, /Precedent Scrolls/);
});

test('a refund puts the material back', () => {
  const s = withMats({ ink: 1 });
  const paid = buyExtraHint(s, 'foundations');
  assert.equal(paid.save.inventory.materials.ink, 0);
  assert.equal(refundHint(paid.save, paid.key).inventory.materials.ink, 1);
});

// ---- extra hints: encounter engine ------------------------------------------

const SECRET = 'the secret model answer says alpha beta gamma delta epsilon zeta eta theta iota';
function tutor(opts = {}) {
  return {
    name: 'Mock',
    calls: [],
    generate(stage, ctx) {
      if (stage === 6) return { text: `Q${ctx.mcqIndex + 1}`, options: ['A1', 'A2', 'A3'], modelAnswer: 'A2' };
      return { text: `Prompt ${stage}`, modelAnswer: SECRET };
    },
    evaluate() { return { verdict: 'solid', feedback: 'ok', conceptsHit: ['a'], conceptsMissed: [] }; },
    hint(stage, prompt, index) {
      this.calls.push(index);
      if (opts.failAfter !== undefined && index >= opts.failAfter) throw new Error('network down');
      return opts.leak && index >= 2 ? SECRET : `nudge ${index + 1}`;
    },
  };
}
const SUB = { id: 'mock', title: 'Mock', module: 'Mock', keyConcepts: ['a'] };
const startEnc = async (t, payForHint) => {
  const e = createEncounter({ subsection: SUB, tutor: t, payForHint });
  await e.next();
  await e.next();
  return e;
};
const payer = (wallet) => () => {
  if (wallet.n < 1) return { ok: false, message: 'broke' };
  wallet.n--;
  return { ok: true, refund: () => { wallet.n++; } };
};

test('extra hints are refused while free hints remain, and nothing is charged', async () => {
  const wallet = { n: 3 };
  const e = await startEnc(tutor(), payer(wallet));
  const r = await e.extraHint();
  assert.match(r.messages[0].text, /free hints/);
  assert.equal(wallet.n, 3);
});

test('after the free hints, an extra hint costs one material and is a nudge, up to MAX_EXTRA_HINTS', async () => {
  const wallet = { n: 5 };
  const t = tutor();
  const e = await startEnc(t, payer(wallet));
  for (let i = 0; i < MAX_HINTS; i++) await e.hint();
  assert.deepEqual(e.status().hints, { free: 0, extra: MAX_EXTRA_HINTS });
  const r1 = await e.extraHint();
  assert.match(r1.messages[0].text, /^Extra hint: nudge 3/);
  assert.equal(wallet.n, 4);
  await e.extraHint();
  assert.equal(wallet.n, 3);
  const r3 = await e.extraHint(); // beyond the cap: no more, no charge
  assert.match(r3.messages[0].text, /last extra nudge/);
  assert.equal(wallet.n, 3);
  assert.deepEqual(t.calls, [0, 1, 2, 3]); // indices continue after the free ones
  assert.equal(e.status().hints.extra, 0);
});

test('an extra hint changes nothing about the work: no exchange counted, no verdict, no answer', async () => {
  const wallet = { n: 5 };
  const e = await startEnc(tutor(), payer(wallet));
  for (let i = 0; i < MAX_HINTS; i++) await e.hint();
  await e.extraHint();
  const res = e.result();
  assert.equal(res.exchanges, 0);
  assert.equal(res.stages[2].answered, false);
  assert.equal(res.stages[2].verdict, null);
  assert.equal(res.outcome, 'explored');
});

test('without materials an extra hint is rejected and gives nothing away', async () => {
  const e = await startEnc(tutor(), payer({ n: 0 }));
  for (let i = 0; i < MAX_HINTS; i++) await e.hint();
  const r = await e.extraHint();
  assert.equal(r.ok, false);
  assert.equal(r.rejected, true);
  assert.match(r.messages[0].text, /broke/);
});

test('an engine with no payer offers no extra hints at all', async () => {
  const e = await startEnc(tutor());
  for (let i = 0; i < MAX_HINTS; i++) await e.hint();
  const r = await e.extraHint();
  assert.equal(r.ok, false);
});

test('a paid hint that leaks the model answer is replaced by a generic nudge', async () => {
  const e = await startEnc(tutor({ leak: true }), payer({ n: 2 }));
  for (let i = 0; i < MAX_HINTS; i++) await e.hint();
  const r = await e.extraHint();
  assert.ok(!r.messages[0].text.includes('alpha beta gamma'));
  assert.match(r.messages[0].text, /^Extra hint:/);
});

test('if the tutor fails to deliver a paid hint, the materials are refunded', async () => {
  const wallet = { n: 2 };
  const e = await startEnc(tutor({ failAfter: 2 }), payer(wallet));
  for (let i = 0; i < MAX_HINTS; i++) await e.hint();
  await assert.rejects(() => e.extraHint(), /network down/);
  assert.equal(wallet.n, 2);
  assert.equal(e.status().hints.extra, MAX_EXTRA_HINTS, 'a failed delivery does not use up an extra');
});

test('checkpoint questions get their own extra hints, reset for each question', async () => {
  const wallet = { n: 9 };
  const e = await startEnc(tutor(), payer(wallet));
  for (let i = 0; i < 4; i++) await e.submit('A long enough typed answer for this stage.'); // stages 2-5 (solid, no follow-ups)
  assert.equal(e.status().stage, 6);
  for (let i = 0; i < MAX_HINTS; i++) await e.hint();
  await e.extraHint();
  assert.equal(e.status().hints.extra, MAX_EXTRA_HINTS - 1);
  await e.submit(1);
  assert.equal(e.status().hints.free, MAX_HINTS);
  assert.equal(e.status().hints.extra, MAX_EXTRA_HINTS);
});

// ---- offline tutor: paid hints are real nudges ------------------------------

test('offline paid hints for every bank stage never reveal a concept label or the correct option', () => {
  const off = createOfflineTutor({ personaId: 'chen' });
  for (const [id, bank] of Object.entries(OFFLINE_BANK)) {
    const ctx = { subsection: { id, title: id }, mcqIndex: 0 };
    for (const n of [2, 3, 4, 5]) {
      const free = bank[n].hints.length;
      for (let i = free; i < free + 3; i++) {
        const h = off.hint(n, {}, i, ctx);
        assert.ok(typeof h === 'string' && h.length > 20, `${id} stage ${n} hint ${i}`);
        for (const label of bank[n].conceptLabels ?? []) assert.ok(!h.includes(label), `${id} stage ${n} leaks "${label}"`);
      }
    }
    const q = bank[6].questions[0];
    const h = off.hint(6, {}, q.hints.length, ctx);
    assert.ok(h.length > 20);
    assert.ok(!h.includes(q.options[q.correct]), `${id} checkpoint hint names the correct option`);
  }
  assert.match(extraStageNudge({ conceptLabels: ['a', 'b', 'c'] }, 0), /about 3/);
});

// ---- early brazier ----------------------------------------------------------

test('a brazier cannot be lit early for a district you have not studied at all', () => {
  const s = withMats({ precedentScrolls: 20 });
  const offer = brazierOffers(curriculum, s).find((o) => o.districtId === DISTRICT);
  assert.equal(offer.status, 'unvisited');
  const r = lightBrazierEarly(curriculum, s, DISTRICT);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-visited');
  assert.equal(r.save, s);
});

test('it needs the district\'s own region material, not just any', () => {
  const s = explored(withMats({ ink: 99, precedentScrolls: BRAZIER_COST - 1 }));
  assert.equal(brazierOffers(curriculum, s).find((o) => o.districtId === DISTRICT).status, 'poor');
  const r = lightBrazierEarly(curriculum, s, DISTRICT);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-materials');
});

test('lighting early pays, lights the brazier, and consolidates and unlocks nothing', () => {
  const s = explored(withMats({ precedentScrolls: BRAZIER_COST + 2 }));
  const before = computeStates(curriculum, s.progress);
  const r = lightBrazierEarly(curriculum, s, DISTRICT);
  assert.ok(r.ok);
  assert.equal(r.save.inventory.materials.precedentScrolls, 2);
  assert.ok(r.save.braziers.lit.includes(DISTRICT));
  assert.ok(r.save.braziers.early.includes(DISTRICT));
  assert.deepEqual(computeStates(curriculum, r.save.progress), before);
  assert.equal(r.save.progress, s.progress, 'progress is untouched: only the tutor moves it');
  const again = lightBrazierEarly(curriculum, r.save, DISTRICT);
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'already-lit');
  assert.equal(brazierOffers(curriculum, r.save).find((o) => o.districtId === DISTRICT).early, true);
});

test('an early flame survives syncBraziers, the journal marks it lit, and the next door stays locked', () => {
  const s = explored(withMats({ precedentScrolls: BRAZIER_COST }));
  const lit = lightBrazierEarly(curriculum, s, DISTRICT).save;
  const states = computeStates(curriculum, lit.progress);
  const synced = syncBraziers(lit, allDistricts(curriculum), states);
  assert.ok(synced.lit.has(DISTRICT));
  assert.ok(synced.save.braziers.early.includes(DISTRICT));
  const j = buildJournal(curriculum, lit);
  const d = j.tree.flatMap((m) => m.districts).find((x) => x.id === DISTRICT);
  assert.equal(d.lit, true);
  assert.notEqual(d.status, 'consolidated');
  const next = flattenSubsections(curriculum).find((x) => x.prerequisites.includes(FIRST));
  assert.ok(next, 'something depends on the first building');
  assert.equal(describeDoor(curriculum, lit.progress, next.id, {}).kind, 'locked');
});

test('the early-brazier record round-trips the save and bad entries are dropped', () => {
  const s = normaliseSave({ braziers: { lit: ['a', 'b'], early: ['a', 5, '', 'a'] } });
  assert.deepEqual(s.braziers.early, ['a']);
  assert.deepEqual(normaliseSave({}).braziers.early, []);
  assert.deepEqual(normaliseSave(JSON.parse(JSON.stringify(s))).braziers, s.braziers);
});
