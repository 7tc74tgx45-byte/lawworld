import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PORTRAIT_IDS, PORTRAIT_SIZE, buildPortrait, portraitIdFor, usedColours } from '../src/logic/portraits.js';
import { TUTOR_LIST } from '../src/data/tutors.js';

test('every persona and Ms Patel have a portrait design', () => {
  for (const t of TUTOR_LIST) assert.ok(PORTRAIT_IDS.includes(t.id), t.id);
  assert.ok(PORTRAIT_IDS.includes('patel'));
  assert.equal(portraitIdFor('nobody'), 'chen');
});

test('designs stay inside 64x64, use only palette colours, and have about 20 colours', () => {
  for (const id of PORTRAIT_IDS) {
    const d = buildPortrait(id);
    assert.equal(PORTRAIT_SIZE, 64);
    for (const [x, y, w, h, key] of d.rects) {
      assert.ok(d.palette[key], `${id}: unknown colour key ${key}`);
      assert.ok(Number.isInteger(x) && Number.isInteger(y) && w > 0 && h > 0, `${id}: bad rect`);
      assert.ok(x >= 0 && y >= 0 && x + w <= 64 && y + h <= 64, `${id}: rect out of bounds ${[x, y, w, h]}`);
      assert.match(d.palette[key], /^#[0-9a-f]{6}$/i);
    }
    const n = usedColours(d).size;
    assert.ok(n >= 17 && n <= 30, `${id}: ${n} colours`);
  }
});

test('the portraits are distinct pictures with distinct robe colours', () => {
  const robes = PORTRAIT_IDS.map((id) => buildPortrait(id).palette.robe);
  assert.equal(new Set(robes).size, robes.length);
  const sigs = PORTRAIT_IDS.map((id) => JSON.stringify(buildPortrait(id).rects));
  assert.equal(new Set(sigs).size, sigs.length);
});
