// Session write-back and memory (T08). Browser-side glue around the pure helpers in src/logic/sessionNote.js.
// Dependencies are injectable so it can be tested without a network.
//
//   writeSessionNote({ subsection, result, ... })  -> { ok, filename?, skipped?, error? }   never throws
//   loadSessionMemory(subsection, { ... })          -> string[]  (compact Gaps / Next time lines, newest first)
//
// The only file this ever writes is TUTOR-SESSION-*.md, and the check runs here as well as inside obsidian.js.

import { readNote as obsidianRead, listFiles as obsidianList, writeNote as obsidianWrite } from './obsidian.js';
import { assertWritable } from '../logic/noteGuard.js';
import { sessionFilesFor } from '../logic/notes.js';
import { sessionFilename, formatSessionNote, hasSessionContent, parseSessionNote, formatSessionMemory } from '../logic/sessionNote.js';
import { locateSubsection } from '../logic/curriculum.js';
import { curriculum as defaultCurriculum } from '../data/curriculum.js';

/**
 * Write the note for a finished (or abandoned) encounter. Opening and leaving without answering writes nothing.
 * Failure to write (Obsidian closed, no token) is reported, never thrown: the save in localStorage is unaffected.
 */
export async function writeSessionNote({ subsection, result, date = new Date(), curriculum = defaultCurriculum, writeNote = obsidianWrite }) {
  try {
    if (!hasSessionContent(result)) return { ok: false, skipped: true, reason: 'nothing answered' };
    const where = locateSubsection(curriculum, subsection.id);
    const filename = sessionFilename(date, subsection.id);
    assertWritable(filename);
    const text = formatSessionNote({
      date,
      subsection,
      module: where?.module?.title ?? subsection.module,
      district: where?.district?.title ?? '',
      tutor: result.tutor,
      result,
    });
    await writeNote(filename, text);
    return { ok: true, filename };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Earlier sessions for this subsection: list the vault, keep the newest `limit` matching files, and return
 * them parsed ({ date, outcome, gaps[], nextTime[] }). Any failure just means "no memory" (the game still runs).
 */
export async function loadPriorSessions(subsection, { listFiles = obsidianList, readNote = obsidianRead, limit = 2 } = {}) {
  const out = [];
  try {
    const files = sessionFilesFor(await listFiles(), subsection.id).slice(0, limit);
    for (const f of files) {
      try {
        const s = parseSessionNote(await readNote(f), f);
        if (s.gaps.length || s.nextTime.length) out.push(s);
      } catch { /* one unreadable note is not fatal */ }
    }
  } catch { /* listing failed: carry on without memory */ }
  return out;
}

/** Same, as compact one-line strings (what goes into a prompt). */
export async function loadSessionMemory(subsection, opts) {
  return (await loadPriorSessions(subsection, opts)).map((s) => formatSessionMemory(s)).filter(Boolean);
}
