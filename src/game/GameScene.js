import Phaser from 'phaser';
import { openEncounter } from '../ui/encounter.js';
import { openOverlay, setOverlayHandlers, isAnyOverlayOpen } from '../ui/dom.js';
import { openSettings } from '../ui/settings.js';
import { openDoorPanel } from '../ui/doorPanel.js';
import { openJournal } from '../ui/journal.js';
import { downloadSave, pickAndImportSave, getSaveStore } from '../ui/saveAdapter.js';
import { createOfflineTutor } from '../api/offlineTutor.js';
import { createClaudeTutor } from '../api/tutor.js';
import { writeSessionNote, loadPriorSessions } from '../api/sessionNotes.js';
import { hasOfflineBank } from '../data/offlineBank.js';
import { getClaudeKey } from '../api/claude.js';
import { getObsidianConfig } from '../api/obsidian.js';
import { curriculum } from '../data/curriculum.js';
import { allDistricts, findSubsection, locateSubsection } from '../logic/curriculum.js';
import { computeStates, openGaps } from '../logic/progress.js';
import { syncBraziers } from '../logic/garden.js';
import { openGarden } from '../ui/garden.js';
import Garden from './Garden.js';
import { describeDoor } from '../logic/doorInfo.js';
import { buildWorld } from '../logic/layout.js';
import { TILE_SIZE, blockedAt, boxBlocked, regionAt, zoneAt, moveWithCollision, doorNear, tileCentre } from '../logic/worldQuery.js';
import { playerTextureKey, facingFromVector } from '../logic/anim.js';
import { createCat, updateCat, catFrame, pickBesideSpot } from '../logic/cat.js';
import { STATE_LABEL } from './palette.js';
import WorldRenderer from './WorldRenderer.js';
import Weather from './Weather.js';
import ClientNpcs from './ClientNpcs.js';
import { startClientCase, canServeClient } from './clientFlow.js';
import { music } from '../audio/music.js';
import { getSetting } from '../settings.js';

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

    this.facing = savedOk ? saved.facing : 'down';
    this.walkDist = 0;
    this.moving = false;
    this.player = this.add.image(start.x, start.y, playerTextureKey(this.facing, false, 0)).setOrigin(0.5, 0.9);

    // Cat companion: restored from the save when it is close to the player and not inside a wall, else beside the player.
    const savedCat = this.saveStore.state.cat;
    const catOk = savedOk && Number.isFinite(savedCat?.x) && Math.hypot(savedCat.x - start.x, savedCat.y - start.y) < 160 && !boxBlocked(world, savedCat.x, savedCat.y, 4);
    const catStart = catOk ? savedCat : pickBesideSpot(start, (x, y) => boxBlocked(world, x, y, 4));
    this.cat = createCat(catStart.x, catStart.y);
    this.catSprite = this.add.image(this.cat.x, this.cat.y, 'cat-sit-0').setOrigin(0.5, 0.9);
    this.weather = new Weather(this, this.scale.width, this.scale.height);

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
    this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.captureCodes = [
      Phaser.Input.Keyboard.KeyCodes.W, Phaser.Input.Keyboard.KeyCodes.A, Phaser.Input.Keyboard.KeyCodes.S, Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE, Phaser.Input.Keyboard.KeyCodes.E, Phaser.Input.Keyboard.KeyCodes.TAB,
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
      .text(8, 8, 'WASD / Arrows to move · E at a door, client or garden plot · Tab journal · Esc menu', { fontSize: '12px', fill: '#ffffff', backgroundColor: '#00000066', padding: { x: 4, y: 2 } })
      .setScrollFactor(0).setDepth(100000);

    this.garden = new Garden(this, world);
    this.garden.refresh(this.saveStore.state);
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this.garden.refresh(this.saveStore.state) }); // plants wither with time
    this.refreshStates();
    // Client NPCs (T12): one per region while something there is explored. A served client leaves for 5 minutes.
    this.clientNpcs = new ClientNpcs(this, world, { canServe: canServeClient });
    this.refreshClients();
    this.time.addEvent({ delay: 15000, loop: true, callback: () => this.refreshClients() }); // cooldowns end, settings change
    this.currentRegionId = null;
    music.setVolume(getSetting('musicVolume'));
    music.mute(getSetting('musicMuted'));
    this.events.once('shutdown', () => music.stop());
    this.updateRegion(true);
    if (!this.currentRegionId) music.playRegion('hub'); // started on a path between regions
    this.updateWeather(true);
    this.renderer.update(this.cameras.main);
  }

  /** Weather follows the season of the nearest region, so it switches as the player crosses the border (mid-bridge). */
  updateWeather(instant = false) {
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    const region = this.world.regions[zoneAt(this.world, tx, ty)];
    if (region) this.weather.setSeason(region.season, instant);
  }

  /** Cat and player sprite frames. The cat sits beside the player while an encounter is open. */
  animateCharacters(delta, moving) {
    this.moving = moving;
    this.player.setTexture(playerTextureKey(this.facing, moving, this.walkDist));
    const dt = delta / 1000;
    updateCat(this.cat, dt, this.player, { encounter: this.encounterOpen, blocked: (x, y) => boxBlocked(this.world, x, y, 4) });
    const f = catFrame(this.cat);
    this.catSprite.setTexture(f.key).setFlipX(f.flipX).setPosition(this.cat.x, this.cat.y).setDepth(this.cat.y);
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
    // Braziers stay lit once earned (saved), even if the vault later adds a building to the district.
    const synced = syncBraziers(this.saveStore.state, this.districtList, this.states);
    if (synced.newlyLit.length) {
      this.saveStore.update(() => synced.save);
      this.saveStore.save();
      const names = synced.newlyLit.map((id) => this.districtList.find((d) => d.id === id)?.title ?? id);
      if (this.garden) this.showBanner(`The brazier is lit: ${names.join(', ')} fully consolidated.`, 8000);
    }
    this.renderer.applyStates(this.states, synced.lit);
  }

  /** Apply a garden change (plant / water) to the save, write it at once, and redraw the plots. */
  updateGarden(fn) {
    const r = fn(this.saveStore.state);
    if (r?.ok) {
      this.saveStore.update(() => r.save);
      this.saveStore.save();
      this.garden.refresh(this.saveStore.state);
      this.refreshStates();
      this.refreshClients();
    }
    return r;
  }

  /** E at a garden plot: plant a seed, or water the plant by answering a retrieval question. */
  openGardenPlot(plotId) {
    const state = this.saveStore.state;
    openGarden({
      plotId,
      curriculum,
      getSave: () => this.saveStore.state,
      update: (fn) => this.updateGarden(fn),
      onDone: (msg) => this.showBanner(msg, 7000),
      makeTutor: () => {
        const plot = state.garden.plots.find((p) => p.id === plotId);
        const hasClaude = !!getClaudeKey() && !!getObsidianConfig().token;
        if (!plot || !hasClaude) return null;
        return createClaudeTutor({ personaId: state.tutorPreference?.[plot.subsectionId] ?? 'chen' });
      },
    });
  }

  /** Reconcile client sprites with the save (new explored subsections, cooldowns). */
  refreshClients() {
    this.clientNpcs?.refresh(this.saveStore.state);
  }

  /** The text over a garden plot. */
  plotPrompt(v) {
    const seeds = this.saveStore.state.inventory.seeds;
    if (!v || v.empty) return `Knowledge garden: empty plot\nPress E to plant a seed (${seeds} in your bag)`;
    if (v.status === 'withered') return `${v.concept}: withered\nPress E to answer a question and revive it`;
    if (v.damp) return `${v.concept}: ${v.stageName} (watered recently)\nPress E to check on it`;
    return `${v.concept}: ${v.stageName}\nPress E to water it (answer a question)`;
  }

  /** Region name banner when the player crosses into a region. */
  updateRegion(silent = false) {
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    const region = regionAt(this.world, tx, ty);
    if (!region || region.id === this.currentRegionId) return;
    this.currentRegionId = region.id;
    music.playRegion(region.id); // crossfades 2 s; the paths between regions keep the last theme
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
    const cat = { x: Math.round(this.cat.x), y: Math.round(this.cat.y) };
    this.saveStore.update((s) => ({ ...s, player: { ...s.player, x, y, region, facing: this.facing }, cat }));
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
    music.playEncounter();
    let recorded = false;
    // A closed tab must keep evaluated progress like the Leave button does (VISION §1.2).
    let handle = null;
    const onPageHide = () => { if (this.encounterOpen) handle?.close(); };
    window.addEventListener('pagehide', onPageHide);
    handle = openEncounter({
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
        music.endEncounter();
        window.removeEventListener('pagehide', onPageHide);
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
    this.refreshClients();
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

  /** Tab: the journal (stats, map, things to revisit, recent sessions). Read-only: it never changes progress. */
  openJournalScreen() {
    if (isAnyOverlayOpen()) return;
    openJournal({ curriculum, save: this.saveStore.state });
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

  update(time, delta) {
    this.renderer.update(this.cameras.main, time);
    this.weather.update(delta);
    const overlayUp = this.encounterOpen || isAnyOverlayOpen();
    this.clientNpcs.update(delta / 1000, this.player, { frozen: overlayUp });
    if (overlayUp) {
      this.prompt.setVisible(false);
      this.animateCharacters(delta, false);
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
      this.openJournalScreen();
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
      this.facing = facingFromVector(vx, vy, this.facing);
      const before = { x: this.player.x, y: this.player.y };
      // small sub-steps so a slow frame can never skip over a wall
      const dist = (PLAYER_SPEED * Math.min(delta, 50)) / 1000;
      const steps = Math.ceil(dist / 4);
      for (let i = 0; i < steps; i++) {
        const p = moveWithCollision(this.world, this.player.x, this.player.y, (vx * dist) / steps, (vy * dist) / steps);
        this.player.setPosition(p.x, p.y);
      }
      this.walkDist += Math.hypot(this.player.x - before.x, this.player.y - before.y); // only real movement counts
    }
    // walking = actually moved this frame (pushing into a wall stands still)
    const walking = this.walkDist !== this.lastWalkDist;
    this.lastWalkDist = this.walkDist;
    this.animateCharacters(delta, walking);
    this.player.setDepth(this.player.y);
    this.updateRegion();
    this.updateWeather();

    // A client close by takes priority over a door: E starts their case.
    const near = this.clientNpcs.nearest(this.player.x, this.player.y);
    if (near) {
      const n = near.npc;
      this.prompt.setText(`${n.name} has a problem${n.hasGap ? ' (something you missed before)' : ''}\nPress E to hear it · ${n.subsection.title}`).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) startClientCase(this, n);
      return;
    }
    const door = doorNear(this.world, this.player.x, this.player.y, this.facing);
    const plot = !door && this.garden.nearest(this.player.x, this.player.y);
    if (plot) {
      this.prompt.setText(`${this.plotPrompt(plot.view)}`).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.openGardenPlot(plot.plotId);
      return;
    }
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
