import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickKind, planRetrieval, retrievalQuestion, evaluateRetrievalItem, QUESTION_KINDS } from '../src/logic/retrieval.js';
import { needsWater, plantSeed, waterPlot, gardenView, GAME_DAY_MS, DAMP_MS, THIRSTY_DAYS } from '../src/logic/garden.js';
import { RETRIEVAL_BANK } from '../src/data/retrievalBank.js';
import { OFFLINE_BANK } from '../src/data/offlineBank.js';
import { createFreshSave, normaliseSave } from '../src/logic/save.js';

const T0 = Date.parse('2026-10-24T10:00:00.000Z');
const sub = { title: 'T', keyCases: ['Adams v Lindsell'], statutes: [] };

test('question kinds rotate through rule, case and apply as the plant is watered', () => {
  const seen = new Set();
  for (let w = 0; w < 3; w++) seen.add(pickKind({ concept: 'postal rule', waterings: w }, sub));
  assert.deepEqual([...seen].sort(), [...QUESTION_KINDS].sort());
  assert.match(retrievalQuestion({ concept: 'postal rule' }, sub, 'case'), /case/i);
  assert.match(retrievalQuestion({ concept: 'postal rule' }, sub, 'apply'), /client/i);
  assert.match(retrievalQuestion({ concept: 'postal rule' }, sub, 'rule'), /rule/i);
});

test('a case question is never asked where the building has no case or statute', () => {
  for (let w = 0; w < 6; w++) assert.notEqual(pickKind({ concept: 'x', waterings: w }, { title: 'T', keyCases: [], statutes: [] }), 'case');
});

test('the offline retrieval bank covers the five banked subsections with all three kinds', () => {
  const ids = Object.keys(OFFLINE_BANK).filter((id) => id.includes('.'));
  assert.equal(ids.length, 5 - 1 + 0, 'four curriculum banks plus the demo');
  for (const id of [...ids, 'contract-offer-acceptance']) {
    const items = RETRIEVAL_BANK[id];
    assert.ok(items, `retrieval bank for ${id}`);
    assert.deepEqual(items.map((i) => i.kind).sort(), ['apply', 'case', 'rule']);
  }
});

test('banked items: own model answer is solid, waffle is not, and the plan uses the bank offline only', () => {
  const waffle = 'I think this is quite an interesting area and there are many different views about it, so it is hard to say.';
  for (const [id, items] of Object.entries(RETRIEVAL_BANK)) {
    for (const item of items) {
      assert.equal(evaluateRetrievalItem(item.model, item, { concept: 'c' }).verdict, 'solid', `${id} ${item.kind} model answer`);
      const bad = evaluateRetrievalItem(waffle, item, { concept: 'c' });
      assert.notEqual(bad.verdict, 'solid', `${id} ${item.kind} waffle`);
      assert.match(bad.feedback, /model answer/i, 'a non-solid answer is taught the point');
    }
  }
  const plot = { concept: 'objective test', subsectionId: 'contract-agreement.objective-approach', waterings: 2 };
  const offline = planRetrieval(plot, sub, { bank: RETRIEVAL_BANK[plot.subsectionId], useBank: true });
  assert.ok(offline.item);
  const claude = planRetrieval(plot, sub, { bank: RETRIEVAL_BANK[plot.subsectionId], useBank: false });
  assert.equal(claude.item, null);
});

test('a confidently wrong banked application answer is not solid', () => {
  const item = RETRIEVAL_BANK['contract-intro.what-is-contract'].find((i) => i.kind === 'apply');
  const ev = evaluateRetrievalItem('Issue: is there a contract. Rule: consideration. The promise is legally binding and Theo will win, so there is a valid contract.', item, { concept: 'c' });
  assert.notEqual(ev.verdict, 'solid');
});

test('needs-water: thirsty after a day, not while damp, withered counts, empty never', () => {
  const s = plantSeed({ ...createFreshSave(T0), inventory: { ...createFreshSave(T0).inventory, seeds: 1 } }, 'plot-0', { subsectionId: 'a', concept: 'x' }, T0).save;
  const plot = s.garden.plots[0];
  assert.equal(needsWater(plot, T0 + 1000), false);
  assert.equal(needsWater(plot, T0 + THIRSTY_DAYS * GAME_DAY_MS - 1000), false);
  assert.equal(needsWater(plot, T0 + THIRSTY_DAYS * GAME_DAY_MS + 1000), true);
  assert.equal(needsWater(plot, T0 + 4 * GAME_DAY_MS), true, 'withered');
  assert.equal(needsWater(null, T0), false);
  const view = gardenView(s, T0 + 2 * GAME_DAY_MS);
  assert.equal(view[0].thirsty, true);
  assert.equal(view[1].thirsty, undefined, 'empty plots carry no flag');
  const watered = waterPlot(s, 'plot-0', 'solid', T0 + 2 * GAME_DAY_MS).save;
  assert.equal(gardenView(watered, T0 + 2 * GAME_DAY_MS + DAMP_MS / 2)[0].thirsty, false);
});

test('every watering round is counted (even a miss) and survives a save round-trip', () => {
  const base = createFreshSave(T0);
  let s = plantSeed({ ...base, inventory: { ...base.inventory, seeds: 1 } }, 'plot-0', { subsectionId: 'a', concept: 'x' }, T0).save;
  s = waterPlot(s, 'plot-0', 'missing', T0 + DAMP_MS + 1).save;
  assert.equal(s.garden.plots[0].waterings, 1);
  s = waterPlot(s, 'plot-0', 'partial', T0 + DAMP_MS + 2).save;
  assert.equal(normaliseSave(JSON.parse(JSON.stringify(s))).garden.plots[0].waterings, 2);
  assert.equal(normaliseSave({ garden: { plots: [{ id: 'plot-0', subsectionId: 'a', concept: 'x' }] } }).garden.plots[0].waterings, 0, 'old saves default to 0');
});
