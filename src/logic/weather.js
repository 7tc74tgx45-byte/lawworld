// Weather particles per season (pure, no Phaser). The renderer in src/game/weather.js draws what this computes.
// Positions are in screen pixels inside a (w, h) view; particles wrap around the edges.

export const WEATHER = {
  spring: { kind: 'petal', count: 36, mist: 0 },
  summer: { kind: 'mote', count: 30, mist: 0 },
  autumn: { kind: 'leaf', count: 34, mist: 5 },
  winter: { kind: 'snow', count: 70, mist: 0 },
};

export const weatherFor = (season) => WEATHER[season] ?? WEATHER.spring;

/** Texture keys each kind picks from (variant index chooses one). */
export const KIND_TEXTURES = {
  petal: ['fx-petal-a', 'fx-petal-b'],
  mote: ['fx-mote'],
  leaf: ['fx-leaf-a', 'fx-leaf-b', 'fx-leaf-c'],
  snow: ['fx-snow-a', 'fx-snow-b'],
};

/** Tiny deterministic RNG (mulberry32) so tests can pin the output. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function spawnParticle(kind, rng, w, h) {
  const variants = KIND_TEXTURES[kind].length;
  const p = { x: rng() * w, y: rng() * h, phase: rng() * Math.PI * 2, rot: rng() * Math.PI * 2, variant: Math.floor(rng() * variants), vx: 0, vy: 0, vr: 0, speedK: 0.7 + rng() * 0.6 };
  switch (kind) {
    case 'petal': p.vx = 18; p.vy = 24; p.vr = 2; break;
    case 'mote': p.vx = 4; p.vy = -7; p.vr = 0; break;
    case 'leaf': p.vx = 26; p.vy = 34; p.vr = 2.4; break;
    case 'snow': p.vx = 6; p.vy = 38; p.vr = 0; break;
    default: break;
  }
  return p;
}

/** Advance one particle by dt seconds. Sways side to side; wraps at the edges. Mutates and returns p. */
export function stepParticle(p, kind, dt, w, h) {
  p.phase += dt * (kind === 'mote' ? 1.1 : 1.8) * p.speedK;
  const sway = Math.sin(p.phase) * (kind === 'snow' ? 10 : kind === 'mote' ? 6 : 24);
  p.x += (p.vx * p.speedK + sway) * dt;
  p.y += p.vy * p.speedK * dt;
  p.rot += p.vr * dt * Math.sign(Math.cos(p.phase * 0.5) || 1);
  const m = 12;
  if (p.x > w + m) p.x = -m;
  else if (p.x < -m) p.x = w + m;
  if (p.y > h + m) p.y = -m;
  else if (p.y < -m) p.y = h + m;
  return p;
}

/** 0..1 opacity: motes twinkle, the rest are mostly solid. */
export function particleAlpha(p, kind) {
  if (kind === 'mote') return 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(p.phase * 1.7));
  if (kind === 'snow') return 0.75 + 0.2 * Math.sin(p.phase);
  return 0.9;
}

export function makeParticles(kind, count, rng, w, h) {
  return Array.from({ length: count }, () => spawnParticle(kind, rng, w, h));
}
