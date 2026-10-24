// Buildings: shingled roof (with chimney and seasonal dressing), timber-framed wall, framed door with step, shuttered
// windows. The wall/roof/door colours show the progress state; the season only changes the dressing. No image files.
import { STATE_STYLE, seasonExtra } from './palette.js';
import { BLD_W, BLD_H } from '../logic/layoutCell.js';
import { TILE_SIZE } from '../logic/worldQuery.js';

const S = TILE_SIZE;
export const BLD_PX_W = BLD_W * S;
export const BLD_PX_H = BLD_H * S;
const ROOF_H = 30;

const R = (ctx, c, x, y, w, h) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};
const DARK = 'rgba(0,0,0,0.28)';
const LIGHT = 'rgba(255,255,255,0.16)';

/** Padlock / half / tick marks, drawn on the roof. */
function mark(ctx, kind, x, y) {
  if (kind === 'padlock') {
    R(ctx, '#d8d8e0', x + 3, y, 2, 3);
    R(ctx, '#d8d8e0', x + 9, y, 2, 3);
    R(ctx, '#d8d8e0', x + 3, y, 8, 2);
    R(ctx, '#f2c94c', x, y + 5, 14, 10);
    R(ctx, '#7a5a10', x, y + 14, 14, 1);
    R(ctx, '#7a5a10', x + 6, y + 8, 2, 4);
  } else if (kind === 'tick') {
    R(ctx, '#ffffff', x - 1, y - 1, 17, 17);
    R(ctx, '#2b7a40', x, y, 15, 15);
    R(ctx, '#ffffff', x + 2, y + 8, 3, 3);
    R(ctx, '#ffffff', x + 5, y + 10, 3, 3);
    R(ctx, '#ffffff', x + 8, y + 7, 3, 3);
    R(ctx, '#ffffff', x + 10, y + 4, 3, 3);
    R(ctx, '#ffffff', x + 12, y + 2, 2, 3);
  } else if (kind === 'half') {
    R(ctx, '#ffffff', x - 1, y - 1, 17, 17);
    R(ctx, '#9a6a1c', x, y, 15, 15);
    R(ctx, '#ffe9a8', x + 2, y + 2, 5, 11);
    R(ctx, '#ffe9a8', x + 8, y + 2, 5, 11);
    R(ctx, '#9a6a1c', x + 7, y + 2, 1, 11);
  }
}

function roof(ctx, st, season, ex, y, outerTop) {
  // base and shingle rows (staggered)
  R(ctx, st.roof, 0, y, BLD_PX_W, ROOF_H);
  for (let r = 0; r < 4; r++) {
    const ry = y + 3 + r * 7;
    R(ctx, DARK, 0, ry + 4, BLD_PX_W, 1);
    for (let x = (r % 2) * 6; x < BLD_PX_W; x += 12) R(ctx, DARK, x, ry, 1, 5);
    R(ctx, LIGHT, 0, ry, BLD_PX_W, 1);
  }
  // ridge on the outer edge, eave shadow on the lane edge
  R(ctx, 'rgba(255,255,255,0.28)', 0, outerTop ? y : y + ROOF_H - 2, BLD_PX_W, 2);
  R(ctx, 'rgba(0,0,0,0.35)', 0, outerTop ? y + ROOF_H - 3 : y, BLD_PX_W, 3);
  // chimney on the outer edge
  const cx = 8;
  const cy = outerTop ? y - 0 : y + ROOF_H - 12;
  R(ctx, '#6b5a50', cx, cy, 9, 12);
  R(ctx, '#4a3c34', cx, cy + (outerTop ? 0 : 10), 9, 2);
  R(ctx, 'rgba(255,255,255,0.15)', cx, cy, 2, 12);
  // seasonal dressing
  const edge = outerTop ? y : y + ROOF_H - 6;
  if (ex.roofDress === 'snow') {
    R(ctx, '#ffffff', 0, edge, BLD_PX_W, 6);
    R(ctx, '#dfeaf2', 0, edge + (outerTop ? 6 : 0), BLD_PX_W, 1);
    for (let x = 4; x < BLD_PX_W; x += 11) R(ctx, '#ffffff', x, edge + (outerTop ? 6 : -2), 5, 2);
    R(ctx, '#ffffff', cx - 1, cy - 2 + (outerTop ? 0 : 0), 11, 3);
  } else if (ex.roofDress === 'moss') {
    for (const [x, w] of [[22, 6], [47, 5], [70, 7]]) R(ctx, '#6fae62', x, y + 8 + ((x * 7) % 12), w, 2);
  } else if (ex.roofDress === 'leaves') {
    for (const [x, c] of [[24, 0], [52, 1], [76, 0]]) R(ctx, ex.accent[c], x, y + 6 + ((x * 5) % 14), 3, 2);
  }
  void season;
}

