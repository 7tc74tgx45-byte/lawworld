import Phaser from 'phaser';

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

  update() {
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
