import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFLINE_BANK } from '../src/data/offlineBank.js';
import { looksLikeKeywordList } from '../src/logic/keywordEval.js';

const STUFF = 'Issue: whether contract. Rule held. Fisher v Bell, Pharmaceutical Society v Boots, Carlill, Hyde v Wrench, Harvey v Facey, Adams v Lindsell, Byrne, Entores, invitation to treat, offer, acceptance, till, display, shelf, mispriced, therefore conclusion no contract, because here Alice Bob.';

test('a comma-separated pile of keywords is never solid offline (stages 2, 3, 5)', () => {
  assert.equal(looksLikeKeywordList(STUFF), true);
  const b = OFFLINE_BANK['contract-offer-acceptance'];
  for (const n of [2, 3, 4, 5]) assert.notEqual(b[n].evaluation(STUFF).verdict, 'solid', `stage ${n}`);
});

test('ordinary prose is not flagged as a keyword list', () => {
  assert.equal(looksLikeKeywordList('A shop display is only an invitation to treat, so the customer makes the offer at the till.'), false);
  assert.equal(looksLikeKeywordList('short, list'), false);
});
