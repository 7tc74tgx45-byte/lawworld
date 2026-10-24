// Season trees drawn onto a 2D context (32x32 tile). Programmatic pixel art.
import { seasonPalette, seasonExtra } from './palette.js';

const hash = (x, y, k = 0) => (Math.imul(x + k * 31, 73856093) ^ Math.imul(y - k * 17, 19349663)) >>> 0;

const R = (ctx, c, x, y, w, h) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

function shadow(ctx, px, py) {
  R(ctx, 'rgba(0,0,0,0.20)', px + 5, py + 26, 22, 5);
  R(ctx, 'rgba(0,0,0,0.12)', px + 3, py + 27, 26, 3);
}

function trunk(ctx, pal, px, py) {
  R(ctx, pal.trunk, px + 13, py + 18, 6, 11);
  R(ctx, 'rgba(0,0,0,0.25)', px + 17, py + 18, 2, 11);
  R(ctx, 'rgba(255,255,255,0.12)', px + 13, py + 18, 1, 11);
}

/** Round broadleaf canopy: three-tone blob with highlight pixels. */
function canopy(ctx, c, px, py) {
  const [light, mid, dark] = c;
  R(ctx, dark, px + 4, py + 9, 24, 13);
  R(ctx, dark, px + 7, py + 5, 18, 19);
  R(ctx, dark, px + 10, py + 2, 12, 24);
  R(ctx, mid, px + 6, py + 7, 19, 12);
  R(ctx, mid, px + 9, py + 4, 13, 16);
  R(ctx, light, px + 8, py + 6, 10, 7);
  R(ctx, light, px + 11, py + 4, 7, 4);
  R(ctx, dark, px + 5, py + 17, 3, 2);
  R(ctx, dark, px + 23, py + 15, 3, 3);
}

function dots(ctx, colours, px, py, h, n, k) {
  for (let i = 0; i < n; i++) {
    const v = hash(px / 32 + i * 5, py / 32 + i * 3, k + i);
    R(ctx, colours[v % colours.length], px + 6 + (v % 19), py + 5 + ((v >> 6) % 14), 2, 2);
  }
  void h;
}

function pine(ctx, snow, px, py, pal) {
  R(ctx, pal.trunk, px + 14, py + 22, 4, 7);
  const tiers = [[10, 4, 12], [7, 8, 18], [4, 13, 24]]; // [x, y, w]
  tiers.forEach(([x, y, w], i) => {
    R(ctx, pal.treeDark, px + x, py + y, w, 7);
    R(ctx, pal.tree, px + x + 1, py + y, w - 3, 4);
    if (snow) {
      R(ctx, '#ffffff', px + x + 1, py + y, w - 2, 2);
      R(ctx, '#dfeaf2', px + x + 2, py + y + 2, Math.max(2, w - 8), 1);
    }
    if (i === 0) R(ctx, pal.treeDark, px + 14, py + 2, 4, 3);
  });
  if (snow) R(ctx, '#ffffff', px + 14, py + 1, 4, 2);
}

export function drawSeasonTree(ctx, season, tx, ty, px, py) {
  const pal = seasonPalette(season);
  const ex = seasonExtra(season);
  shadow(ctx, px, py);
  // winter: evergreen pines, one in four is a bare tree
  if (season === 'winter') {
    if (hash(tx, ty, 4) % 4 === 0) {
      trunk(ctx, pal, px, py);
      R(ctx, pal.trunk, px + 9, py + 10, 14, 2);
      R(ctx, pal.trunk, px + 11, py + 5, 2, 8);
      R(ctx, pal.trunk, px + 19, py + 7, 2, 7);
      R(ctx, '#ffffff', px + 9, py + 9, 14, 1);
      R(ctx, '#ffffff', px + 11, py + 4, 2, 1);
      R(ctx, '#ffffff', px + 19, py + 6, 2, 1);
    } else {
      pine(ctx, true, px, py, pal);
    }
    R(ctx, '#ffffff', px + 8, py + 28, 16, 2);
    return;
  }
  trunk(ctx, pal, px, py);
  canopy(ctx, ex.canopy, px, py);
  if (season === 'spring') dots(ctx, ['#f7c6da', '#ffffff', '#f2a0c0'], px, py, 0, 7, 1); // blossom
  else if (season === 'summer') dots(ctx, ['#79c255', '#a6dd7a'], px, py, 0, 4, 2); // sun-struck leaves
  else {
    dots(ctx, ['#c0392b', '#f2c14e', '#a8481c'], px, py, 0, 6, 3); // autumn mix
    R(ctx, ex.canopy[1], px + 21, py + 25, 3, 2); // fallen leaves at the foot
    R(ctx, ex.canopy[2], px + 6, py + 27, 2, 2);
  }
}
