// Client NPC sprites (T12), drawn programmatically. 20x26 px, front view, 2 walk frames + a standing pose.
// Keys: client-<variant>-<frame> (variant 0..3, frame 0|1|2). Four looks so the four regions' clients differ.

const R = (ctx, c, x, y, w, h) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

export const CLIENT_VARIANTS = [
  { skin: '#e8b98f', hair: '#2b2b33', coat: '#a8483c', coatDark: '#7e342b', trousers: '#3a3a48' },
  { skin: '#b9835a', hair: '#1c1410', coat: '#4d8a73', coatDark: '#386655', trousers: '#2f3b52' },
  { skin: '#f3d2b3', hair: '#c8a24a', coat: '#7a64b8', coatDark: '#5a4a90', trousers: '#4a3f3a' },
  { skin: '#8a5a3c', hair: '#d8d8dc', coat: '#c08a38', coatDark: '#94661f', trousers: '#33384a' },
];

export const clientVariantFor = (regionIndex) => ((regionIndex % CLIENT_VARIANTS.length) + CLIENT_VARIANTS.length) % CLIENT_VARIANTS.length;

export function drawClient(ctx, variant, frame) {
  const v = CLIENT_VARIANTS[clientVariantFor(variant)];
  const a = frame === 0 ? 0 : frame === 1 ? 2 : 0;
  const b = frame === 1 ? 0 : frame === 0 ? 2 : 0;
  R(ctx, 'rgba(0,0,0,0.25)', 3, 23, 14, 3);
  R(ctx, v.trousers, 5, 17, 4, 7 - a);
  R(ctx, '#1c1c24', 5, 24 - a, 4, 2);
  R(ctx, v.trousers, 11, 17, 4, 7 - b);
  R(ctx, '#1c1c24', 11, 24 - b, 4, 2);
  R(ctx, v.coat, 3, 9, 14, 10); // long coat
  R(ctx, v.coatDark, 3, 18, 14, 1);
  R(ctx, v.coatDark, 9, 10, 2, 9); // coat opening
  const sw = frame === 0 ? 1 : frame === 1 ? -1 : 0;
  R(ctx, v.coat, 1, 10 + sw, 3, 7);
  R(ctx, v.coat, 16, 10 - sw, 3, 7);
  R(ctx, v.skin, 1, 17 + sw, 3, 2);
  R(ctx, v.skin, 16, 17 - sw, 3, 2);
  R(ctx, '#f4efe0', 0, 16 + sw, 4, 4); // the folder of papers they carry
  R(ctx, '#c9b98a', 0, 16 + sw, 4, 1);
  R(ctx, v.skin, 5, 1, 10, 8);
  R(ctx, '#00000022', 5, 8, 10, 1);
  R(ctx, v.hair, 4, 0, 12, 3);
  R(ctx, v.hair, 4, 3, 2, 3);
  R(ctx, v.hair, 14, 3, 2, 3);
  R(ctx, '#222', 7, 5, 2, 2);
  R(ctx, '#222', 11, 5, 2, 2);
  R(ctx, '#8a4a3a', 9, 7, 2, 1); // a worried mouth
}
