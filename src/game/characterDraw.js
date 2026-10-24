// Player (law student with a messenger bag) and cat, drawn programmatically. No image files.
// Player: 20x26 px, 4 directions x (2 walk frames + a standing pose), keys player-<dir>-<0|1|2>.
// Cat: 18x14 px, cat-walk-0/1 (faces right; flip for left) and cat-sit-0/1/2 (tail flick frames).

const R = (ctx, c, x, y, w, h) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

const C = {
  skin: '#f0c8a0', skinShade: '#d9a97e', hair: '#4b2e1a', hairLight: '#6b4426',
  jacket: '#3d5aa8', jacketDark: '#2f4688', jacketLight: '#5674c4', trousers: '#2b3a67', shoe: '#1c1c24',
  bag: '#8b5a2b', bagDark: '#6a4220', bagLight: '#a8743a', strap: '#6a4220', buckle: '#f2c94c', paper: '#f4efe0', eye: '#222',
};

function legs(ctx, frame, side) {
  // frame 2 = standing; 0/1 alternate which leg is lifted
  const a = frame === 0 ? 0 : frame === 1 ? 2 : 0; // left leg lift
  const b = frame === 1 ? 0 : frame === 0 ? 2 : 0; // right leg lift
  if (side) {
    // profile: legs swing front/back instead of lifting
    const sw = frame === 0 ? -2 : frame === 1 ? 2 : 0;
    R(ctx, C.trousers, 7 + sw, 17, 4, 6);
    R(ctx, C.shoe, 7 + sw, 23, 5, 2);
    R(ctx, C.trousers, 9 - sw, 17, 4, 6);
    R(ctx, C.shoe, 9 - sw, 23, 5, 2);
    return;
  }
  R(ctx, C.trousers, 5, 17, 4, 7 - a);
  R(ctx, C.shoe, 5, 24 - a, 4, 2 - 0);
  R(ctx, C.trousers, 11, 17, 4, 7 - b);
  R(ctx, C.shoe, 11, 24 - b, 4, 2);
}

function shadow(ctx) {
  R(ctx, 'rgba(0,0,0,0.25)', 3, 23, 14, 3);
}

function drawFront(ctx, frame) {
  shadow(ctx);
  legs(ctx, frame, false);
  R(ctx, C.jacket, 3, 9, 14, 9); // torso
  R(ctx, C.jacketLight, 4, 9, 12, 1);
  R(ctx, C.jacketDark, 3, 17, 14, 1);
  const sw = frame === 0 ? 1 : frame === 1 ? -1 : 0; // arms swing
  R(ctx, C.jacket, 1, 10 + sw, 3, 7);
  R(ctx, C.jacket, 16, 10 - sw, 3, 7);
  R(ctx, C.skin, 1, 17 + sw, 3, 2);
  R(ctx, C.skin, 16, 17 - sw, 3, 2);
  R(ctx, C.strap, 5, 9, 2, 2); // strap diagonal: left shoulder to right hip
  R(ctx, C.strap, 7, 11, 2, 2);
  R(ctx, C.strap, 9, 13, 2, 2);
  R(ctx, C.strap, 11, 15, 2, 2);
  R(ctx, C.bag, 12, 15, 7, 6); // bag on the right hip
  R(ctx, C.bagLight, 12, 15, 7, 1);
  R(ctx, C.bagDark, 12, 20, 7, 1);
  R(ctx, C.buckle, 15, 17, 2, 2);
  R(ctx, C.skin, 5, 1, 10, 8); // head
  R(ctx, C.skinShade, 5, 8, 10, 1);
  R(ctx, C.hair, 4, 0, 12, 3);
  R(ctx, C.hair, 4, 3, 2, 3);
  R(ctx, C.hair, 14, 3, 2, 3);
  R(ctx, C.hairLight, 7, 0, 4, 1);
  R(ctx, C.eye, 7, 5, 2, 2);
  R(ctx, C.eye, 11, 5, 2, 2);
}

function drawBack(ctx, frame) {
  shadow(ctx);
  legs(ctx, frame, false);
  R(ctx, C.jacket, 3, 9, 14, 9);
  R(ctx, C.jacketDark, 3, 17, 14, 1);
  const sw = frame === 0 ? 1 : frame === 1 ? -1 : 0;
  R(ctx, C.jacket, 1, 10 - sw, 3, 7);
  R(ctx, C.jacket, 16, 10 + sw, 3, 7);
  R(ctx, C.skin, 1, 17 - sw, 3, 2);
  R(ctx, C.skin, 16, 17 + sw, 3, 2);
  R(ctx, C.strap, 5, 9, 2, 3); // strap crosses the back
  R(ctx, C.strap, 7, 11, 2, 2);
  R(ctx, C.strap, 9, 13, 2, 2);
  R(ctx, C.bag, 4, 13, 12, 8); // bag centred low on the back
  R(ctx, C.bagLight, 4, 13, 12, 1);
  R(ctx, C.bagDark, 4, 20, 12, 1);
  R(ctx, C.bagDark, 4, 16, 12, 1); // flap line
  R(ctx, C.paper, 10, 12, 4, 2); // papers poking out
  R(ctx, C.skin, 5, 1, 10, 8);
  R(ctx, C.hair, 4, 0, 12, 8); // back of the head is all hair
  R(ctx, C.hairLight, 7, 1, 5, 1);
  R(ctx, C.skin, 6, 8, 8, 1);
}

