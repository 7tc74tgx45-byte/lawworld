// Garden sprites (T13), drawn programmatically onto 32x32 canvases: soil plot, five growth stages, withered variants
// and a soft glow for lit braziers. No image files.
import { canvasTexture } from './sprites.js';
import { TILE_SIZE } from '../logic/worldQuery.js';
import { MAX_STAGE } from '../logic/garden.js';

const S = TILE_SIZE;
const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

function soil(c, dry) {
  R(c, 'rgba(0,0,0,0.18)', 3, 25, 26, 5);
  R(c, dry ? '#7a5a3c' : '#5a3d27', 4, 20, 24, 8);
  R(c, dry ? '#8a6a48' : '#6b4a31', 5, 20, 22, 3);
  R(c, dry ? '#6a4c32' : '#4a3120', 4, 27, 24, 1);
  R(c, dry ? '#9a7a56' : '#7a563a', 8, 22, 2, 1);
  R(c, dry ? '#9a7a56' : '#7a563a', 18, 24, 3, 1);
}

/** Green palette alive, grey-brown withered. */
const pal = (dead) => (dead
  ? { stem: '#8a7a55', leaf: '#a8956a', leaf2: '#7c6b48', trunk: '#6b5a40', canopy: ['#b3a47a', '#968659', '#7a6c46'] }
  : { stem: '#3f8f3f', leaf: '#62c15a', leaf2: '#8be07a', trunk: '#6b4a2b', canopy: ['#8be07a', '#4fa84a', '#2f7a3a'] });

function plant(c, stage, dead) {
  const p = pal(dead);
  soil(c, dead);
  if (stage === 0) { // a seed just under the surface, with a hint of a mound
    R(c, '#3a2a1c', 14, 19, 5, 3);
    R(c, '#c9a227', 15, 20, 3, 1);
    return;
  }
  if (stage === 1) { // sprout: two leaves
    R(c, p.stem, 15, 13, 2, 8);
    R(c, p.leaf, 10, 11, 6, 3);
    R(c, p.leaf2, 16, 9, 6, 3);
    if (dead) { R(c, p.leaf2, 10, 14, 4, 1); }
    return;
  }
  if (stage === 2) { // sapling: thin trunk, small crown
    R(c, p.trunk, 15, 11, 2, 10);
    R(c, p.canopy[2], 9, 6, 14, 8);
    R(c, p.canopy[1], 10, 5, 12, 7);
    R(c, p.canopy[0], 12, 5, 6, 3);
    return;
  }
  if (stage === 3) { // young tree
    R(c, p.trunk, 14, 10, 4, 12);
    R(c, 'rgba(0,0,0,0.2)', 16, 10, 2, 12);
    R(c, p.canopy[2], 7, 3, 18, 11);
    R(c, p.canopy[1], 8, 2, 16, 10);
    R(c, p.canopy[0], 10, 3, 8, 4);
    return;
  }
  // full tree (stage 4): taller, with blossom/fruit when alive
  R(c, p.trunk, 13, 8, 6, 14);
  R(c, 'rgba(0,0,0,0.22)', 17, 8, 2, 14);
  R(c, p.canopy[2], 3, 2, 26, 12);
  R(c, p.canopy[2], 6, 0, 20, 16);
  R(c, p.canopy[1], 5, 2, 22, 10);
  R(c, p.canopy[1], 8, 1, 16, 13);
  R(c, p.canopy[0], 9, 3, 9, 5);
  if (!dead) for (const [x, y] of [[8, 8], [20, 5], [23, 10], [13, 11], [17, 7]]) R(c, '#f7c6da', x, y, 2, 2);
}

/** Registers every garden texture. Keys: plot-empty, plant-<stage>, plant-<stage>-dead, glow. */
export function makeGardenTextures(scene) {
  canvasTexture(scene, 'plot-empty', S, S, (c) => { soil(c, false); R(c, '#2d1f14', 6, 21, 20, 1); });
  for (let st = 0; st <= MAX_STAGE; st++) {
    canvasTexture(scene, `plant-${st}`, S, S, (c) => plant(c, st, false));
    canvasTexture(scene, `plant-${st}-dead`, S, S, (c) => plant(c, st, true));
  }
  // Soft round glow: concentric translucent discs (no gradients needed, stays pixel-ish).
  canvasTexture(scene, 'glow', 96, 96, (c) => {
    for (let r = 46; r > 2; r -= 4) {
      c.fillStyle = `rgba(255,170,60,${0.012 + (46 - r) * 0.0017})`;
      c.beginPath();
      c.arc(48, 48, r, 0, Math.PI * 2);
      c.fill();
    }
  });
}

export const plantKey = (stage, withered) => `plant-${Math.max(0, Math.min(MAX_STAGE, stage))}${withered ? '-dead' : ''}`;
