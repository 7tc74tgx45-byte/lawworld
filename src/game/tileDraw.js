// Draws world tiles onto a 2D canvas context. Programmatic pixel art, no image files.
// Each season has its own grass, flowers, shore sand, snow patches and trees (see palette.js, treeDraw.js).
import { TILE, TILE_SIZE, tileAt, zoneAt } from '../logic/worldQuery.js';
import { seasonPalette, seasonExtra } from './palette.js';
import { drawSeasonTree } from './treeDraw.js';

const S = TILE_SIZE;
const hash = (x, y, k = 0) => (Math.imul(x + k * 31, 73856093) ^ Math.imul(y - k * 17, 19349663)) >>> 0;
const R = (ctx, c, x, y, w, h) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

function flower(ctx, colours, x, y, h) {
  R(ctx, '#3f7a35', x + 1, y + 2, 1, 3);
  R(ctx, colours[h % colours.length], x, y, 3, 3);
  R(ctx, '#f4e27a', x + 1, y + 1, 1, 1);
}

function ground(ctx, season, tx, ty, px, py) {
  const pal = seasonPalette(season);
  const ex = seasonExtra(season);
  R(ctx, (tx + ty) % 2 ? pal.grassA : pal.grassB, px, py, S, S);
  const h = hash(tx, ty);
  // grass tufts (two or three small blades)
  R(ctx, ex.grassBlade, px + (h % 24) + 2, py + ((h >> 5) % 24) + 3, 1, 3);
  R(ctx, ex.grassBlade, px + (h % 24) + 4, py + ((h >> 5) % 24) + 4, 1, 2);
  R(ctx, pal.grassB, px + ((h >> 9) % 24) + 2, py + ((h >> 14) % 24) + 2, 3, 2);
  if (season === 'winter') {
    // snow drifts with a shaded underside, and the odd frost-flower
    if (h % 3 === 0) {
      const x = px + ((h >> 4) % 18) + 2;
      const y = py + ((h >> 10) % 20) + 4;
      R(ctx, '#ffffff', x, y, 9, 3);
      R(ctx, '#c4d4e0', x + 1, y + 3, 7, 1);
    }
    if (h % 17 === 0) flower(ctx, ex.flowers, px + ((h >> 8) % 24) + 3, py + ((h >> 13) % 22) + 3, h >> 3);
  } else if (season === 'autumn') {
    if (h % 5 === 0) R(ctx, ex.flowers[(h >> 6) % 3], px + ((h >> 8) % 26) + 2, py + ((h >> 13) % 26) + 2, 3, 2); // fallen leaf
    if (h % 23 === 0) flower(ctx, ex.flowers, px + ((h >> 8) % 24) + 3, py + ((h >> 13) % 22) + 3, h >> 3);
  } else if (h % (season === 'summer' ? 5 : 6) === 0) {
    flower(ctx, ex.flowers, px + ((h >> 8) % 24) + 3, py + ((h >> 13) % 22) + 3, h >> 3);
    if (season === 'summer' && h % 10 === 0) flower(ctx, ex.flowers, px + ((h >> 3) % 24) + 3, py + ((h >> 15) % 22) + 3, h >> 5);
  }
}

/** Sand where land meets water (a shore band drawn on the land side of the water). */
function shore(ctx, season, world, tx, ty, px, py) {
  const ex = seasonExtra(season);
  const isW = (dx, dy) => tileAt(world, tx + dx, ty + dy) === TILE.WATER;
  const t = isW(0, -1);
  const b = isW(0, 1);
  const l = isW(-1, 0);
  const r = isW(1, 0);
  if (!(t || b || l || r)) return;
  const sand = season === 'winter' ? '#e9f0f5' : ex.sand;
  if (t) { R(ctx, sand, px, py, S, 7); R(ctx, ex.sandDark, px, py + 7, S, 1); }
  if (b) { R(ctx, sand, px, py + S - 7, S, 7); R(ctx, ex.sandDark, px, py + S - 8, S, 1); }
  if (l) { R(ctx, sand, px, py, 7, S); R(ctx, ex.sandDark, px + 7, py, 1, S); }
  if (r) { R(ctx, sand, px + S - 7, py, 7, S); R(ctx, ex.sandDark, px + S - 8, py, 1, S); }
  const h = hash(tx, ty, 11);
  R(ctx, ex.sandDark, px + (h % 24) + 4, py + ((h >> 5) % 24) + 4, 2, 1);
}

