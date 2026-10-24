import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFLINE_BANK } from '../src/data/offlineBank.js';

import { createOfflineTutor } from '../src/api/offlineTutor.js';

test('offline tutor takes its name and colour from the chosen persona', () => {
  const t = createOfflineTutor({ personaId: 'okafor' });
  assert.match(t.name, /Okafor/);
  assert.equal(t.offline, true);
  assert.match(createOfflineTutor().name, /Hale/);
});

// Sanity check on the offline banks themselves: the bank's own model answer must earn "solid" from its own
// evaluator (otherwise a player who writes exactly the right thing would be marked down), and an unrelated
// answer must never be solid.
const IDS = Object.keys(OFFLINE_BANK).filter((id) => id.includes('.'));
const WAFFLE = 'I think this is quite an interesting area and there are many different views about it, so it is hard to say.';

for (const id of IDS) {
  test(`bank ${id}: own model answers are solid, waffle is not`, () => {
    for (const n of [2, 3, 4, 5]) {
      const st = OFFLINE_BANK[id][n];
      const own = st.evaluation(st.modelAnswer);
      assert.equal(own.verdict, 'solid', `${id} stage ${n} model answer scored ${own.verdict}: ${own.feedback}`);
      const bad = st.evaluation(WAFFLE);
      assert.notEqual(bad.verdict, 'solid', `${id} stage ${n} waffle`);
      assert.ok(bad.followUp, `${id} stage ${n} waffle should get a follow-up`);
    }
  });
}
