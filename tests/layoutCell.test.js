import test from 'node:test';
import assert from 'node:assert/strict';
import { curriculum } from '../src/data/curriculum.js';
import { allDistricts } from '../src/logic/curriculum.js';
import { layoutCell, packCells } from '../src/logic/layoutCell.js';

const overlaps = (a, b) => a.tx < b.tx + b.w && b.tx < a.tx + a.w && a.ty < b.ty + b.h && b.ty < a.ty + a.h;

test('every district cell: one building per subsection, none overlapping, doors on the lane and inside the cell', () => {
  for (const d of allDistricts(curriculum)) {
    const c = layoutCell(d);
    assert.equal(c.buildings.length, d.subsections.length);
    for (let i = 0; i < c.buildings.length; i++) {
      for (let j = i + 1; j < c.buildings.length; j++) assert.ok(!overlaps(c.buildings[i], c.buildings[j]), `${d.id}: overlap`);
      const b = c.buildings[i];
      assert.ok(!overlaps(b, { tx: c.signpost.tx, ty: c.signpost.ty, w: 1, h: 1 }));
      assert.ok(b.door.tx >= 0 && b.door.tx < c.w && b.door.ty >= 0 && b.door.ty < c.h);
      assert.ok(b.door.ty >= 2 && b.door.ty <= 4, 'door sits on the lane');
    }
  }
});

test('layout is deterministic', () => {
  const d = allDistricts(curriculum)[3];
  assert.deepEqual(layoutCell(d, 5, 7), layoutCell(d, 5, 7));
});

test('packCells never overlaps and respects the max width', () => {
  const items = [{ w: 20, h: 7 }, { w: 30, h: 7 }, { w: 25, h: 7 }, { w: 10, h: 7 }];
  const { pos } = packCells(items, 60);
  items.forEach((a, i) => items.forEach((b, j) => {
    if (j <= i) return;
    const A = { tx: pos[i].x, ty: pos[i].y, w: a.w, h: a.h };
    const B = { tx: pos[j].x, ty: pos[j].y, w: b.w, h: b.h };
    assert.ok(!overlaps(A, B));
  }));
  items.forEach((it, i) => assert.ok(pos[i].x + it.w <= 60));
});
