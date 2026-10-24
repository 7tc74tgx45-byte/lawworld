// Canvas-generated tutor portraits (T16). Each is drawn once with ctx.fillRect only (no images loaded) on a 64x64
// OffscreenCanvas and kept as an ImageBitmap; getPortrait() hands out a fresh 64x64 <canvas> showing it.
// The designs themselves are pure data in src/logic/portraits.js.

import { PORTRAIT_SIZE, buildPortrait, portraitIdFor } from '../logic/portraits.js';

const bitmaps = new Map(); // portrait id -> ImageBitmap (or the drawn fallback canvas)

function paint(ctx, design) {
  ctx.imageSmoothingEnabled = false;
  for (const [x, y, w, h, key] of design.rects) {
    ctx.fillStyle = design.palette[key];
    ctx.fillRect(x, y, w, h);
  }
}

/** Draw a tutor's portrait on an OffscreenCanvas and return it as an ImageBitmap (falls back to a canvas where unsupported). */
export function renderPortraitBitmap(tutorId) {
  const id = portraitIdFor(tutorId);
  if (bitmaps.has(id)) return bitmaps.get(id);
  const design = buildPortrait(id);
  let out;
  if (typeof OffscreenCanvas !== 'undefined') {
    const off = new OffscreenCanvas(PORTRAIT_SIZE, PORTRAIT_SIZE);
    paint(off.getContext('2d'), design);
    out = off.transferToImageBitmap();
  } else {
    out = document.createElement('canvas');
    out.width = out.height = PORTRAIT_SIZE;
    paint(out.getContext('2d'), design);
  }
  bitmaps.set(id, out);
  return out;
}

/** getPortrait(tutorId) -> a new 64x64 HTMLCanvasElement showing that tutor (unknown ids get Dr Chen). */
export function getPortrait(tutorId) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PORTRAIT_SIZE;
  canvas.className = 'lw-portrait';
  canvas.title = '';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(renderPortraitBitmap(tutorId), 0, 0);
  return canvas;
}
