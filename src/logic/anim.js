// Pure animation helpers (no Phaser): which walk frame and texture key to show. Textures are generated in src/game/characterDraw.js.

export const FACINGS = ['up', 'down', 'left', 'right'];
export const PLAYER_STRIDE = 11; // pixels walked per frame swap

/** Two-frame walk cycle: 0, 1, 0, 1... as the distance walked grows. */
export const walkFrame = (distance, stride = PLAYER_STRIDE) => Math.floor(Math.max(0, distance) / stride) % 2;

/** Direction from a movement vector. Vertical wins ties (matches the old player behaviour). */
export function facingFromVector(dx, dy, fallback = 'down') {
  if (!dx && !dy) return fallback;
  return Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'up' : 'down') : dx < 0 ? 'left' : 'right';
}

/** player-<facing>-<0|1>: the walk frames; player-<facing>-2 is the standing pose. */
export function playerTextureKey(facing, moving, walkDist) {
  const f = FACINGS.includes(facing) ? facing : 'down';
  return `player-${f}-${moving ? walkFrame(walkDist) : 2}`;
}
