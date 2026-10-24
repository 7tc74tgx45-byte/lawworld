import Phaser from 'phaser';
import './style.css';
import GameScene from './game/GameScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  // Collision is tile-based and pure (src/logic/worldQuery.js), so no physics engine is needed.
  pixelArt: true,
  scene: [GameScene],
});
