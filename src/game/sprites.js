// Programmatic sprite textures: buildings per state (and facing side), signpost, brazier, player. No image files.
import { STATE_STYLE } from './palette.js';
import { BLD_W, BLD_H } from '../logic/layoutCell.js';
import { TILE_SIZE } from '../logic/worldQuery.js';

const S = TILE_SIZE;
export const BLD_PX_W = BLD_W * S;
export const BLD_PX_H = BLD_H * S;

function canvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext());
  tex.refresh();
}

function padlock(ctx, x, y) {
  ctx.fillStyle = '#d8d8e0';
  ctx.fillRect(x + 3, y, 2, 3);
  ctx.fillRect(x + 9, y, 2, 3);
  ctx.fillRect(x + 3, y, 8, 2);
  ctx.fillStyle = '#f2c94c';
  ctx.fillRect(x, y + 5, 14, 10);
  ctx.fillStyle = '#7a5a10';
  ctx.fillRect(x + 6, y + 8, 2, 4);
}

function mark(ctx, kind, x, y) {
  if (kind === 'padlock') padlock(ctx, x, y);
  else if (kind === 'tick') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y + 8, 3, 3);
    ctx.fillRect(x + 3, y + 11, 3, 3);
    ctx.fillRect(x + 6, y + 8, 3, 3);
    ctx.fillRect(x + 9, y + 5, 3, 3);
    ctx.fillRect(x + 12, y + 2, 3, 3);
  } else if (kind === 'half') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y + 2, 14, 12);
    ctx.fillStyle = '#9a6a1c';
    ctx.fillRect(x + 2, y + 4, 5, 8);
    ctx.fillRect(x + 7, y + 4, 5, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 7, y + 4, 5, 8);
  }
}

/** A building: roof band on the outer side, wall on the lane side with a door in the middle column. */
function drawBuilding(ctx, st, side) {
  const roofH = 30;
  const wallH = BLD_PX_H - roofH;
  const roofY = side === 'top' ? 0 : BLD_PX_H - roofH;
  const wallY = side === 'top' ? roofH : 0;
  // drop shadow and wall
  ctx.fillStyle = st.wall;
  ctx.fillRect(2, wallY, BLD_PX_W - 4, wallH);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 2; x < BLD_PX_W - 4; x += 8) ctx.fillRect(x, wallY, 1, wallH);
  // roof: tiles in rows
  ctx.fillStyle = st.roof;
  ctx.fillRect(0, roofY, BLD_PX_W, roofH);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let y = roofY + 4; y < roofY + roofH - 2; y += 8) ctx.fillRect(2, y, BLD_PX_W - 4, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, side === 'top' ? roofY + roofH - 2 : roofY, BLD_PX_W, 2);
  // door
  const dx = S + 6;
  const dy = side === 'top' ? BLD_PX_H - 22 : 0;
  ctx.fillStyle = st.door;
  ctx.fillRect(dx, dy, S - 12, 22);
  ctx.fillStyle = '#f2c94c';
  ctx.fillRect(dx + S - 12 - 6, dy + 11, 3, 3);
  // window on each side of the door
  ctx.fillStyle = '#cfe6f5';
  const wy = wallY + 6;
  ctx.fillRect(8, wy, 12, 10);
  ctx.fillRect(BLD_PX_W - 20, wy, 12, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(13, wy, 1, 10);
  ctx.fillRect(BLD_PX_W - 15, wy, 1, 10);
  // state mark on the roof
  mark(ctx, st.mark, BLD_PX_W - 20, roofY + 8);
  // outline
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, BLD_PX_W - 2, BLD_PX_H - 2);
}

export function buildingKey(state, side) {
  return `bld-${state}-${side}`;
}

export function makeBuildingTextures(scene) {
  for (const [state, st] of Object.entries(STATE_STYLE)) {
    for (const side of ['top', 'bottom']) {
      canvasTexture(scene, buildingKey(state, side), BLD_PX_W, BLD_PX_H, (ctx) => drawBuilding(ctx, st, side));
    }
  }
}

export function makeFurnitureTextures(scene) {
  canvasTexture(scene, 'signpost', S, S, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(8, 27, 18, 4);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(14, 8, 4, 22);
    ctx.fillStyle = '#c99a5b';
    ctx.fillRect(4, 4, 24, 9);
    ctx.fillStyle = '#8a6a3f';
    ctx.fillRect(4, 12, 24, 1);
    ctx.fillStyle = '#4a3320';
    ctx.fillRect(7, 7, 14, 2);
    ctx.fillRect(7, 10, 9, 1);
  });
  canvasTexture(scene, 'brazier-unlit', S, S, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(6, 27, 20, 4);
    ctx.fillStyle = '#3b3b44';
    ctx.fillRect(8, 24, 16, 4);
    ctx.fillRect(14, 16, 4, 9);
    ctx.fillStyle = '#55555f';
    ctx.fillRect(6, 10, 20, 7);
    ctx.fillStyle = '#26262c';
    ctx.fillRect(8, 11, 16, 3);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(12, 9, 3, 2);
    ctx.fillRect(17, 9, 3, 2);
  });
  canvasTexture(scene, 'brazier-lit', S, S, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(6, 27, 20, 4);
    ctx.fillStyle = '#3b3b44';
    ctx.fillRect(8, 24, 16, 4);
    ctx.fillRect(14, 16, 4, 9);
    ctx.fillStyle = '#55555f';
    ctx.fillRect(6, 10, 20, 7);
    ctx.fillStyle = '#e8590c';
    ctx.fillRect(10, 2, 12, 10);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(13, 4, 6, 7);
  });
  canvasTexture(scene, 'player', 20, 26, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(3, 23, 14, 3);
    ctx.fillStyle = '#2b3a67'; // legs
    ctx.fillRect(5, 17, 4, 7);
    ctx.fillRect(11, 17, 4, 7);
    ctx.fillStyle = '#3d5aa8'; // jacket
    ctx.fillRect(3, 8, 14, 10);
    ctx.fillStyle = '#8b5a2b'; // messenger bag strap and bag
    ctx.fillRect(4, 8, 3, 9);
    ctx.fillRect(12, 13, 7, 6);
    ctx.fillStyle = '#f0c8a0'; // head
    ctx.fillRect(5, 1, 10, 8);
    ctx.fillStyle = '#4b2e1a'; // hair
    ctx.fillRect(4, 0, 12, 3);
    ctx.fillStyle = '#222';
    ctx.fillRect(7, 5, 2, 2);
    ctx.fillRect(11, 5, 2, 2);
  });
}
