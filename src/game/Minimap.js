// Minimap.js — 160×160 px HTML canvas minimap, fixed bottom-right.
//
// Renders the world layout as coloured blobs (one per district, tinted by
// region/season) with the player dot on top. Redraws up to 5× per second
// (throttled to keep it cheap). Click or press M to toggle between compact
// (160×160) and zoomed-in (300×300) views.
//
// Entirely HTML canvas — not a Phaser object — so it sits above the game
// canvas via CSS z-index without fighting the Phaser depth system.
//
// Colours used for each region season (chosen to contrast with the map ground):
//   spring  →  #7ec87e  (soft green)
//   summer  →  #e8c44a  (golden yellow)
//   autumn  →  #c87040  (terra cotta orange)
//   winter  →  #7ab0d4  (icy blue)
//   hub     →  #b0a090  (warm grey — the hub has no season)

import { TILE_SIZE } from '../logic/worldQuery.js';

const SEASON_COLOUR = {
  spring: '#7ec87e',
  summer: '#e8c44a',
  autumn: '#c87040',
  winter: '#7ab0d4',
  default: '#b0a090',
};

const SIZES = [160, 280]; // compact, zoomed

export default class Minimap {
  /**
   * @param {object}   world      — the object returned by buildWorld()
   * @param {Element}  container  — the DOM element that wraps the Phaser canvas
   */
  constructor(world, container) {
    this.world = world;
    this._sizeIdx = 0; // 0 = compact, 1 = zoomed
    this._dirty = true;
    this._lastDraw = 0;
    this._THROTTLE_MS = 200; // redraw at most every 200 ms

    // Build a fast lookup: regionId → season colour
    this._regionColour = new Map();
    for (const r of world.regions) {
      this._regionColour.set(r.id, SEASON_COLOUR[r.season] ?? SEASON_COLOUR.default);
    }

    // ── DOM: wrapper div (clip + backdrop) ──────────────────────────────────
    const wrap = document.createElement('div');
    wrap.id = 'lw-minimap';
    Object.assign(wrap.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      zIndex: '9000',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.7)',
      border: '2px solid rgba(255,255,255,0.18)',
      cursor: 'pointer',
      transition: 'width 0.2s, height 0.2s',
      userSelect: 'none',
    });

    // Canvas
    const canvas = document.createElement('canvas');
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    wrap.append(canvas);

    // "M" label
    const label = document.createElement('div');
    label.textContent = 'M';
    Object.assign(label.style, {
      position: 'absolute',
      bottom: '4px',
      left: '6px',
      fontSize: '10px',
      color: 'rgba(255,255,255,0.5)',
      pointerEvents: 'none',
    });
    wrap.append(label);

    this._wrap = wrap;
    container.appendChild(wrap);

    // Click to toggle zoom
    wrap.addEventListener('click', () => this.toggleZoom());

    // Keyboard shortcut: M
    this._keyHandler = (e) => {
      if (e.key === 'm' || e.key === 'M') {
        e.stopPropagation();
        this.toggleZoom();
      }
    };
    window.addEventListener('keydown', this._keyHandler, { capture: true });

    // Initialise size
    this._setSize(SIZES[0]);

    // Pre-render the static world backdrop (districts + region outlines)
    // onto an offscreen canvas so we only need to blit + draw the player dot each frame.
    this._buildBackdrop();
  }

  get _size() { return SIZES[this._sizeIdx]; }

  toggleZoom() {
    this._sizeIdx = (this._sizeIdx + 1) % SIZES.length;
    this._setSize(SIZES[this._sizeIdx]);
    this._buildBackdrop();
    this._dirty = true;
  }

  _setSize(px) {
    this._canvas.width = px;
    this._canvas.height = px;
    Object.assign(this._wrap.style, { width: `${px}px`, height: `${px}px` });
  }

  /** Build/rebuild the static district backdrop onto an offscreen canvas. */
  _buildBackdrop() {
    const sz = this._size;
    const { world } = this;

    // Scale so the whole world fits inside the canvas
    const scaleX = sz / world.cols;
    const scaleY = sz / world.rows;

    this._scaleX = scaleX;
    this._scaleY = scaleY;

    const off = document.createElement('canvas');
    off.width = sz;
    off.height = sz;
    const c = off.getContext('2d');

    // Background (water / empty)
    c.fillStyle = '#1a2a3a';
    c.fillRect(0, 0, sz, sz);

    // Draw each district as a filled rect
    for (const d of world.districts) {
      const col = this._regionColour.get(d.regionId) ?? SEASON_COLOUR.default;
      const { x, y, w, h } = d.rect; // in tiles
      c.fillStyle = col + 'cc'; // ~80% opaque
      c.fillRect(
        Math.round(x * scaleX),
        Math.round(y * scaleY),
        Math.max(2, Math.round(w * scaleX)),
        Math.max(2, Math.round(h * scaleY)),
      );
      // Subtle district border
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 0.5;
      c.strokeRect(
        Math.round(x * scaleX) + 0.5,
        Math.round(y * scaleY) + 0.5,
        Math.max(2, Math.round(w * scaleX)) - 1,
        Math.max(2, Math.round(h * scaleY)) - 1,
      );
    }

    // Region outlines (faint)
    for (const r of world.regions) {
      const { x, y, w, h } = r.rect;
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.lineWidth = 1;
      c.strokeRect(
        Math.round(x * scaleX),
        Math.round(y * scaleY),
        Math.round(w * scaleX),
        Math.round(h * scaleY),
      );
    }

    this._backdrop = off;
  }

  /**
   * Call every frame from GameScene.update() with the current player world position (px).
   * @param {number} playerX  — world pixel x
   * @param {number} playerY  — world pixel y
   * @param {number} nowMs    — Date.now() or the Phaser timestamp
   */
  update(playerX, playerY, nowMs) {
    if (!this._dirty && nowMs - this._lastDraw < this._THROTTLE_MS) return;
    this._dirty = false;
    this._lastDraw = nowMs;

    const sz = this._size;
    const ctx = this._ctx;

    // Blit the static backdrop
    ctx.clearRect(0, 0, sz, sz);
    ctx.drawImage(this._backdrop, 0, 0);

    // Player dot — world px → tile → canvas px
    const dotX = (playerX / TILE_SIZE) * this._scaleX;
    const dotY = (playerY / TILE_SIZE) * this._scaleY;

    // Outer glow
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // White dot
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Tiny direction indicator (tiny triangle)
    // We don't store the facing here, so just a clean white dot is fine.
  }

  /** Force a redraw on the next frame (e.g. after a teleport or map change). */
  invalidate() {
    this._dirty = true;
  }

  /** Remove DOM elements and event listeners. */
  destroy() {
    this._wrap?.remove();
    window.removeEventListener('keydown', this._keyHandler, { capture: true });
  }
}
