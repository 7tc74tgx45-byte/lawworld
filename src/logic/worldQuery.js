// Pure queries over a generated world (see layout.js): tiles, collision, reachability, doors. No Phaser, no DOM.
//
// world = { cols, rows, tiles: Uint8Array (TILE ids), zones: Uint8Array (nearest region index per tile),
//           regions: [{ id, title, season, rect }], buildings: [...], ... }

export const TILE = { GRASS: 0, PATH: 1, TREE: 2, WATER: 3, FENCE: 4, BUILDING: 5, SIGN: 6, BRAZIER: 7 };
export const TILE_SIZE = 32;

/** Trees, water, fences, buildings, signposts and braziers all block the player. */
export const isBlockedTile = (t) => t >= TILE.TREE && t !== undefined;

export function tileAt(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return TILE.WATER;
  return world.tiles[ty * world.cols + tx];
}

export const blockedAt = (world, tx, ty) => isBlockedTile(tileAt(world, tx, ty));

/** Index of the nearest region (used to pick the season palette, including outside every region). */
export function zoneAt(world, tx, ty) {
  const x = Math.min(world.cols - 1, Math.max(0, tx));
  const y = Math.min(world.rows - 1, Math.max(0, ty));
  return world.zones[y * world.cols + x];
}

/** The region whose area (including its tree border) contains the tile; null on the paths between regions. */
export function regionAt(world, tx, ty) {
  return world.regions.find((r) => tx >= r.rect.x && ty >= r.rect.y && tx < r.rect.x + r.rect.w && ty < r.rect.y + r.rect.h) ?? null;
}

/** Breadth-first flood fill over walkable tiles (4-neighbour). Returns a Uint8Array, 1 = reachable. */
export function reachableFrom(world, start) {
  const seen = new Uint8Array(world.cols * world.rows);
  if (blockedAt(world, start.tx, start.ty)) return seen;
  const queue = [start.ty * world.cols + start.tx];
  seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % world.cols;
    const y = (i - x) / world.cols;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= world.cols || ny >= world.rows) continue;
      const j = ny * world.cols + nx;
      if (seen[j] || isBlockedTile(world.tiles[j])) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return seen;
}

export function pathExists(world, from, to) {
  return reachableFrom(world, from)[to.ty * world.cols + to.tx] === 1;
}

/** Does a square of half-size `half` px centred on (x, y) touch a blocking tile? */
export function boxBlocked(world, x, y, half = 6) {
  const x0 = Math.floor((x - half) / TILE_SIZE);
  const x1 = Math.floor((x + half - 0.001) / TILE_SIZE);
  const y0 = Math.floor((y - half) / TILE_SIZE);
  const y1 = Math.floor((y + half - 0.001) / TILE_SIZE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (blockedAt(world, tx, ty)) return true;
  return false;
}

/** Move by (dx, dy) pixels, one axis at a time so the player slides along walls. Keep steps well under a tile. */
export function moveWithCollision(world, x, y, dx, dy, half = 6) {
  let nx = x;
  let ny = y;
  if (dx && !boxBlocked(world, x + dx, y, half)) nx = x + dx;
  if (dy && !boxBlocked(world, nx, y + dy, half)) ny = y + dy;
  return { x: nx, y: ny };
}

/** Centre of a tile in pixels. */
export const tileCentre = (tx, ty) => ({ x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 });

/**
 * The building whose door the player (pixel position) is standing at, or null.
 * Within ~1.2 tiles of the door tile; when two doors are close (lane middle row) the one the player faces wins.
 */
export function doorNear(world, px, py, facing = 'down') {
  let best = null;
  let bestScore = Infinity;
  for (const b of world.buildings) {
    const c = tileCentre(b.door.tx, b.door.ty);
    const d = Math.hypot(c.x - px, c.y - py);
    if (d > TILE_SIZE * 1.2) continue;
    const faced = (b.side === 'top' && facing === 'up') || (b.side === 'bottom' && facing === 'down');
    const score = d - (faced ? 10 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}
