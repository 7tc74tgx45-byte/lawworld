import test from 'node:test';
import assert from 'node:assert/strict';
import { walkFrame, facingFromVector, playerTextureKey, FACINGS, PLAYER_STRIDE } from '../src/logic/anim.js';
import { createCat, updateCat, catFrame, pickBesideSpot, CAT } from '../src/logic/cat.js';
import { weatherFor, makeRng, makeParticles, stepParticle, KIND_TEXTURES, WEATHER } from '../src/logic/weather.js';
import { SEASON_EXTRA, SEASON_PALETTE } from '../src/game/palette.js';

test('walk frames alternate 0/1 with distance and never exceed 1', () => {
  assert.equal(walkFrame(0), 0);
  assert.equal(walkFrame(PLAYER_STRIDE), 1);
  assert.equal(walkFrame(PLAYER_STRIDE * 2), 0);
  for (let d = 0; d < 200; d += 3) assert.ok([0, 1].includes(walkFrame(d)));
});

test('facing from vector, and a standing pose when not moving', () => {
  assert.equal(facingFromVector(0, -1), 'up');
  assert.equal(facingFromVector(1, 0), 'right');
  assert.equal(facingFromVector(-0.7, 0.7), 'down');
  assert.equal(facingFromVector(0, 0, 'left'), 'left');
  assert.equal(playerTextureKey('left', false, 99), 'player-left-2');
  assert.match(playerTextureKey('up', true, 0), /^player-up-[01]$/);
  assert.equal(playerTextureKey('nonsense', false, 0), 'player-down-2');
  assert.equal(FACINGS.length, 4);
});

const run = (cat, player, seconds, opts, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) updateCat(cat, dt, player, opts);
};

test('cat follows the player along the player path, with a delay', () => {
  const player = { x: 100, y: 100 };
  const cat = createCat(100, 100);
  // player walks right 300px at 150px/s, then down 150px
  const dt = 1 / 60;
  const seen = [];
  for (let i = 0; i < 120; i++) { player.x += 150 * dt; updateCat(cat, dt, player); seen.push({ ...cat }); }
  for (let i = 0; i < 60; i++) { player.y += 150 * dt; updateCat(cat, dt, player); seen.push({ ...cat }); }
  const d = Math.hypot(cat.x - player.x, cat.y - player.y);
  assert.ok(d > 10, `cat should lag behind (${d})`);
  assert.ok(d < CAT.followDist * 4, `but stay close (${d})`);
  // it took the corner: while the player went down, the cat never cut diagonally through the empty inside of the L
  const corner = { x: 100 + 300, y: 100 };
  for (const s of seen) {
    if (s.y > 100.5) assert.ok(s.x > corner.x - 40, 'cat only turns near the corner the player turned at');
  }
});

test('cat catches up, then stands, then sits when the player stops', () => {
  const player = { x: 0, y: 0 };
  const cat = createCat(0, 0);
  for (let i = 0; i < 90; i++) { player.x += 2.5; updateCat(cat, 1 / 60, player); }
  assert.equal(cat.mode, 'walk');
  run(cat, player, 3);
  assert.equal(cat.mode, 'sit');
  assert.ok(Math.hypot(cat.x - player.x, cat.y - player.y) <= CAT.followDist + CAT.trailStep + 1); // trail points are trailStep apart
  assert.match(catFrame(cat).key, /^cat-sit-[012]$/);
});

test('sitting cat flicks its tail: frames vary over time', () => {
  const cat = createCat(0, 0);
  cat.mode = 'sit';
  const frames = new Set();
  for (let t = 0; t < CAT.flickPeriod; t += 0.05) { cat.t = t; frames.add(catFrame(cat).key); }
  assert.ok(frames.size >= 2);
});

test('during an encounter the cat walks beside the player and sits', () => {
  const player = { x: 500, y: 500 };
  const cat = createCat(420, 480);
  run(cat, player, 3, { encounter: true });
  assert.equal(cat.mode, 'sit');
  const d = Math.hypot(cat.x - player.x, cat.y - player.y);
  assert.ok(d < 30 && d > 5, `beside, not on top (${d})`);
});

test('beside spot skips blocked positions', () => {
  const player = { x: 100, y: 100 };
  const right = pickBesideSpot(player);
  const next = pickBesideSpot(player, (x) => x > player.x);
  assert.ok(right.x > player.x);
  assert.ok(next.x < player.x);
});

test('cat snaps to the player after a teleport', () => {
  const cat = createCat(0, 0);
  updateCat(cat, 1 / 60, { x: 5000, y: 5000 });
  assert.ok(Math.hypot(cat.x - 5000, cat.y - 5000) < 5);
});

test('walking cat uses two frames and flips for left', () => {
  const cat = createCat(0, 0);
  cat.mode = 'walk';
  cat.dir = -1;
  const keys = new Set();
  for (let d = 0; d < 40; d += 1) { cat.walkDist = d; keys.add(catFrame(cat).key); }
  assert.deepEqual([...keys].sort(), ['cat-walk-0', 'cat-walk-1']);
  assert.equal(catFrame(cat).flipX, true);
});

test('each season has its own weather kind', () => {
  assert.deepEqual(
    ['spring', 'summer', 'autumn', 'winter'].map((s) => weatherFor(s).kind),
    ['petal', 'mote', 'leaf', 'snow'],
  );
  assert.equal(weatherFor('nonsense').kind, 'petal');
  for (const k of Object.values(WEATHER).map((w) => w.kind)) assert.ok(KIND_TEXTURES[k].length >= 1);
});

test('weather particles stay inside the view (wrapping) and are deterministic', () => {
  const a = makeParticles('snow', 50, makeRng(7), 800, 600);
  const b = makeParticles('snow', 50, makeRng(7), 800, 600);
  assert.deepEqual(a, b);
  for (const kind of ['petal', 'mote', 'leaf', 'snow']) {
    const ps = makeParticles(kind, 40, makeRng(3), 800, 600);
    for (let i = 0; i < 600; i++) for (const p of ps) stepParticle(p, kind, 1 / 30, 800, 600);
    for (const p of ps) assert.ok(p.x >= -13 && p.x <= 813 && p.y >= -13 && p.y <= 613, `${kind} ${p.x},${p.y}`);
  }
});

test('falling kinds move down, motes drift up', () => {
  const [s] = makeParticles('snow', 1, makeRng(1), 800, 600);
  const y0 = s.y;
  stepParticle(s, 'snow', 0.1, 800, 600);
  assert.ok(s.y > y0 || s.y < 0);
  const [m] = makeParticles('mote', 1, makeRng(1), 800, 600);
  const my = m.y;
  stepParticle(m, 'mote', 0.1, 800, 600);
  assert.ok(m.y < my || m.y > 600);
});

test('every season has a palette and extras (grass, sand, trees, flowers)', () => {
  for (const s of ['spring', 'summer', 'autumn', 'winter']) {
    assert.ok(SEASON_PALETTE[s].grassA && SEASON_PALETTE[s].path);
    const e = SEASON_EXTRA[s];
    assert.ok(e.sand && e.sandDark && e.canopy.length === 3 && e.flowers.length >= 3);
  }
  const canopies = new Set(Object.values(SEASON_EXTRA).map((e) => e.canopy[0]));
  assert.equal(canopies.size, 4, 'trees differ per season');
});
