// Renders the generated world: ground chunks drawn lazily to canvas textures near the camera, plus building,
// signpost and brazier sprites. Collision itself is pure (src/logic/worldQuery.js); nothing here is physics.
import Phaser from 'phaser';
import { TILE_SIZE } from '../logic/worldQuery.js';
import { drawTile } from './tileDraw.js';
import { makeGardenTextures } from './gardenDraw.js';
import { ensureBuildingTexture, ensureLectureHallTexture, LH_PX_H, BLD_PX_H, makeFurnitureTextures, makeCharacterTextures, makeWeatherTextures } from './sprites.js';

const LH_EXTRA_PX = LH_PX_H - BLD_PX_H; // extra height in pixels for the lecture hall tower

const CHUNK_TILES = 16;
const CHUNK_PX = CHUNK_TILES * TILE_SIZE;

export default class WorldRenderer {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunks = new Map(); // "cx,cy" -> Phaser.GameObjects.Image
    this.chunkCols = Math.ceil(world.cols / CHUNK_TILES);
    this.chunkRows = Math.ceil(world.rows / CHUNK_TILES);
    this.buildingSprites = new Map(); // id -> Image
    this.braziers = new Map(); // districtId -> Image
    this.glows = new Map(); // districtId -> additive glow Image (lit braziers only)
    this.lit = new Set();
    this.flame = 0;
    this.seasonOf = new Map(world.regions.map((r) => [r.id, r.season]));
    makeFurnitureTextures(scene);
    makeCharacterTextures(scene);
    makeWeatherTextures(scene);
    makeGardenTextures(scene);
    this.stateKey = new Map();
    this.alertIcons = new Map(); // buildingId -> Image (needs-review icon)
    this.addFurniture();
  }

  buildingTexture(b, state) {
    const season = this.seasonOf.get(b.regionId) ?? 'spring';
    if (b.type === 'lecture') return ensureLectureHallTexture(this.scene, state, b.side, season);
    return ensureBuildingTexture(this.scene, state, b.side, season);
  }

  addFurniture() {
    const { scene, world } = this;
    for (const d of world.districts) {
      scene.add.image(d.signpost.tx * TILE_SIZE, d.signpost.ty * TILE_SIZE, 'signpost').setOrigin(0).setDepth(d.signpost.ty * TILE_SIZE + 24);
      const br = scene.add.image(d.brazier.tx * TILE_SIZE, d.brazier.ty * TILE_SIZE, 'brazier-unlit').setOrigin(0).setDepth(d.brazier.ty * TILE_SIZE + 24);
      this.braziers.set(d.id, br);
    }
    for (const b of world.buildings) {
      // Lecture halls are taller: shift the sprite up so the door stays at the tile position.
      const sprY = b.tx * TILE_SIZE;
      const extraH = b.type === 'lecture' ? LH_EXTRA_PX : 0;
      const sprX = b.tx * TILE_SIZE;
      const sprYpos = b.ty * TILE_SIZE - (b.side === 'top' ? 0 : extraH);
      const spr = scene.add.image(sprX, sprYpos, this.buildingTexture(b, 'locked')).setOrigin(0).setDepth(b.ty * TILE_SIZE + 64);
      void sprY;
      this.buildingSprites.set(b.id, spr);
      // Alert icon above the building door (centred, slightly above mid-height). Hidden until explored.
      const alertX = b.tx * TILE_SIZE + (b.side === 2 ? 32 : 16);
      const alertY = b.ty * TILE_SIZE + 8;
      const alert = scene.add.image(alertX, alertY, 'needs-review').setOrigin(0.5, 1).setDepth(b.ty * TILE_SIZE + 72).setVisible(false);
      this.alertIcons.set(b.id, alert);
    }
  }

  /** states: { [subsectionId]: state }, litDistricts: Set of district ids. Only touches sprites that changed. */
  applyStates(states, litDistricts = new Set()) {
    for (const b of this.world.buildings) {
      const s = states[b.id] ?? 'locked';
      if (this.stateKey.get(b.id) === s) continue;
      this.stateKey.set(b.id, s);
      this.buildingSprites.get(b.id).setTexture(this.buildingTexture(b, s));
      // Show alert icon only on buildings that have been explored but not yet consolidated.
      this.alertIcons.get(b.id)?.setVisible(s === 'explored');
    }
    this.lit = new Set(litDistricts);
    this.paintBraziers();
  }

  paintBraziers() {
    for (const [id, img] of this.braziers) {
      const isLit = this.lit.has(id);
      const key = isLit ? `brazier-lit-${this.flame}` : 'brazier-unlit';
      if (img.texture.key !== key) img.setTexture(key);
      this.glowFor(id, img, isLit);
    }
  }

  /** A warm additive glow behind a lit brazier; created on first light, hidden if the brazier ever went out. */
  glowFor(id, img, isLit) {
    let glow = this.glows.get(id);
    if (!isLit) { glow?.setVisible(false); return; }
    if (!glow) {
      glow = this.scene.add.image(img.x + 16, img.y + 12, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(img.depth + 1).setAlpha(0.55);
      this.glows.set(id, glow);
    }
    glow.setVisible(true);
  }

  /** Gentle flicker for every lit glow. */
  pulseGlows(time) {
    for (const g of this.glows.values()) {
      if (!g.visible) continue;
      g.setAlpha(0.5 + 0.12 * Math.sin(time / 260 + g.x) + 0.05 * Math.sin(time / 97 + g.y));
      g.setScale(1 + 0.04 * Math.sin(time / 420 + g.x));
    }
  }

  chunkImage(cx, cy) {
    const { scene, world } = this;
    const key = `chunk-${cx}-${cy}`;
    const tex = scene.textures.createCanvas(key, CHUNK_PX, CHUNK_PX);
    const ctx = tex.getContext();
    for (let y = 0; y < CHUNK_TILES; y++) {
      for (let x = 0; x < CHUNK_TILES; x++) {
        const tx = cx * CHUNK_TILES + x;
        const ty = cy * CHUNK_TILES + y;
        if (tx >= world.cols || ty >= world.rows) continue;
        drawTile(ctx, world, world.regions, tx, ty, x * TILE_SIZE, y * TILE_SIZE);
      }
    }
    tex.refresh();
    return scene.add.image(cx * CHUNK_PX, cy * CHUNK_PX, key).setOrigin(0).setDepth(-10);
  }

  /** Create chunks near the camera and free the ones far away. Call every frame (cheap when nothing changes). */
  update(cam, time = 0) {
    this.pulseGlows(time);
    const flame = Math.floor(time / 220) % 2;
    if (flame !== this.flame) {
      this.flame = flame;
      if (this.lit.size) this.paintBraziers();
    }
    const view = cam.worldView;
    const margin = CHUNK_PX;
    const x0 = Math.max(0, Math.floor((view.x - margin) / CHUNK_PX));
    const x1 = Math.min(this.chunkCols - 1, Math.floor((view.right + margin) / CHUNK_PX));
    const y0 = Math.max(0, Math.floor((view.y - margin) / CHUNK_PX));
    const y1 = Math.min(this.chunkRows - 1, Math.floor((view.bottom + margin) / CHUNK_PX));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = `${cx},${cy}`;
        if (!this.chunks.has(k)) this.chunks.set(k, this.chunkImage(cx, cy));
      }
    }
    for (const [k, img] of this.chunks) {
      const [cx, cy] = k.split(',').map(Number);
      if (cx < x0 - 1 || cx > x1 + 1 || cy < y0 - 1 || cy > y1 + 1) {
        const key = img.texture.key;
        img.destroy();
        this.scene.textures.remove(key);
        this.chunks.delete(k);
      }
    }
  }
}
