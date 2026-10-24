// Programmatic sprite textures: buildings (per state, side and season), signpost, brazier, player frames, cat frames,
// weather particles. No image files.
import { drawBuilding, buildingKey, BLD_PX_W, BLD_PX_H, drawLectureHall, lectureHallKey, LH_PX_W, LH_PX_H, drawLibrary, libraryKey, LIB_PX_W, LIB_PX_H } from './buildingDraw.js';
import { drawPlayer, drawCatWalk, drawCatSit } from './characterDraw.js';
import { drawClient } from './clientDraw.js';
import { TILE_SIZE } from '../logic/worldQuery.js';
import { FACINGS } from '../logic/anim.js';

export { buildingKey, BLD_PX_W, BLD_PX_H, lectureHallKey, LH_PX_W, LH_PX_H, libraryKey, LIB_PX_W, LIB_PX_H };

/** Create (once) and return the key of a library texture. */
export function ensureLibraryTexture(scene, state, side, season) {
  const key = libraryKey(state, side, season);
  canvasTexture(scene, key, LIB_PX_W, LIB_PX_H, (ctx) => drawLibrary(ctx, state, side, season));
  return key;
}

/** Create (once) and return the key of a lecture-hall texture. */
export function ensureLectureHallTexture(scene, state, side, season) {
  const key = lectureHallKey(state, side, season);
  canvasTexture(scene, key, LH_PX_W, LH_PX_H, (ctx) => drawLectureHall(ctx, state, side, season));
  return key;
}
const S = TILE_SIZE;

export function canvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext());
  tex.refresh();
}

/** Create (once) and return the key of a building texture. Made on demand: 4 states x 2 sides x 4 seasons. */
export function ensureBuildingTexture(scene, state, side, season) {
  const key = buildingKey(state, side, season);
  canvasTexture(scene, key, BLD_PX_W, BLD_PX_H, (ctx) => drawBuilding(ctx, state, side, season));
  return key;
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
  const bowl = (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(6, 27, 20, 4);
    ctx.fillStyle = '#3b3b44';
    ctx.fillRect(8, 24, 16, 4);
    ctx.fillRect(14, 16, 4, 9);
    ctx.fillStyle = '#55555f';
    ctx.fillRect(6, 10, 20, 7);
  };
  canvasTexture(scene, 'brazier-unlit', S, S, (ctx) => {
    bowl(ctx);
    ctx.fillStyle = '#26262c';
    ctx.fillRect(8, 11, 16, 3);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(12, 9, 3, 2);
    ctx.fillRect(17, 9, 3, 2);
  });
  for (const f of [0, 1]) {
    canvasTexture(scene, `brazier-lit-${f}`, S, S, (ctx) => {
      bowl(ctx);
      ctx.fillStyle = '#e8590c';
      ctx.fillRect(10, 2 + f, 12, 10 - f);
      ctx.fillRect(f ? 12 : 9, 0, 3, 4);
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(13, 4 + f, 6, 7 - f);
      ctx.fillStyle = '#fff3bf';
      ctx.fillRect(15, 7, 2, 3);
    });
  }
}

export function makeCharacterTextures(scene) {
  for (const dir of FACINGS) {
    for (const frame of [0, 1, 2]) canvasTexture(scene, `player-${dir}-${frame}`, 20, 26, (ctx) => drawPlayer(ctx, dir, frame));
  }
  for (const v of [0, 1, 2, 3]) {
    for (const frame of [0, 1, 2]) canvasTexture(scene, `client-${v}-${frame}`, 20, 26, (ctx) => drawClient(ctx, v, frame));
  }
  for (const f of [0, 1]) canvasTexture(scene, `cat-walk-${f}`, 18, 14, (ctx) => drawCatWalk(ctx, f));
  for (const f of [0, 1, 2]) canvasTexture(scene, `cat-sit-${f}`, 18, 14, (ctx) => drawCatSit(ctx, f));
}

const px = (ctx, c, x, y, w = 1, h = 1) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

/** Small weather sprites, keys as in src/logic/weather.js KIND_TEXTURES. */
export function makeWeatherTextures(scene) {
  canvasTexture(scene, 'fx-petal-a', 6, 6, (c) => { px(c, '#f7b6d0', 1, 1, 4, 3); px(c, '#ffe0ec', 2, 1, 2, 1); px(c, '#e48aae', 3, 4, 2, 1); });
  canvasTexture(scene, 'fx-petal-b', 6, 6, (c) => { px(c, '#ffffff', 1, 2, 4, 3); px(c, '#f7b6d0', 1, 4, 3, 1); });
  canvasTexture(scene, 'fx-mote', 5, 5, (c) => { px(c, 'rgba(255,240,150,0.35)', 0, 1, 5, 3); px(c, 'rgba(255,240,150,0.35)', 1, 0, 3, 5); px(c, '#fff6b0', 2, 2, 1, 1); });
  canvasTexture(scene, 'fx-leaf-a', 7, 6, (c) => { px(c, '#d9772b', 1, 1, 5, 4); px(c, '#a8481c', 3, 2, 1, 2); px(c, '#f0952f', 1, 1, 2, 1); });
  canvasTexture(scene, 'fx-leaf-b', 7, 6, (c) => { px(c, '#c0392b', 1, 1, 5, 4); px(c, '#8a2a1c', 3, 2, 1, 2); });
  canvasTexture(scene, 'fx-leaf-c', 7, 6, (c) => { px(c, '#e8b53a', 1, 1, 5, 4); px(c, '#b8861f', 3, 2, 1, 2); });
  canvasTexture(scene, 'fx-snow-a', 4, 4, (c) => { px(c, '#ffffff', 1, 0, 2, 4); px(c, '#ffffff', 0, 1, 4, 2); });
  canvasTexture(scene, 'fx-snow-b', 3, 3, (c) => { px(c, '#ffffff', 0, 0, 2, 2); px(c, '#dfeaf2', 1, 1, 2, 2); });
  canvasTexture(scene, 'fx-mist', 96, 48, (c) => {
    for (let i = 0; i < 6; i++) px(c, `rgba(220,215,200,${0.05 + (i % 3) * 0.015})`, 8 + i * 4, 6 + i * 3, 80 - i * 8, 36 - i * 5);
  });
}
