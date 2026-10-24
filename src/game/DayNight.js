// DayNight.js — time-of-day tint overlay + building lit-window state
//
// Reads the real system clock each frame and maps the current hour/minute to a
// full-screen colour overlay layered above the weather tint (depth 91000) but
// below all HUD chrome (depth 100000).
//
// Time bands (approximate):
//   00:00–05:00  night       dark navy,   alpha 0.55–0.65
//   05:00–07:00  dawn        blue-purple, alpha 0.30–0.10 (fading in)
//   07:00–17:00  day         clear,       alpha 0.00
//   17:00–19:00  golden hour amber,       alpha 0.05–0.18
//   19:00–20:00  dusk        warm orange, alpha 0.18–0.38
//   20:00–22:00  blue hour   indigo,      alpha 0.38–0.55
//   22:00–24:00  night       dark navy,   alpha 0.55–0.65
//
// The overlay colour and alpha are interpolated smoothly between band
// endpoints — no hard jumps. A tiny per-frame lerp adds extra smoothing.
//
// Lit windows: exposes isNight() so WorldRenderer can ask whether to use
// the warm-window building variants (night hours = 20:00–06:00).

const BANDS = [
  // [ hour_float, colour_hex, alpha ]
  [0.0,  0x0a0820, 0.62],  // midnight
  [5.0,  0x0a0820, 0.62],  // pre-dawn still dark
  [6.0,  0x1a1040, 0.28],  // dawn twilight — violet
  [7.0,  0xffffff, 0.00],  // full daylight
  [17.0, 0xffffff, 0.00],  // still day
  [18.0, 0xff9040, 0.10],  // golden hour begins
  [19.0, 0xff6020, 0.22],  // sunset orange
  [20.0, 0x301860, 0.44],  // blue hour / dusk
  [21.5, 0x0a0820, 0.62],  // night proper
  [24.0, 0x0a0820, 0.62],  // wrap
];

/** Linear interpolation */
function lerp(a, b, t) { return a + (b - a) * t; }

/** Interpolate an RGB hex colour by component. */
function lerpColour(c1, c2, t) {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  return (
    (Math.round(lerp(r1, r2, t)) << 16) |
    (Math.round(lerp(g1, g2, t)) << 8)  |
     Math.round(lerp(b1, b2, t))
  );
}

/** Map a fractional hour (0–24) to {colour, alpha} via the BANDS table. */
function bandAt(h) {
  for (let i = 0; i < BANDS.length - 1; i++) {
    const [h0, c0, a0] = BANDS[i];
    const [h1, c1, a1] = BANDS[i + 1];
    if (h >= h0 && h <= h1) {
      const t = (h - h0) / (h1 - h0);
      return { colour: lerpColour(c0, c1, t), alpha: lerp(a0, a1, t) };
    }
  }
  return { colour: BANDS[0][1], alpha: BANDS[0][2] };
}

/** Current fractional hour from the real system clock (0.0–24.0). */
function realHour() {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

export default class DayNight {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} width  — game canvas width in px
   * @param {number} height — game canvas height in px
   */
  constructor(scene, width, height) {
    this.scene = scene;

    // Full-screen scrollFactor(0) rect sitting above weather (89980) and
    // weather particles (90000) but below HUD (100000).
    this.rect = scene.add
      .rectangle(0, 0, width, height, 0x0a0820, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(91000);

    // Current smoothed state
    this._colour = 0xffffff;
    this._alpha  = 0;

    // Clock is read every second at most — skip sub-second overhead per frame.
    this._lastClockCheck = -Infinity;
    this._cachedHour = realHour();

    // Smooth lerp speed: 1.5 means "half the gap closed in ~0.46 s"
    this.LERP_SPEED = 1.5;

    // Apply immediately on construction so there is no flash of a wrong shade.
    this._apply(true);
  }

  /** True during "night" hours (20:00–06:00) — used by WorldRenderer for lit windows. */
  isNight() {
    const h = this._cachedHour;
    return h >= 20 || h < 6;
  }

  /** True during dawn/dusk transition hours — buildings emit a softer glow. */
  isTwilight() {
    const h = this._cachedHour;
    return (h >= 5 && h < 7) || (h >= 17 && h < 20);
  }

  /**
   * Call every frame from GameScene.update().
   * @param {number} dtMs — frame delta in milliseconds
   */
  update(dtMs) {
    const now = Date.now();
    if (now - this._lastClockCheck > 1000) {
      this._cachedHour = realHour();
      this._lastClockCheck = now;
    }
    this._apply(false, Math.min(dtMs, 100) / 1000);
  }

  _apply(instant, dt = 0) {
    const { colour, alpha } = bandAt(this._cachedHour);

    if (instant) {
      this._colour = colour;
      this._alpha  = alpha;
    } else {
      // Per-channel lerp for colour
      const r1 = (this._colour >> 16) & 0xff, g1 = (this._colour >> 8) & 0xff, b1 = this._colour & 0xff;
      const r2 = (colour >> 16) & 0xff,        g2 = (colour >> 8) & 0xff,        b2 = colour & 0xff;
      const t = Math.min(1, this.LERP_SPEED * dt);
      this._colour =
        (Math.round(lerp(r1, r2, t)) << 16) |
        (Math.round(lerp(g1, g2, t)) << 8)  |
         Math.round(lerp(b1, b2, t));
      this._alpha = lerp(this._alpha, alpha, t);
    }

    this.rect.setFillStyle(this._colour, this._alpha);
  }

  destroy() {
    this.rect?.destroy();
  }
}
