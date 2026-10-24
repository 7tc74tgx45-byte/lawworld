// The knowledge garden in the hub (T13): six soil plots drawn from the save. Rules live in src/logic/garden.js;
// this file only owns the sprites and the "which plot is the player next to" query.
import { gardenView, plotIdFor, PLOT_COUNT } from '../logic/garden.js';
import { TILE_SIZE, tileCentre } from '../logic/worldQuery.js';
import { makeGardenTextures, plantKey } from './gardenDraw.js';

export const PLOT_REACH = TILE_SIZE * 1.1;

export default class Garden {
  constructor(scene, world) {
    this.scene = scene;
    this.plots = world.garden?.plots ?? [];
    makeGardenTextures(scene);
    this.sprites = this.plots.map((p) => scene.add.image(p.tx * TILE_SIZE, p.ty * TILE_SIZE, 'plot-empty').setOrigin(0).setDepth(p.ty * TILE_SIZE + 8));
    this.keys = this.plots.map(() => 'plot-empty');
    this.view = [];
    // "Needs water" droplet over each thirsty plot; it bobs gently so it catches the eye.
    this.icons = this.plots.map((p) => scene.add.image(p.tx * TILE_SIZE + TILE_SIZE / 2, p.ty * TILE_SIZE - 6, 'needs-water').setOrigin(0.5, 1).setDepth(p.ty * TILE_SIZE + 40).setVisible(false));
    this.bob = scene.tweens?.add({ targets: this.icons, y: '-=3', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Redraw from the save (call after planting/watering and every so often, since plants wither with time). */
  refresh(save, now = Date.now()) {
    this.view = gardenView(save, now);
    this.plots.forEach((p, i) => {
      const v = this.view[i];
      if (!v) return;
      this.icons[i].setVisible(!v.empty && !!v.thirsty);
      const key = v.empty ? 'plot-empty' : plantKey(v.stage, v.status === 'withered');
      if (key !== this.keys[i]) {
        this.keys[i] = key;
        this.sprites[i].setTexture(key);
      }
    });
  }

  /** The plot within reach of (x, y), nearest first, with its view-model entry; null if none. */
  nearest(x, y) {
    let best = null;
    this.plots.forEach((p, i) => {
      const c = tileCentre(p.tx, p.ty);
      const d = Math.hypot(c.x - x, c.y - y);
      if (d <= PLOT_REACH && (!best || d < best.distance)) best = { plotId: plotIdFor(i), view: this.view[i], distance: d };
    });
    return best;
  }

  get count() { return Math.min(PLOT_COUNT, this.plots.length); }
}
