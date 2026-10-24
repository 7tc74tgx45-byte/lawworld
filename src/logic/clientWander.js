// Where a client NPC stands and how it wanders (T12). Pure JS: no Phaser, no DOM. The scene supplies the collision
// function and a random source, so this is deterministic under test.

import { TILE, TILE_SIZE, blockedAt, tileCentre } from './worldQuery.js';

export const WANDER_SPEED = 26; // px per second: a slow amble
export const WANDER_RADIUS = 4 * TILE_SIZE; // clients stay near their district lane
export const TALK_DISTANCE = 44; // px: close enough to press E

/**
 * A walkable pixel position for a client in a region. Prefers the middle lane row of the given district
 * (the lane runs between two rows of doors), else any open path tile in the region. Null if none exists.
 */
export function clientSpawn(world, regionId, districtId, rng = Math.random) {
  const region = world.regions.find((r) => r.id === regionId);
  if (!region) return null;
  const open = (tx, ty) => !blockedAt(world, tx, ty);
  const pick = (tiles) => (tiles.length ? tiles[Math.min(tiles.length - 1, Math.floor(rng() * tiles.length))] : null);

  const dist = world.districts.find((d) => d.regionId === regionId && d.id === districtId);
  const lanes = [];
  const rects = dist ? [dist.rect] : world.districts.filter((d) => d.regionId === regionId).map((d) => d.rect);
  for (const r of rects) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const y = r.y + 3; // the middle lane row; signpost and brazier are blocked and filtered out
      if (open(x, y)) lanes.push({ tx: x, ty: y });
    }
  }
  let t = pick(lanes);
  if (!t) {
    const any = [];
    const { x, y, w, h } = region.rect;
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) if (world.tiles[ty * world.cols + tx] === TILE.PATH && open(tx, ty)) any.push({ tx, ty });
    t = pick(any);
  }
  return t ? tileCentre(t.tx, t.ty) : null;
}

export function createWanderer(x, y) {
  return { x, y, homeX: x, homeY: y, vx: 0, vy: 0, timer: 0.5, facing: 'down', walking: false };
}

const DIRS = [[1, 0, 'right'], [-1, 0, 'left'], [0, 1, 'down'], [0, -1, 'up']];

/**
 * Advance a wanderer by dt seconds (mutates and returns it).
 *  move(x, y, dx, dy) -> { x, y }   collision-aware movement (the scene passes moveWithCollision)
 *  hold: true while the player is close: the client stands still and waits
 */
export function stepWanderer(w, dt, { rng = Math.random, move, hold = false } = {}) {
  if (hold) {
    w.walking = false;
    w.vx = 0;
    w.vy = 0;
    return w;
  }
  w.timer -= dt;
  if (w.timer <= 0) {
    if (rng() < 0.4) {
      w.vx = 0;
      w.vy = 0;
      w.timer = 1 + rng() * 2; // stand and wait
    } else {
      let choices = DIRS;
      if (Math.hypot(w.x - w.homeX, w.y - w.homeY) > WANDER_RADIUS) {
        // too far from home: only directions that bring it back
        const back = DIRS.filter(([dx, dy]) => dx * (w.homeX - w.x) + dy * (w.homeY - w.y) > 0);
        if (back.length) choices = back;
      }
      const [dx, dy, face] = choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
      w.vx = dx;
      w.vy = dy;
      w.facing = face;
      w.timer = 0.8 + rng() * 1.4;
    }
  }
  if (w.vx || w.vy) {
    const step = WANDER_SPEED * dt;
    const p = move(w.x, w.y, w.vx * step, w.vy * step);
    const moved = p.x !== w.x || p.y !== w.y;
    w.x = p.x;
    w.y = p.y;
    w.walking = moved;
    if (!moved) w.timer = 0; // bumped into something: choose again next frame
  } else {
    w.walking = false;
  }
  return w;
}
