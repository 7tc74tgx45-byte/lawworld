// Draws world tiles onto a 2D canvas context. Programmatic pixel art, no image files.
import { TILE, TILE_SIZE, tileAt, zoneAt } from '../logic/worldQuery.js';
import { seasonPalette } from './palette.js';

const S = TILE_SIZE;
const hash = (x, y, k = 0) => (Math.imul(x + k * 31, 73856093) ^ Math.imul(y - k * 17, 19349663)) >>> 0;

function ground(ctx, pal, tx, ty, px, py) {
  ctx.fillStyle = (tx + ty) % 2 ? pal.grassA : pal.grassB;
  ctx.fillRect(px, py, S, S);
  const h = hash(tx, ty);
  ctx.fillStyle = pal.grassB;
  ctx.fillRect(px + (h % 24) + 2, py + ((h >> 5) % 24) + 2, 3, 2);
  if (h % 7 === 0) {
    ctx.fillStyle = pal.fleck;
    ctx.fillRect(px + ((h >> 8) % 26) + 2, py + ((h >> 13) % 26) + 2, 3, 3);
  }
}

function path(ctx, pal, tx, ty, px, py) {
  ctx.fillStyle = pal.path;
  ctx.fillRect(px, py, S, S);
  ctx.fillStyle = pal.pathEdge;
  const h = hash(tx, ty, 3);
  ctx.fillRect(px + (h % 26) + 2, py + ((h >> 6) % 26) + 2, 4, 3);
  ctx.fillRect(px + ((h >> 11) % 26) + 2, py + ((h >> 3) % 26) + 2, 3, 3);
}

function water(ctx, pal, tx, ty, px, py) {
  ctx.fillStyle = pal.water;
  ctx.fillRect(px, py, S, S);
  ctx.fillStyle = pal.waterLight;
  const h = hash(tx, ty, 5);
  const o = (h % 12) + 2;
  ctx.fillRect(px + o, py + 8, 10, 2);
  ctx.fillRect(px + ((o + 9) % 18) + 2, py + 21, 8, 2);
}

function tree(ctx, pal, tx, ty, px, py) {
  ground(ctx, pal, tx, ty, px, py);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(px + 6, py + 26, 20, 4);
  ctx.fillStyle = pal.trunk;
  ctx.fillRect(px + 13, py + 18, 6, 11);
  ctx.fillStyle = pal.treeDark;
  ctx.fillRect(px + 4, py + 7, 24, 14);
  ctx.fillRect(px + 8, py + 3, 16, 22);
  ctx.fillStyle = pal.tree;
  ctx.fillRect(px + 6, py + 6, 20, 11);
  ctx.fillRect(px + 10, py + 3, 12, 6);
  ctx.fillStyle = pal.fleck;
  const h = hash(tx, ty, 9);
  ctx.fillRect(px + 8 + (h % 14), py + 7 + ((h >> 4) % 8), 3, 3);
}

function fence(ctx, pal, tx, ty, px, py, world) {
  ground(ctx, pal, tx, ty, px, py);
  const link = (dx, dy) => tileAt(world, tx + dx, ty + dy) === TILE.FENCE;
  ctx.fillStyle = pal.fence;
  if (link(-1, 0) || link(1, 0)) {
    ctx.fillRect(px, py + 11, S, 3);
    ctx.fillRect(px, py + 19, S, 3);
  }
  if (link(0, -1) || link(0, 1)) ctx.fillRect(px + 14, py, 4, S);
  ctx.fillRect(px + 13, py + 8, 6, 18); // post
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(px + 13, py + 8, 6, 2);
}

/** Draw tile (tx, ty) at pixel offset (px, py) on ctx. */
export function drawTile(ctx, world, regionsByIndex, tx, ty, px, py) {
  const t = tileAt(world, tx, ty);
  const pal = seasonPalette(regionsByIndex[zoneAt(world, tx, ty)]?.season);
  switch (t) {
    case TILE.PATH:
    case TILE.SIGN:
    case TILE.BRAZIER:
      path(ctx, pal, tx, ty, px, py);
      break;
    case TILE.WATER:
      water(ctx, pal, tx, ty, px, py);
      break;
    case TILE.TREE:
      tree(ctx, pal, tx, ty, px, py);
      break;
    case TILE.FENCE:
      fence(ctx, pal, tx, ty, px, py, world);
      break;
    default:
      ground(ctx, pal, tx, ty, px, py); // grass, and the ground under a building
  }
}
