// Cat companion behaviour (pure, no Phaser). The cat records the player's path as a trail of points and walks along
// that same path, staying about FOLLOW_DIST pixels behind (so it follows "with a short delay" and never cuts corners
// through walls). Standing still it stands, then sits and flicks its tail. During an encounter it walks to a spot
// beside the player and sits there.

export const CAT = {
  followDist: 34, // path distance kept behind the player
  speed: 120,
  runSpeed: 190, // when it has fallen well behind
  trailStep: 3, // px between recorded player points
  maxTrail: 500,
  snapDist: 480, // farther than this (teleport, bad save): jump to the player
  sitAfter: 1.6, // seconds standing still before sitting
  flickPeriod: 3.2,
};

export const BESIDE_OFFSETS = [[22, 4], [-22, 4], [0, 16], [0, -12]];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createCat(x, y) {
  return { x, y, dir: 1, mode: 'sit', t: 0, walkDist: 0, trail: [] };
}

/** First spot beside the player that is not blocked (right, left, below, above). `blocked(x, y)` is injected. */
export function pickBesideSpot(player, blocked = () => false) {
  for (const [ox, oy] of BESIDE_OFFSETS) {
    const p = { x: player.x + ox, y: player.y + oy };
    if (!blocked(p.x, p.y)) return p;
  }
  return { x: player.x, y: player.y };
}

function pathLength(cat) {
  let len = 0;
  let prev = cat;
  for (const p of cat.trail) {
    len += dist(prev, p);
    prev = p;
  }
  return len;
}

function face(cat, dx) {
  if (Math.abs(dx) > 0.01) cat.dir = dx < 0 ? -1 : 1;
}

/** Advance the cat by dt seconds. Mutates and returns `cat`. opts: { encounter, blocked }. */
export function updateCat(cat, dt, player, { encounter = false, blocked = () => false } = {}) {
  dt = Math.min(Math.max(dt, 0), 0.1);
  if (dist(cat, player) > CAT.snapDist) {
    cat.x = player.x;
    cat.y = player.y;
    cat.trail = [];
  }

  if (encounter) {
    cat.trail = [];
    const spot = pickBesideSpot(player, blocked);
    const d = dist(cat, spot);
    if (d > 1.5) {
      const step = Math.min(d, CAT.runSpeed * dt);
      face(cat, spot.x - cat.x);
      cat.x += ((spot.x - cat.x) / d) * step;
      cat.y += ((spot.y - cat.y) / d) * step;
      cat.walkDist += step;
      cat.mode = 'walk';
      cat.t = 0;
    } else {
      if (cat.mode !== 'sit') cat.t = 0;
      cat.mode = 'sit';
      cat.t += dt;
      face(cat, player.x - cat.x);
    }
    return cat;
  }

  // record the player's path
  const last = cat.trail[cat.trail.length - 1];
  if (!last || dist(last, player) >= CAT.trailStep) {
    cat.trail.push({ x: player.x, y: player.y });
    if (cat.trail.length > CAT.maxTrail) cat.trail.shift();
  }

  const total = pathLength(cat);
  const excess = total - CAT.followDist;
  let moved = 0;
  if (excess > 0) {
    const speed = total > CAT.followDist * 3 ? CAT.runSpeed : CAT.speed;
    let budget = Math.min(speed * dt, excess);
    while (budget > 0.0001 && cat.trail.length) {
      const target = cat.trail[0];
      const d = dist(cat, target);
      const step = Math.min(budget, d);
      if (d > 0) {
        face(cat, target.x - cat.x);
        cat.x += ((target.x - cat.x) / d) * step;
        cat.y += ((target.y - cat.y) / d) * step;
      }
      moved += step;
      budget -= step;
      if (step >= d - 0.0001) cat.trail.shift();
    }
  }
  if (moved > 0) {
    cat.walkDist += moved;
    cat.mode = 'walk';
    cat.t = 0;
  } else {
    cat.t += dt;
    cat.mode = cat.t >= CAT.sitAfter ? 'sit' : 'idle';
  }
  return cat;
}

/** Which texture to show: { key, flipX }. Walk = 2 frames, standing = walk frame 1, sitting = 3 tail frames. */
export function catFrame(cat) {
  if (cat.mode === 'sit') {
    const p = cat.t % CAT.flickPeriod;
    const f = p < 2.6 ? 0 : p < 2.8 ? 1 : p < 3.0 ? 2 : 1; // tail flick near the end of each period
    return { key: `cat-sit-${f}`, flipX: false };
  }
  const f = cat.mode === 'walk' ? Math.floor(cat.walkDist / 7) % 2 : 1;
  return { key: `cat-walk-${f}`, flipX: cat.dir < 0 };
}