function drawSide(ctx, frame, dir) {
  // draw facing right, then mirror for left
  ctx.save();
  if (dir === 'left') {
    ctx.translate(20, 0);
    ctx.scale(-1, 1);
  }
  shadow(ctx);
  legs(ctx, frame, true);
  R(ctx, C.jacket, 5, 9, 10, 9);
  R(ctx, C.jacketLight, 5, 9, 10, 1);
  R(ctx, C.jacketDark, 5, 17, 10, 1);
  const sw = frame === 0 ? 2 : frame === 1 ? -2 : 0;
  R(ctx, C.bag, 1, 13, 6, 7); // bag at the back (left when facing right)
  R(ctx, C.bagLight, 1, 13, 6, 1);
  R(ctx, C.bagDark, 1, 19, 6, 1);
  R(ctx, C.buckle, 3, 15, 2, 2);
  R(ctx, C.strap, 7, 9, 2, 3); // strap over the shoulder
  R(ctx, C.strap, 5, 11, 2, 3);
  R(ctx, C.jacketDark, 8 + sw, 10, 3, 7); // near arm
  R(ctx, C.skin, 8 + sw, 17, 3, 2);
  R(ctx, C.skin, 6, 1, 9, 8); // head
  R(ctx, C.skin, 14, 5, 1, 2);
  R(ctx, C.hair, 5, 0, 10, 3);
  R(ctx, C.hair, 5, 3, 4, 5); // hair over the back of the head
  R(ctx, C.hairLight, 8, 0, 4, 1);
  R(ctx, C.eye, 12, 5, 2, 2);
  ctx.restore();
}

/** Draw one player frame onto ctx (a 20x26 canvas). */
export function drawPlayer(ctx, dir, frame) {
  if (dir === 'down') drawFront(ctx, frame);
  else if (dir === 'up') drawBack(ctx, frame);
  else drawSide(ctx, frame, dir);
}

// ---------------------------------------------------------------------------
// Cat (ginger tabby, facing right)
// ---------------------------------------------------------------------------
const K = { fur: '#e08a3c', dark: '#b8651f', light: '#f4b878', belly: '#fbe3c4', ear: '#f0a0a0', eye: '#2a6a2a', nose: '#d86a7a', stripe: '#9a5218' };

function catHead(ctx, x, y) {
  R(ctx, K.fur, x, y, 7, 6);
  R(ctx, K.fur, x, y - 2, 2, 2); // ears
  R(ctx, K.fur, x + 5, y - 2, 2, 2);
  R(ctx, K.ear, x + 1, y - 1, 1, 1);
  R(ctx, K.ear, x + 5, y - 1, 1, 1);
  R(ctx, K.light, x + 3, y + 3, 4, 3); // muzzle
  R(ctx, K.eye, x + 4, y + 1, 1, 2);
  R(ctx, K.nose, x + 6, y + 3, 1, 1);
  R(ctx, K.stripe, x + 2, y, 1, 2);
}

/** Walking cat: frame 0/1 alternate leg pairs. */
export function drawCatWalk(ctx, frame) {
  R(ctx, 'rgba(0,0,0,0.2)', 2, 12, 14, 2);
  const up = frame === 0;
  R(ctx, K.dark, 3, up ? 10 : 11, 2, up ? 3 : 2); // back legs
  R(ctx, K.dark, 6, up ? 11 : 10, 2, up ? 2 : 3);
  R(ctx, K.fur, 2, 5, 10, 6); // body
  R(ctx, K.belly, 4, 10, 6, 1);
  R(ctx, K.stripe, 5, 5, 1, 3);
  R(ctx, K.stripe, 8, 5, 1, 3);
  R(ctx, K.dark, 9, up ? 11 : 10, 2, up ? 2 : 3); // front legs
  R(ctx, K.dark, 11, up ? 10 : 11, 2, up ? 3 : 2);
  // tail up and curled
  R(ctx, K.fur, 0, 4, 2, 3);
  R(ctx, K.fur, 0, 2, 2, 2);
  R(ctx, K.dark, 0, 1, 2, 1);
  catHead(ctx, 11, 3);
}

/** Sitting cat seen side-on: frame 0 tail down, 1 tail mid, 2 tail flicked out. */
export function drawCatSit(ctx, frame) {
  R(ctx, 'rgba(0,0,0,0.2)', 3, 12, 11, 2);
  R(ctx, K.fur, 4, 5, 8, 8); // haunch and body, upright
  R(ctx, K.dark, 4, 9, 4, 4); // haunch
  R(ctx, K.belly, 10, 8, 2, 5); // chest
  R(ctx, K.stripe, 6, 5, 1, 3);
  R(ctx, K.dark, 9, 12, 3, 2); // front paws
  const tx = frame === 0 ? [[2, 12, 3, 1]] : frame === 1 ? [[1, 12, 4, 1], [1, 11, 1, 1]] : [[0, 11, 5, 1], [0, 9, 1, 2], [1, 8, 1, 1]];
  for (const [x, y, w, h] of tx) R(ctx, K.dark, x, y, w, h);
  R(ctx, K.fur, 3, 12, 2, 1);
  catHead(ctx, 9, 2);
}