function window_(ctx, st, x, y, glow) {
  R(ctx, '#3a2c20', x - 2, y - 2, 16, 14);
  R(ctx, glow ? '#ffe9a8' : '#a9c4d6', x, y, 12, 10);
  R(ctx, 'rgba(255,255,255,0.4)', x, y, 12, 2);
  R(ctx, '#3a2c20', x + 5, y, 2, 10);
  R(ctx, '#3a2c20', x, y + 4, 12, 1);
  R(ctx, st.roof, x - 5, y - 2, 3, 14); // shutters
  R(ctx, st.roof, x + 14, y - 2, 3, 14);
}

function door(ctx, st, x, y, outerTop) {
  const w = S - 12;
  R(ctx, '#3a2c20', x - 2, y - (outerTop ? 2 : 0), w + 4, 24); // frame
  R(ctx, st.door, x, y, w, 22);
  R(ctx, 'rgba(0,0,0,0.25)', x + 6, y, 1, 22);
  R(ctx, 'rgba(0,0,0,0.25)', x + 13, y, 1, 22);
  R(ctx, 'rgba(255,255,255,0.12)', x, y, w, 1);
  R(ctx, '#f2c94c', x + w - 5, y + 11, 3, 3); // handle
  if (outerTop) { // step on the lane side
    R(ctx, '#8d8d96', x - 3, y + 20, w + 6, 4);
    R(ctx, DARK, x - 3, y + 23, w + 6, 1);
  } else {
    R(ctx, '#8d8d96', x - 3, y - 2, w + 6, 4);
  }
}

/** A building: roof on the outer side, wall facing the lane with a door in the middle column. */
export function drawBuilding(ctx, state, side, season) {
  const st = STATE_STYLE[state];
  const ex = seasonExtra(season);
  const outerTop = side === 'top';
  const wallH = BLD_PX_H - ROOF_H;
  const roofY = outerTop ? 0 : BLD_PX_H - ROOF_H;
  const wallY = outerTop ? ROOF_H : 0;

  R(ctx, st.wall, 2, wallY, BLD_PX_W - 4, wallH);
  for (let x = 4; x < BLD_PX_W - 4; x += 8) R(ctx, 'rgba(0,0,0,0.10)', x, wallY, 1, wallH); // planks
  R(ctx, '#3a2c20', 2, outerTop ? wallY + wallH - 3 : wallY, BLD_PX_W - 4, 3); // timber sill
  R(ctx, '#3a2c20', 2, wallY, 3, wallH); // corner posts
  R(ctx, '#3a2c20', BLD_PX_W - 5, wallY, 3, wallH);
  roof(ctx, st, season, ex, roofY, outerTop);

  const glow = state !== 'locked';
  const wy = outerTop ? wallY + 6 : wallY + 12;
  window_(ctx, st, 11, wy, glow);
  window_(ctx, st, BLD_PX_W - 23, wy, glow);
  if (season === 'spring' || season === 'summer') {
    for (const x of [8, BLD_PX_W - 26]) { // flower boxes
      R(ctx, '#6b4a2b', x, wy + 12, 18, 3);
      for (let i = 0; i < 4; i++) R(ctx, ex.flowers[i % 3], x + 2 + i * 4, wy + 10, 3, 3);
    }
  }
  door(ctx, st, S + 6, outerTop ? BLD_PX_H - 24 : 0, outerTop);
  mark(ctx, st.mark, BLD_PX_W - 22, roofY + 8);

  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, BLD_PX_W - 2, BLD_PX_H - 2);
}

export const buildingKey = (state, side, season) => `bld-${state}-${side}-${season}`;