function path(ctx, season, tx, ty, px, py) {
  const pal = seasonPalette(season);
  R(ctx, pal.path, px, py, S, S);
  const h = hash(tx, ty, 3);
  // cobbles
  R(ctx, pal.pathEdge, px + (h % 26) + 2, py + ((h >> 6) % 26) + 2, 4, 3);
  R(ctx, pal.pathEdge, px + ((h >> 11) % 26) + 2, py + ((h >> 3) % 26) + 2, 3, 3);
  R(ctx, 'rgba(255,255,255,0.12)', px, py, S, 1);
  R(ctx, 'rgba(0,0,0,0.08)', px, py + S - 1, S, 1);
  if (season === 'winter' && h % 3 === 0) R(ctx, 'rgba(255,255,255,0.8)', px + (h >> 4) % 20 + 2, py + (h >> 9) % 22 + 4, 8, 2);
  if (season === 'autumn' && h % 4 === 0) R(ctx, seasonExtra(season).flowers[h % 3], px + (h >> 5) % 24 + 3, py + (h >> 10) % 24 + 3, 3, 2);
  if (season === 'spring' && h % 6 === 0) R(ctx, '#f7c6da', px + (h >> 5) % 24 + 3, py + (h >> 10) % 24 + 3, 2, 2);
}

function water(ctx, season, tx, ty, px, py) {
  const pal = seasonPalette(season);
  R(ctx, pal.water, px, py, S, S);
  const h = hash(tx, ty, 5);
  const o = (h % 12) + 2;
  R(ctx, pal.waterLight, px + o, py + 8, 10, 2);
  R(ctx, pal.waterLight, px + ((o + 9) % 18) + 2, py + 21, 8, 2);
  if (season === 'winter') {
    // ice floes
    R(ctx, 'rgba(255,255,255,0.55)', px + (h >> 4) % 14 + 2, py + (h >> 9) % 16 + 4, 12, 6);
    R(ctx, 'rgba(255,255,255,0.85)', px + (h >> 4) % 14 + 3, py + (h >> 9) % 16 + 4, 10, 1);
  } else if (season === 'summer' && h % 9 === 0) {
    R(ctx, '#ffffff', px + (h >> 5) % 24 + 2, py + (h >> 10) % 24 + 2, 2, 1); // glints
  } else if (season === 'autumn' && h % 7 === 0) {
    R(ctx, seasonExtra(season).flowers[h % 3], px + (h >> 5) % 24 + 2, py + (h >> 10) % 24 + 2, 3, 2); // floating leaf
  } else if (season === 'spring' && h % 8 === 0) {
    R(ctx, '#f7c6da', px + (h >> 5) % 24 + 2, py + (h >> 10) % 24 + 2, 2, 2); // petal
  }
}

function fence(ctx, season, tx, ty, px, py, world) {
  const pal = seasonPalette(season);
  const link = (dx, dy) => tileAt(world, tx + dx, ty + dy) === TILE.FENCE;
  if (link(-1, 0) || link(1, 0)) {
    R(ctx, pal.fence, px, py + 11, S, 3);
    R(ctx, pal.fence, px, py + 19, S, 3);
    R(ctx, 'rgba(0,0,0,0.25)', px, py + 14, S, 1);
    R(ctx, 'rgba(0,0,0,0.25)', px, py + 22, S, 1);
    if (season === 'winter') { R(ctx, '#ffffff', px, py + 10, S, 2); R(ctx, '#ffffff', px, py + 18, S, 2); }
  }
  if (link(0, -1) || link(0, 1)) R(ctx, pal.fence, px + 14, py, 4, S);
  R(ctx, pal.fence, px + 13, py + 8, 6, 18); // post
  R(ctx, 'rgba(255,255,255,0.25)', px + 13, py + 8, 6, 2);
  R(ctx, 'rgba(0,0,0,0.22)', px + 17, py + 10, 2, 16);
  if (season === 'winter') R(ctx, '#ffffff', px + 12, py + 7, 8, 3);
}

/** Draw tile (tx, ty) at pixel offset (px, py) on ctx. */
export function drawTile(ctx, world, regionsByIndex, tx, ty, px, py) {
  const t = tileAt(world, tx, ty);
  const season = regionsByIndex[zoneAt(world, tx, ty)]?.season;
  switch (t) {
    case TILE.PATH:
    case TILE.SIGN:
    case TILE.BRAZIER:
      path(ctx, season, tx, ty, px, py);
      break;
    case TILE.WATER:
      water(ctx, season, tx, ty, px, py);
      break;
    case TILE.TREE:
      ground(ctx, season, tx, ty, px, py);
      drawSeasonTree(ctx, season, tx, ty, px, py);
      break;
    case TILE.FENCE:
      ground(ctx, season, tx, ty, px, py);
      fence(ctx, season, tx, ty, px, py, world);
      break;
    default:
      ground(ctx, season, tx, ty, px, py); // grass, and the ground under a building
      shore(ctx, season, world, tx, ty, px, py);
  }
}
