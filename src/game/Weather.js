// Weather particle layer (Phaser side). The movement maths lives in src/logic/weather.js; this just draws it in
// screen space. Switching season fades the old weather out, swaps, and fades the new one in.
import { weatherFor, KIND_TEXTURES, makeRng, makeParticles, stepParticle, particleAlpha } from '../logic/weather.js';

const MAX = 80;
const FADE = 0.7; // seconds each way

export default class Weather {
  constructor(scene, width = 800, height = 600) {
    this.scene = scene;
    this.w = width;
    this.h = height;
    this.rng = makeRng(20240601);
    this.kind = null;
    this.season = null;
    this.pending = null;
    this.level = 0; // 0..1 master opacity
    this.parts = [];
    this.imgs = Array.from({ length: MAX }, () => scene.add.image(0, 0, 'fx-snow-a').setScrollFactor(0).setDepth(90000).setVisible(false));
    this.mist = Array.from({ length: 5 }, (_, i) =>
      scene.add.image(i * 180, 80 + i * 100, 'fx-mist').setScrollFactor(0).setDepth(89990).setScale(6, 5).setVisible(false).setAlpha(0));
    this.tint = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(89980);
  }

  /** Ask for a season's weather. Instant the first time, a crossfade afterwards. */
  setSeason(season, instant = false) {
    if (season === this.season && !this.pending) return;
    if (!this.kind || instant) {
      this.apply(season);
      this.level = instant ? 1 : 0;
      return;
    }
    if (season !== this.season) this.pending = season;
  }

  apply(season) {
    const cfg = weatherFor(season);
    this.season = season;
    this.kind = cfg.kind;
    this.cfg = cfg;
    this.parts = makeParticles(cfg.kind, cfg.count, this.rng, this.w, this.h);
    this.mist.forEach((m, i) => m.setVisible(i < cfg.mist));
    const tints = { spring: [0xffd6e8, 0.04], summer: [0xfff2a0, 0.06], autumn: [0xd9822b, 0.07], winter: [0xcfe4f5, 0.08] };
    const [c, a] = tints[season] ?? [0xffffff, 0];
    this.tint.setFillStyle(c, a);
  }

  update(dtMs) {
    const dt = Math.min(dtMs, 100) / 1000;
    if (this.pending) {
      this.level -= dt / FADE;
      if (this.level <= 0) {
        this.level = 0;
        this.apply(this.pending);
        this.pending = null;
      }
    } else if (this.level < 1) {
      this.level = Math.min(1, this.level + dt / FADE);
    }
    if (!this.kind) return;
    const names = KIND_TEXTURES[this.kind];
    for (let i = 0; i < MAX; i++) {
      const img = this.imgs[i];
      const p = this.parts[i];
      if (!p) {
        img.setVisible(false);
        continue;
      }
      stepParticle(p, this.kind, dt, this.w, this.h);
      img.setVisible(true).setTexture(names[p.variant % names.length]).setPosition(Math.round(p.x), Math.round(p.y));
      img.setRotation(this.kind === 'leaf' || this.kind === 'petal' ? p.rot : 0);
      img.setAlpha(particleAlpha(p, this.kind) * this.level);
      img.setScale(this.kind === 'snow' ? 1.5 : 2);
    }
    this.mist.forEach((m, i) => {
      if (!m.visible) return;
      m.x += (6 + i * 2) * dt;
      if (m.x > this.w + 100) m.x = -300;
      m.setAlpha(0.55 * this.level);
    });
    this.tint.setAlpha(this.level);
  }
}
