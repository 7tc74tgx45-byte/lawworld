import test from 'node:test';
import assert from 'node:assert/strict';
import { curriculum } from '../src/data/curriculum.js';
import { flattenSubsections } from '../src/logic/curriculum.js';
import { buildWorld } from '../src/logic/layout.js';
import {
  TILE, TILE_SIZE, blockedAt, tileAt, reachableFrom, pathExists, regionAt, moveWithCollision, doorNear, tileCentre,
} from '../src/logic/worldQuery.js';

const world = buildWorld(curriculum);
const overlaps = (a, b) => a.tx < b.tx + b.w && b.tx < a.tx + a.w && a.ty < b.ty + b.h && b.ty < a.ty + a.h;

test('one building per subsection, with unique ids', () => {
  const subs = flattenSubsections(curriculum);
  assert.equal(world.buildings.length, subs.length);
  assert.equal(new Set(world.buildings.map((b) => b.id)).size, subs.length);
  for (const s of subs) assert.ok(world.buildings.some((b) => b.id === s.id), s.id);
});

test('no two buildings overlap, and all stay inside the map', () => {
  const bs = world.buildings;
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i];
    assert.ok(a.tx >= 0 && a.ty >= 0 && a.tx + a.w <= world.cols && a.ty + a.h <= world.rows, a.id);
    for (let j = i + 1; j < bs.length; j++) assert.ok(!overlaps(a, bs[j]), `${a.id} overlaps ${bs[j].id}`);
  }
});

test('buildings are solid, doors are walkable', () => {
  for (const b of world.buildings) {
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) assert.ok(blockedAt(world, b.tx + x, b.ty + y), `${b.id} body`);
    assert.ok(!blockedAt(world, b.door.tx, b.door.ty), `${b.id} door tile is blocked`);
  }
});

test('every door is reachable from the hub spawn', () => {
  assert.ok(world.spawn);
  assert.ok(!blockedAt(world, world.spawn.tx, world.spawn.ty));
  const seen = reachableFrom(world, world.spawn);
  for (const b of world.buildings) assert.equal(seen[b.door.ty * world.cols + b.door.tx], 1, `${b.id} unreachable`);
  for (const d of world.districts) {
    // the tile in front of the signpost is part of the lane and must be reachable too
    assert.equal(seen[(d.signpost.ty + 1) * world.cols + d.signpost.tx], 1, `${d.id} signpost`);
  }
});

test('each district has a signpost and a brazier that block movement', () => {
  const nDistricts = curriculum.modules.flatMap((m) => m.regions.flatMap((r) => r.districts)).length;
  assert.equal(world.districts.length, nDistricts);
  for (const d of world.districts) {
    assert.equal(tileAt(world, d.signpost.tx, d.signpost.ty), TILE.SIGN);
    assert.equal(tileAt(world, d.brazier.tx, d.brazier.ty), TILE.BRAZIER);
  }
});

test('hub is in the centre with Contract east, Tort south and Public Law north', () => {
  const [hub, contract, tort, pl] = world.regions;
  assert.equal(hub.isHub, true);
  assert.equal(hub.season, 'spring');
  assert.deepEqual([contract.season, tort.season, pl.season], ['summer', 'autumn', 'winter']);
  const mid = (r) => ({ x: r.rect.x + r.rect.w / 2, y: r.rect.y + r.rect.h / 2 });
  assert.ok(mid(contract).x > mid(hub).x);
  assert.ok(mid(tort).y > mid(hub).y);
  assert.ok(mid(pl).y < mid(hub).y);
  // regions do not overlap
  const rs = world.regions.map((r) => ({ tx: r.rect.x, ty: r.rect.y, w: r.rect.w, h: r.rect.h }));
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) assert.ok(!overlaps(rs[i], rs[j]));
});

test('each building belongs to the region its module defines', () => {
  for (const b of world.buildings) {
    const r = regionAt(world, b.door.tx, b.door.ty);
    assert.equal(r?.id, b.regionId, b.id);
  }
});

test('the map border is water, so the player cannot leave the world', () => {
  for (let x = 0; x < world.cols; x++) {
    assert.ok(blockedAt(world, x, 0));
    assert.ok(blockedAt(world, x, world.rows - 1));
  }
  assert.ok(blockedAt(world, -1, 5));
  assert.ok(blockedAt(world, world.cols, 5));
});

test('layout is deterministic, and a new district adds buildings without hand-editing', () => {
  const again = buildWorld(curriculum);
  assert.deepEqual(Array.from(again.tiles), Array.from(world.tiles));
  assert.deepEqual(again.buildings, world.buildings);

  const extra = structuredClone(curriculum);
  const region = extra.modules[1].regions[0];
  region.districts.push({
    id: 'contract-new', title: 'New chapter', sourceFile: 'x.md', source: 'vault',
    subsections: [1, 2, 3].map((n) => ({ id: `contract-new.s${n}`, title: `S${n}`, sourceFile: 'x.md', heading: `S${n}`, keyConcepts: [], keyCases: [], statutes: [], prerequisites: [], suggestedTutor: 'chen' })),
  });
  const bigger = buildWorld(extra);
  assert.equal(bigger.buildings.length, world.buildings.length + 3);
  const seen = reachableFrom(bigger, bigger.spawn);
  for (const b of bigger.buildings) assert.equal(seen[b.door.ty * bigger.cols + b.door.tx], 1, `${b.id} unreachable`);
});

test('pathExists, collision and door lookup', () => {
  const b = world.buildings[0];
  assert.ok(pathExists(world, world.spawn, b.door));
  assert.ok(!pathExists(world, world.spawn, { tx: 0, ty: 0 }), 'water is not reachable');

  // walking into a building is stopped, sliding along it still works
  const c = tileCentre(b.door.tx, b.door.ty);
  const towards = b.side === 'top' ? -1 : 1;
  let p = { x: c.x, y: c.y };
  for (let i = 0; i < 40; i++) p = moveWithCollision(world, p.x, p.y, 0, towards * 4);
  const tyEnd = Math.floor(p.y / TILE_SIZE);
  assert.ok(!blockedAt(world, b.door.tx, tyEnd), 'player ended inside a solid tile');

  assert.equal(doorNear(world, c.x, c.y, b.side === 'top' ? 'up' : 'down')?.id, b.id);
  assert.equal(doorNear(world, 5, 5), null);
});
