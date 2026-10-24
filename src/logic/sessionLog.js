// Session log: a short, capped record of finished/abandoned encounters, kept in the save so the journal
// can show "last 10 sessions" without needing Obsidian. Pure JS.
//   { subsectionId, title, module, date, tutor, outcome: 'consolidated'|'explored', finished, exchanges, gaps: number, gapConcepts: string[] }
// Opening and leaving without answering anything is not a session (the caller only logs real encounters).

export const MAX_SESSIONS_KEPT = 50;
export const JOURNAL_SESSIONS = 10;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

function cleanSession(s) {
  if (!isObj(s) || typeof s.subsectionId !== 'string' || !s.subsectionId) return null;
  const date = typeof s.date === 'string' && !Number.isNaN(Date.parse(s.date)) ? s.date : null;
  if (!date) return null;
  return {
    subsectionId: s.subsectionId,
    title: text(s.title) || s.subsectionId,
    module: text(s.module),
    date,
    tutor: text(s.tutor, 80),
    outcome: s.outcome === 'consolidated' ? 'consolidated' : 'explored',
    finished: !!s.finished,
    exchanges: Math.max(0, Math.floor(Number.isFinite(+s.exchanges) ? +s.exchanges : 0)),
    gaps: Math.max(0, Math.floor(Number.isFinite(+s.gaps) ? +s.gaps : 0)),
    seeds: Math.max(0, Math.floor(Number.isFinite(+s.seeds) ? +s.seeds : 0)),
    gapConcepts: Array.isArray(s.gapConcepts) ? s.gapConcepts.filter((c) => typeof c === 'string' && c).slice(0, 6).map((c) => c.slice(0, 120)) : [],
  };
}

/** Coerce anything into a valid, capped, oldest-first session list. Never throws. */
export function normaliseSessions(list) {
  if (!Array.isArray(list)) return [];
  return list.map(cleanSession).filter(Boolean).slice(-MAX_SESSIONS_KEPT);
}

/** Append one encounter to the log. `outcome` is the *recomputed* outcome (never the engine's claim). */
export function recordSession(sessions, result, { subsection, outcome, now, seeds = 0 } = {}) {
  const id = result?.subsectionId;
  if (!id) return sessions;
  const date = (now === undefined ? new Date() : new Date(now)).toISOString();
  const gapConcepts = [...new Set((result.gaps ?? []).map((g) => g.concept).filter(Boolean))];
  const entry = cleanSession({
    subsectionId: id,
    title: subsection?.title ?? id,
    module: subsection?.module ?? '',
    date,
    tutor: result.tutor ?? '',
    outcome,
    finished: !!result.finished,
    exchanges: result.exchanges ?? 0,
    gaps: gapConcepts.length,
    seeds,
    gapConcepts,
  });
  return entry ? normaliseSessions([...sessions, entry]) : sessions;
}

/** Newest first, at most `n`. */
export function recentSessions(sessions, n = JOURNAL_SESSIONS) {
  return normaliseSessions(sessions)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => Date.parse(b.s.date) - Date.parse(a.s.date) || b.i - a.i)
    .slice(0, n)
    .map((x) => x.s);
}
