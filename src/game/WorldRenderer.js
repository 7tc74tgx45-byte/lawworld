// Renders the generated world: ground chunks drawn lazily to canvas textures near the camera, plus building,
// signpost and brazier sprites. Collision itself is pure (src/logic/worldQuery.js); nothing here is physics.
import { TILE_SIZE } from '../logic/worldQuery.js';
import { drawTile } from './tileDraw.js';
import { makeBuildingTextures, makeFurnitureTextures, buildingKey } from './sprites.js';

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
    this.stateKey = new Map();
    makeBuildingTextures(scene);
    makeFurnitureTextures(scene);
    this.addFurniture();
  }

  addFurniture() {
    const { scene, world } = this;
    for (const d of world.districts) {
      scene.add.image(d.signpost.tx * TILE_SIZE, d.signpost.ty * TILE_SIZE, 'signpost').setOrigin(0).setDepth(d.signpost.ty * TILE_SIZE + 24);
      const br = scene.add.image(d.brazier.tx * TILE_SIZE, d.brazier.ty * TILE_SIZE, 'brazier-unlit').setOrigin(0).setDepth(d.brazier.ty * TILE_SIZE + 24);
      this.braziers.set(d.id, br);
    }
    for (const b of world.buildings) {
      const spr = scene.add.image(b.tx * TILE_SIZE, b.ty * TILE_SIZE, buildingKey('locked', b.side)).setOrigin(0).setDepth(b.ty * TILE_SIZE + 64);
      this.buildingSprites.set(b.id, spr);
    }
  }

  /** states: { [subsectionId]: state }, litDistricts: Set of district ids. Only touches sprites that changed. */
  applyStates(states, litDistricts = new Set()) {
    for (const b of this.world.buildings) {
      const s = states[b.id] ?? 'locked';
      if (this.stateKey.get(b.id) === s) continue;
      this.stateKey.set(b.id, s);
      this.buildingSprites.get(b.id).setTexture(buildingKey(s, b.side));
    }
    for (const [id, img] of this.braziers) {
      const key = litDistricts.has(id) ? 'brazier-lit' : 'brazier-unlit';
      if (img.texture.key !== key) img.setTexture(key);
    }
  }

  chunkImage(cx, cy) {
    const { scene, world } = this;
    const key = `chunk-${cx}-${cy}`;
    const tex = scene.textures.createCanvas(key, CHUNK_PX, CHUNK_PX);
    const ctx = tex.getContext();
    const regionsByIndex = world.regions;
    for (let y = 0; y < CHUNK_TILES; y++) {
      for (let x = 0; x < CHUNK_TILES; x++) {
        const tx = cx * CHUNK_TILES + x;
        const ty = cy * CHUNK_TILES + y;
        if (tx >= world.cols || ty >= world.rows) continue;
        drawTile(ctx, world, regionsByIndex, tx, ty, x * TILE_SIZE, y * TILE_SIZE);
      }
    }
    tex.refresh();
    return scene.add.image(cx * CHUNK_PX, cy * CHUNK_PX, key).setOrigin(0).setDepth(-10);
  }

  /** Create chunks near the camera and free the ones far away. Call every frame (cheap when nothing changes). */
  update(cam) {
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
