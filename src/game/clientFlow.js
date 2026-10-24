// Glue between the world (ClientNpcs sprites), the client overlay and the save (T12). Kept out of GameScene to keep
// that file small. All rules are in src/logic/clients.js; this only wires them to the game.

import { openClientEncounter } from '../ui/clientEncounter.js';
import { createOfflineTutor } from '../api/offlineTutor.js';
import { createClaudeTutor } from '../api/tutor.js';
import { hasOfflineBank } from '../data/offlineBank.js';
import { getClaudeKey } from '../api/claude.js';
import { getObsidianConfig } from '../api/obsidian.js';
import { curriculum } from '../data/curriculum.js';
import { locateSubsection } from '../logic/curriculum.js';
import { openGaps } from '../logic/progress.js';
import { chooseMode } from '../logic/tutorMode.js';
import { applyClientResult, clientVerdict, clientReaction, describeReward, clientTutorFor } from '../logic/clients.js';

/** Can a client problem be built for this subsection right now? Offline bank, or Claude + a live note. */
export function canServeClient(sub) {
  return hasOfflineBank(sub.id) || (!!getClaudeKey() && !!getObsidianConfig().token);
}

/**
 * Open the overlay for one client NPC (an entry of ClientNpcs.npcs). scene needs: saveStore, world, showBanner,
 * clientNpcs, encounterOpen (flag the scene reads), and refreshClients().
 */
export function startClientCase(scene, npc) {
  if (scene.encounterOpen) return;
  const state = scene.saveStore.state;
  const where = locateSubsection(curriculum, npc.subsection.id);
  const sub = { ...npc.subsection, module: where?.module?.title ?? npc.subsection.module };
  const region = scene.world.regions.find((r) => r.id === npc.regionId);
  const personaId = state.tutorPreference?.[sub.id] ?? clientTutorFor(npc.regionId);
  const bank = hasOfflineBank(sub.id);
  const { mode } = chooseMode({ hasClaudeKey: !!getClaudeKey(), hasObsidianToken: !!getObsidianConfig().token, forceOffline: false, hasOfflineBank: bank });
  const makeOffline = () => createOfflineTutor({ personaId });
  const tutor = mode === 'claude' ? createClaudeTutor({ personaId }) : makeOffline();

  scene.encounterOpen = true;
  let recorded = false;

  // Fold the result into the save exactly once. Returns what the overlay shows (reaction + reward line).
  const record = (res) => {
    if (recorded) return null;
    const verdict = clientVerdict(res);
    if (!verdict) return null; // nothing answered: nothing earned, and the client stays
    recorded = true;
    const { save, reward } = applyClientResult(scene.saveStore.state, res, { regionId: npc.regionId, slotId: npc.slotId, subsection: sub });
    scene.saveStore.update(() => save);
    scene.saveStore.save();
    scene.refreshClients();
    scene.showBanner(`${npc.name}: ${describeReward(reward)}`, 8000);
    return { reaction: clientReaction(npc.name, verdict), summary: describeReward(reward) };
  };

  openClientEncounter({
    subsection: sub,
    tutor,
    clientName: npc.name,
    regionTitle: region?.title ?? '',
    priorGaps: openGaps(state.progress, { subsectionId: sub.id }),
    makeOfflineTutor: bank ? makeOffline : undefined,
    onFinish: (res) => record(res),
    onClose: (res) => {
      scene.encounterOpen = false;
      record(res); // leaving early keeps what the evaluations so far earned
    },
  });
}
