import Phaser from 'phaser';
import { openEncounter } from '../ui/encounter.js';
import { createOfflineTutor } from '../api/offlineTutor.js';
import { demoSubsection } from '../data/demoSubsection.js';

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

    // Player — centred on the map
    this.player = this.physics.add.image(
      (MAP_COLS * TILE_SIZE) / 2,
      (MAP_ROWS * TILE_SIZE) / 2,
      'player'
    );
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

  openDemoEncounter() {
    if (this.encounterOpen) return;
    this.encounterOpen = true;
    openEncounter({
      subsection: demoSubsection,
      tutor: createOfflineTutor(),
      onOpen: () => this.setKeyboardForOverlay(true),
      onClose: (res) => {
        this.setKeyboardForOverlay(false);
        this.encounterOpen = false;
        const gaps = res.gaps.length;
        this.banner.setText(`${demoSubsection.title}: ${res.outcome.toUpperCase()}${gaps ? ` (${gaps} gap${gaps > 1 ? 's' : ''} logged)` : ''}`);
        this.time.delayedCall(6000, () => this.banner.setText(''));
      },
    });
  }

  /** While a DOM overlay is open, Phaser must not swallow or capture keys. */
  setKeyboardForOverlay(open) {
    const kb = this.input.keyboard;
    if (open) {
      kb.enabled = false;
      kb.removeAllCaptures();
      kb.resetKeys();
      this.player.setVelocity(0, 0);
    } else {
      kb.enabled = true;
      kb.addCapture(this.captureCodes);
      kb.resetKeys();
    }
  }

  update() {
    if (this.encounterOpen) return;
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
