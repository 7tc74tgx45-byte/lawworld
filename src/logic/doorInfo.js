// What happens when the player presses E at a door? Pure JS.
//   describeDoor(curriculum, progress, subsectionId, { tutorPreference, hasClaudeKey, hasObsidianToken, hasOfflineBank })
// -> { kind: 'locked', title, unmet: [{ id, title }], text }
//  | { kind: 'study', state, title, defaultTutor, mode, modeReason, canPlay, note }
// A locked door lists the prerequisites still to be *consolidated* (explored does not unlock, see progress.js).

import { subsectionIndex, locateSubsection } from './curriculum.js';
import { subsectionState, unmetPrerequisites } from './progress.js';
import { chooseMode } from './tutorMode.js';

export function describeDoor(curriculum, progress, id, env = {}) {
  const index = subsectionIndex(curriculum);
  const sub = index.get(id);
  if (!sub) return { kind: 'locked', title: id, unmet: [], text: 'Unknown building.' };
  const state = subsectionState(index, progress, id);
  if (state === 'locked') {
    const unmet = unmetPrerequisites(index, progress, id).map((p) => ({ id: p, title: index.get(p)?.title ?? p }));
    return {
      kind: 'locked',
      title: sub.title,
      state,
      unmet,
      text: `Locked. Consolidate ${unmet.map((u) => u.title).join(', ')} to open this door.`,
    };
  }
  const { mode, reason } = chooseMode({
    hasClaudeKey: !!env.hasClaudeKey,
    hasObsidianToken: !!env.hasObsidianToken,
    forceOffline: false,
    hasOfflineBank: !!env.hasOfflineBank,
  });
  const canPlay = mode === 'claude' || !!env.hasOfflineBank;
  const where = locateSubsection(curriculum, id);
  return {
    kind: 'study',
    state,
    title: sub.title,
    module: where?.module?.title ?? '',
    district: where?.district?.title ?? '',
    defaultTutor: env.tutorPreference?.[id] ?? sub.suggestedTutor ?? 'chen',
    mode,
    modeReason: reason,
    canPlay,
    note: canPlay
      ? reason
      : 'This building has no offline question bank yet. Add a Claude API key and an Obsidian token (Esc, Settings) so the tutor can read your note, then come back.',
  };
}
