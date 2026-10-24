// Client NPCs in the world (T12): one wandering client per region while the player has something explored to be
// asked about. All rules (who is eligible, cooldowns, rewards) live in src/logic/clients.js; the wander step is in
// src/logic/clientWander.js. This file only owns the sprites.

import { curriculum as defaultCurriculum } from '../data/curriculum.js';
import { locateSubsection } from '../logic/curriculum.js';
import { clientPresence, pickClientCase, clientName, slotIdFor } from '../logic/clients.js';
import { clientSpawn, createWanderer, stepWanderer, TALK_DISTANCE } from '../logic/clientWander.js';
import { moveWithCollision, TILE_SIZE } from '../logic/worldQuery.js';
import { clientVariantFor } from './clientDraw.js';

const frameKey = (variant, w) => `client-${variant}-${w.walking ? Math.floor(w.step / 10) % 2 : 2}`;

export default class ClientNpcs {
  /** canServe(subsection) -> bool: can a problem be built right now (offline bank, or Claude + note)? */
  constructor(scene, world, { curriculum = defaultCurriculum, canServe = () => true, rng = Math.random } = {}) {
    this.scene = scene;
    this.world = world;
    this.curriculum = curriculum;
    this.canServe = canServe;
    this.rng = rng;
    this.npcs = new Map(); // regionId -> { regionId, slotId, name, subsection, wander, sprite, label, variant }
  }

  /** Reconcile with the save: spawn clients that should be here, remove those that left or became ineligible. */
  refresh(save, now = Date.now()) {
    for (const region of this.world.regions) {
      const existing = this.npcs.get(region.id);
      const { present, candidates } = clientPresence(this.curriculum, save.progress, save.clients, region.id, { canServe: this.canServe, now });
      if (!present) {
        if (existing) this.remove(region.id);
        continue;
      }
      if (existing && candidates.some((c) => c.subsection.id === existing.subsection.id)) continue; // keep this visit's client
      if (existing) this.remove(region.id);
      this.spawn(region, pickClientCase(candidates, this.rng), save);
    }
  }

  spawn(region, picked, save) {
    if (!picked) return;
    const where = locateSubsection(this.curriculum, picked.subsection.id);
    const at = clientSpawn(this.world, region.id, where?.district?.id, this.rng);
    if (!at) return;
    const variant = clientVariantFor(region.index);
    const name = clientName(region.id, save.clients?.served ?? 0);
    const sprite = this.scene.add.image(at.x, at.y, `client-${variant}-2`).setOrigin(0.5, 0.9);
    const label = this.scene.add
      .text(at.x, at.y - 30, name, { fontSize: '11px', fill: '#ffffff', backgroundColor: '#000000aa', padding: { x: 3, y: 1 } })
      .setOrigin(0.5, 1);
    const wander = createWanderer(at.x, at.y);
    wander.step = 0;
    this.npcs.set(region.id, { regionId: region.id, slotId: slotIdFor(region.id), name, subsection: picked.subsection, hasGap: picked.gaps > 0, wander, sprite, label, variant });
  }

  remove(regionId) {
    const n = this.npcs.get(regionId);
    if (!n) return;
    n.sprite.destroy();
    n.label.destroy();
    this.npcs.delete(regionId);
  }

  /** Move every client a little. Clients stand still while the player is close, or while an overlay is open. */
  update(dt, player, { frozen = false } = {}) {
    for (const n of this.npcs.values()) {
      const d = Math.hypot(n.wander.x - player.x, n.wander.y - player.y);
      const before = { x: n.wander.x, y: n.wander.y };
      stepWanderer(n.wander, dt, {
        rng: this.rng,
        hold: frozen || d < TILE_SIZE * 2,
        move: (x, y, dx, dy) => moveWithCollision(this.world, x, y, dx, dy),
      });
      n.wander.step += Math.hypot(n.wander.x - before.x, n.wander.y - before.y);
      n.sprite.setTexture(frameKey(n.variant, n.wander)).setPosition(n.wander.x, n.wander.y).setDepth(n.wander.y);
      n.label.setPosition(n.wander.x, n.wander.y - 30).setDepth(n.wander.y + 1);
    }
  }

  /** The client within talking distance of (x, y), nearest first, with its distance; null if none. */
  nearest(x, y) {
    let best = null;
    for (const n of this.npcs.values()) {
      const d = Math.hypot(n.wander.x - x, n.wander.y - y);
      if (d <= TALK_DISTANCE && (!best || d < best.distance)) best = { npc: n, distance: d };
    }
    return best;
  }
}
