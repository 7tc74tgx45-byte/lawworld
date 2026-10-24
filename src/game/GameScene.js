import Phaser from 'phaser';
import { openEncounter } from '../ui/encounter.js';
import { openOverlay, setOverlayHandlers, isAnyOverlayOpen } from '../ui/dom.js';
import { openSettings } from '../ui/settings.js';
import { openDoorPanel } from '../ui/doorPanel.js';
import { downloadSave, pickAndImportSave, getSaveStore } from '../ui/saveAdapter.js';
import { createOfflineTutor } from '../api/offlineTutor.js';
import { createClaudeTutor } from '../api/tutor.js';
import { writeSessionNote, loadPriorSessions } from '../api/sessionNotes.js';
import { hasOfflineBank } from '../data/offlineBank.js';
import { getClaudeKey } from '../api/claude.js';
import { getObsidianConfig } from '../api/obsidian.js';
import { curriculum } from '../data/curriculum.js';
import { allDistricts, findSubsection, locateSubsection } from '../logic/curriculum.js';
import { computeStates, isBrazierLit, openGaps } from '../logic/progress.js';
import { describeDoor } from '../logic/doorInfo.js';
import { buildWorld } from '../logic/layout.js';
import { TILE_SIZE, blockedAt, regionAt, moveWithCollision, doorNear, tileCentre } from '../logic/worldQuery.js';
import { STATE_LABEL } from './palette.js';
import WorldRenderer from './WorldRenderer.js';

