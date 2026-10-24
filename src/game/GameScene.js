import Phaser from 'phaser';
import { openEncounter } from '../ui/encounter.js';
import { openOverlay, setOverlayHandlers, isAnyOverlayOpen } from '../ui/dom.js';
import { openSettings } from '../ui/settings.js';
import { downloadSave, pickAndImportSave } from '../ui/saveAdapter.js';
import { createOfflineTutor } from '../api/offlineTutor.js';
import { hasOfflineBank } from '../data/offlineBank.js';
import { getClaudeKey } from '../api/claude.js';
import { getObsidianConfig } from '../api/obsidian.js';
import { chooseMode } from '../logic/tutorMode.js';
import { openGaps } from '../logic/progress.js';
import { demoSubsection } from '../data/demoSubsection.js';
import { getSaveStore } from '../ui/saveAdapter.js';

const TILE_SIZE = 32;
const MAP_COLS = 30;
const MAP_ROWS = 20;
const PLAYER_SPEED = 160;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Generate textures programmatically — no external assets needed
    const tileGfx = this.make.graphics({ x: 0, y: 0, add: false });
    // Ground tile: green fill with slightly darker border
    tileGfx.fillStyle(0x3a7d44);
    tileGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    tileGfx.lineStyle(1, 0x2d6035, 1);
    tileGfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    tileGfx.generateTexture('tile', TILE_SIZE, TILE_SIZE);
    tileGfx.destroy();

    const playerGfx = this.make.graphics({ x: 0, y: 0, add: false });
    playerGfx.fillStyle(0xffffff);
    playerGfx.fillRect(0, 0, 20, 20);
    playerGfx.generateTexture('player', 20, 20);
    playerGfx.destroy();
  }

  create() {
    // Draw tile map
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        this.add.image(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, 'tile');
      }
    }

    // Save: restore exactly where the player was (VISION §7)
    this.saveStore = getSaveStore();
    const saved = this.saveStore.state.player;
    const hasSave = this.saveStore.loadStatus === 'loaded';
    const startX = hasSave ? Phaser.Math.Clamp(saved.x, 0, MAP_COLS * TILE_SIZE) : (MAP_COLS * TILE_SIZE) / 2;
    const startY = hasSave ? Phaser.Math.Clamp(saved.y, 0, MAP_ROWS * TILE_SIZE) : (MAP_ROWS * TILE_SIZE) / 2;

    // Player — centred on the map (or where the save left them)
    this.player = this.physics.add.image(startX, startY, 'player');
    this.lastSavedPos = { x: Math.round(startX), y: Math.round(startY) };
    this.time.addEvent({ delay: 2000, loop: true, callback: () => this.savePosition() });
    this.player.setCollideWorldBounds(true);

    // Constrain physics world to map size
    this.physics.world.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);

    // Camera follows the player
    this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.captureCodes = [
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.E,
    ];

    // Demo trigger: a grey rectangle labelled "Contract Law" near the player start
    const zw = 96;
    const zh = 64;
    const zx = this.player.x + 112;
    const zy = this.player.y - 96;
    this.demoZone = new Phaser.Geom.Rectangle(zx - zw / 2, zy - zh / 2, zw, zh);
    this.add.rectangle(zx, zy, zw, zh, 0x8a8a8a).setStrokeStyle(2, 0x555555);
    this.add
      .text(zx, zy, 'Contract Law', { fontSize: '13px', fill: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.zonePrompt = this.add
      .text(zx, zy - zh / 2 - 12, 'Press E to study', {
        fontSize: '12px',
        fill: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.encounterOpen = false;
    // Any DOM overlay (encounter, menu, settings) disables Phaser keyboard + captures; the last one closing restores them.
    setOverlayHandlers({
      lock: () => this.setKeyboardForOverlay(true),
      unlock: () => this.setKeyboardForOverlay(false),
    });
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.banner = this.add
      .text(400, 570, '', { fontSize: '13px', fill: '#ffffff', backgroundColor: '#000000aa', padding: { x: 6, y: 3 } })
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Controls hint
    this.add
      .text(8, 8, 'WASD / Arrow keys to move', {
        fontSize: '12px',
        fill: '#ffffff',
        backgroundColor: '#00000066',
        padding: { x: 4, y: 2 },
      })
      .setScrollFactor(0);
  }

  /** Autosave the player's position, but only when they actually moved. */
  savePosition() {
    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);
    if (x === this.lastSavedPos.x && y === this.lastSavedPos.y) return;
    this.lastSavedPos = { x, y };
    this.saveStore.update((s) => ({ ...s, player: { ...s.player, x, y } }));
  }

  openDemoEncounter() {
    if (this.encounterOpen) return;
    this.encounterOpen = true;
    const sub = demoSubsection;
    const personaId = this.saveStore.state.tutorPreference?.[sub.id] ?? 'hale';
    const makeOfflineTutor = () => createOfflineTutor({ personaId });
    const { mode } = chooseMode({
      hasClaudeKey: !!getClaudeKey(),
      hasObsidianToken: !!getObsidianConfig().token,
      hasOfflineBank: hasOfflineBank(sub.id),
    });
    // The demo subsection has no vault heading, so Claude can only be used for real curriculum subsections.
    // Until the world is generated from the curriculum (T09) the demo always runs offline.
    void mode;
    let recorded = false;
    openEncounter({
      subsection: sub,
      tutor: makeOfflineTutor(),
      makeOfflineTutor,
      priorGaps: openGaps(this.saveStore.state.progress, { subsectionId: sub.id }),
      // The encounter's end writes its result into progress + save exactly once:
      // on the verdict (onFinish), or when the player leaves early (onClose, not finished).
      onFinish: (res) => {
        recorded = true;
        this.recordEncounter(sub, res);
      },
      onClose: (res) => {
        this.encounterOpen = false;
        if (!recorded) this.recordEncounter(sub, res);
      },
    });
  }

  /** Write an encounter result into progress and save (immediate), and tell the player what happened. */
  recordEncounter(sub, res) {
    const changed = this.saveStore.applyEncounter(res, { subsection: sub });
    if (!changed) {
      this.showBanner(`${sub.title}: nothing answered, so nothing changed.`);
      return;
    }
    const gaps = res.gaps.length;
    this.showBanner(`${sub.title}: ${res.outcome.toUpperCase()}${gaps ? ` (${gaps} gap${gaps > 1 ? 's' : ''} logged)` : ''}`);
  }

  showBanner(text, ms = 6000) {
    this.banner.setText(text);
    this.bannerTimer?.remove();
    this.bannerTimer = this.time.delayedCall(ms, () => this.banner.setText(''));
  }

  openMenu() {
    if (isAnyOverlayOpen()) return;
    const { panel, close } = openOverlay({ panelClass: 'small', onEscape: () => close() });
    const items = [
      ['Resume', () => close()],
      ['Settings (Claude key, Obsidian)', () => { close(); openSettings(); }],
      ['Save now', () => { this.saveStore.save(); this.banner.setText('Saved.'); this.time.delayedCall(2500, () => this.banner.setText('')); close(); }],
      ['Export save (download JSON)', () => downloadSave(this.saveStore)],
      ['Import save (JSON file)', async () => {
        const r = await pickAndImportSave(this.saveStore);
        if (r.ok) window.location.reload();
        else if (!r.cancelled) this.banner.setText(r.message);
      }],
    ];
    panel.append(Object.assign(document.createElement('h2'), { className: 'lw-h', textContent: 'Menu' }));
    const list = document.createElement('div');
    list.className = 'lw-menu-list';
    items.forEach(([label, fn]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lw-btn';
      b.textContent = label;
      b.onclick = fn;
      list.append(b);
    });
    panel.append(list);
  }

  /** While a DOM overlay is open, Phaser must not swallow or capture keys. */
  setKeyboardForOverlay(open) {
    const kb = this.input.keyboard;
    if (open) {
      kb.enabled = false;
      if (kb.removeAllCaptures) kb.removeAllCaptures(); else kb.clearCaptures && kb.clearCaptures();
      kb.resetKeys();
      this.player.setVelocity(0, 0);
    } else {
      kb.enabled = true;
      kb.addCapture(this.captureCodes);
      kb.resetKeys();
    }
  }

  update() {
    if (this.encounterOpen || isAnyOverlayOpen()) return;
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.openMenu();
      return;
    }
    const near = Phaser.Geom.Rectangle.Overlaps(this.demoZone, this.player.getBounds());
    this.zonePrompt.setVisible(near);
    if (near && Phaser.Input.Keyboard.JustDown(this.eKey)) {
      this.openDemoEncounter();
      return;
    }
    const { up, down, left, right } = this.wasd;
    const { up: aUp, down: aDown, left: aLeft, right: aRight } = this.cursors;

    let vx = 0;
    let vy = 0;

    if (left.isDown || aLeft.isDown) vx = -PLAYER_SPEED;
    else if (right.isDown || aRight.isDown) vx = PLAYER_SPEED;

    if (up.isDown || aUp.isDown) vy = -PLAYER_SPEED;
    else if (down.isDown || aDown.isDown) vy = PLAYER_SPEED;

    // Normalise diagonal movement
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    this.player.setVelocity(vx, vy);
  }
}