const PLAYER_SPEED = 150;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.world = buildWorld(curriculum);
    const { world } = this;
    const mapW = world.cols * TILE_SIZE;
    const mapH = world.rows * TILE_SIZE;
    this.districtList = allDistricts(curriculum);

    this.renderer = new WorldRenderer(this, world);

    // Save: restore exactly where the player was (VISION §7). A fresh game, or a position that is now inside a
    // wall (the curriculum grew), starts at the hub fountain.
    this.saveStore = getSaveStore();
    const saved = this.saveStore.state.player;
    const hasSave = this.saveStore.loadStatus === 'loaded';
    const spawn = tileCentre(world.spawn.tx, world.spawn.ty);
    const savedOk = hasSave && Number.isFinite(saved.x) && Number.isFinite(saved.y) && !this.boxBlockedAt(saved.x, saved.y);
    const start = savedOk ? { x: saved.x, y: saved.y } : spawn;

    this.player = this.add.image(start.x, start.y, 'player').setOrigin(0.5, 0.9);
    this.facing = savedOk ? saved.facing : 'down';
    this.lastSavedPos = { x: Math.round(start.x), y: Math.round(start.y) };
    this.time.addEvent({ delay: 2000, loop: true, callback: () => this.savePosition() });

    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setRoundPixels(true);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.captureCodes = [
      Phaser.Input.Keyboard.KeyCodes.W, Phaser.Input.Keyboard.KeyCodes.A, Phaser.Input.Keyboard.KeyCodes.S, Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE, Phaser.Input.Keyboard.KeyCodes.E,
    ];

    this.encounterOpen = false;
    // Any DOM overlay (encounter, menu, settings, door panel) disables Phaser keyboard + captures; the last one closing restores them.
    setOverlayHandlers({
      lock: () => this.setKeyboardForOverlay(true),
      unlock: () => this.setKeyboardForOverlay(false),
    });

    // HUD
    this.banner = this.add
      .text(400, 570, '', { fontSize: '13px', fill: '#ffffff', backgroundColor: '#000000aa', padding: { x: 6, y: 3 }, wordWrap: { width: 760 } })
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(100000);
    this.prompt = this.add
      .text(400, 520, '', { fontSize: '14px', fill: '#ffffff', backgroundColor: '#000000cc', padding: { x: 8, y: 4 }, align: 'center' })
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(100000).setVisible(false);
    this.regionBanner = this.add
      .text(400, 90, '', { fontSize: '30px', fontStyle: 'bold', fill: '#ffffff', stroke: '#000000', strokeThickness: 5, align: 'center' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(100001).setAlpha(0);
    this.add
      .text(8, 8, 'WASD / Arrows to move · E at a door · Esc menu', { fontSize: '12px', fill: '#ffffff', backgroundColor: '#00000066', padding: { x: 4, y: 2 } })
      .setScrollFactor(0).setDepth(100000);

    this.refreshStates();
    this.currentRegionId = null;
    this.updateRegion(true);
    this.renderer.update(this.cameras.main);
  }

  boxBlockedAt(x, y) {
    const half = 6;
    for (const [ox, oy] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
      if (blockedAt(this.world, Math.floor((x + ox) / TILE_SIZE), Math.floor((y + oy) / TILE_SIZE))) return true;
    }
    return false;
  }

  /** Recompute building colours and braziers from progress. */
  refreshStates() {
    const progress = this.saveStore.state.progress;
    this.states = computeStates(curriculum, progress);
    const lit = new Set(this.districtList.filter((d) => isBrazierLit(d, this.states)).map((d) => d.id));
    this.renderer.applyStates(this.states, lit);
  }

  /** Region name banner when the player crosses into a region. */
  updateRegion(silent = false) {
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    const region = regionAt(this.world, tx, ty);
    if (!region || region.id === this.currentRegionId) return;
    this.currentRegionId = region.id;
    if (silent) return;
    const season = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' }[region.season] ?? '';
    const title = region.isHub ? 'Foundations Town' : region.title;
    this.regionBanner.setText(`${title}\n${region.moduleTitle} · ${season}`).setFontSize(30);
    this.tweens.killTweensOf(this.regionBanner);
    this.regionBanner.setAlpha(0);
    this.tweens.add({ targets: this.regionBanner, alpha: 1, duration: 300, yoyo: true, hold: 1600 });
  }

  /** Autosave the player's position and region, but only when they actually moved. */
  savePosition() {
    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);
    if (x === this.lastSavedPos.x && y === this.lastSavedPos.y) return;
    this.lastSavedPos = { x, y };
    const region = this.currentRegionId ?? 'hub';
    this.saveStore.update((s) => ({ ...s, player: { ...s.player, x, y, region, facing: this.facing } }));
  }

  /** E at a door: locked shows the padlock tooltip; otherwise choose a tutor, then the encounter. */
  interactWithDoor(b) {
    const sub = findSubsection(curriculum, b.id);
    if (!sub) return;
    const state = this.saveStore.state;
    const info = describeDoor(curriculum, state.progress, b.id, {
      tutorPreference: state.tutorPreference,
      hasClaudeKey: !!getClaudeKey(),
      hasObsidianToken: !!getObsidianConfig().token,
      hasOfflineBank: hasOfflineBank(b.id),
    });
    openDoorPanel(info, { onChoose: (tutorId) => this.startEncounter(sub, tutorId, info) });
  }

  startEncounter(subsection, personaId, info) {
    if (this.encounterOpen) return;
    this.saveStore.update((s) => ({ ...s, tutorPreference: { ...s.tutorPreference, [subsection.id]: personaId } }));
    const where = locateSubsection(curriculum, subsection.id);
    const sub = { ...subsection, module: where?.module?.title ?? subsection.module };
    const bank = hasOfflineBank(sub.id);
    const makeOfflineTutor = () => createOfflineTutor({ personaId });
    const useClaude = info.mode === 'claude';
    const tutor = useClaude ? createClaudeTutor({ personaId }) : makeOfflineTutor();
    const hasObsidian = !!getObsidianConfig().token;
    this.encounterOpen = true;
    let recorded = false;
    openEncounter({
      subsection: sub,
      tutor,
      makeOfflineTutor: bank ? makeOfflineTutor : undefined,
      priorGaps: openGaps(this.saveStore.state.progress, { subsectionId: sub.id }),
      // Memory: earlier TUTOR-SESSION notes for this subsection (needs Obsidian; without it there is no memory).
      loadMemory: hasObsidian ? () => loadPriorSessions(sub) : undefined,
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
    this.refreshStates();
    const gaps = res.gaps.length;
    const base = `${sub.title}: ${res.outcome.toUpperCase()}${gaps ? ` (${gaps} gap${gaps > 1 ? 's' : ''} logged)` : ''}`;
    this.showBanner(base);
    this.writeSession(sub, res, base);
  }

  /** Write the TUTOR-SESSION note (guarded) once per encounter. Never blocks or breaks the game. */
  async writeSession(sub, res, base) {
    if (!getObsidianConfig().token) {
      this.showBanner(`${base}. Obsidian is not connected, so no session note was written.`);
      return;
    }
    const r = await writeSessionNote({ subsection: sub, result: res });
    if (r.ok) this.showBanner(`${base}. Session note saved: ${r.filename}`, 9000);
    else if (!r.skipped) this.showBanner(`${base}. Could not write the session note (${r.error}).`, 9000);
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
      ['Save now', () => { this.saveStore.save(); this.showBanner('Saved.', 2500); close(); }],
      ['Export save (download JSON)', () => downloadSave(this.saveStore)],
      ['Import save (JSON file)', async () => {
        const r = await pickAndImportSave(this.saveStore);
        if (r.ok) window.location.reload();
        else if (!r.cancelled) this.showBanner(r.message);
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
    } else {
      kb.enabled = true;
      kb.addCapture(this.captureCodes);
      kb.resetKeys();
    }
  }

  update(_time, delta) {
    this.renderer.update(this.cameras.main);
    if (this.encounterOpen || isAnyOverlayOpen()) {
      this.prompt.setVisible(false);
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.openMenu();
      return;
    }

    const { up, down, left, right } = this.wasd;
    const c = this.cursors;
    let vx = 0;
    let vy = 0;
    if (left.isDown || c.left.isDown) vx = -1;
    else if (right.isDown || c.right.isDown) vx = 1;
    if (up.isDown || c.up.isDown) vy = -1;
    else if (down.isDown || c.down.isDown) vy = 1;
    if (vx && vy) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    if (vx || vy) {
      this.facing = Math.abs(vy) >= Math.abs(vx) ? (vy < 0 ? 'up' : 'down') : vx < 0 ? 'left' : 'right';
      // small sub-steps so a slow frame can never skip over a wall
      const dist = (PLAYER_SPEED * Math.min(delta, 50)) / 1000;
      const steps = Math.ceil(dist / 4);
      for (let i = 0; i < steps; i++) {
        const p = moveWithCollision(this.world, this.player.x, this.player.y, (vx * dist) / steps, (vy * dist) / steps);
        this.player.setPosition(p.x, p.y);
      }
    }
    this.player.setDepth(this.player.y);
    this.updateRegion();

    const door = doorNear(this.world, this.player.x, this.player.y, this.facing);
    if (door) {
      const state = this.states[door.id] ?? 'locked';
      const label = state === 'locked' ? '🔒 Locked: press E to see what unlocks it' : `Press E to study (${STATE_LABEL[state]})`;
      this.prompt.setText(`${door.title}\n${label}`).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.interactWithDoor(door);
    } else {
      this.prompt.setVisible(false);
    }
  }
}
