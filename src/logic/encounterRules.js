// Constants and pure rules for the encounter engine (VISION §1). No DOM, no Phaser.
// src/logic/encounter.js re-exports everything here, so existing imports keep working.

export const STAGES = [
  { n: 1, key: 'intro', label: 'Intro' },
  { n: 2, key: 'plain', label: 'Plain English' },
  { n: 3, key: 'precision', label: 'Precision' },
  { n: 4, key: 'authority', label: 'Authority' },
  { n: 5, key: 'application', label: 'Application' },
  { n: 6, key: 'checkpoint', label: 'Checkpoint' },
  { n: 7, key: 'verdict', label: 'Verdict' },
];

export const MIN_EXCHANGES = 8;
export const MIN_ANSWER_CHARS = 15;
export const MIN_QUESTION_CHARS = 5; // a short real question ("what is a bailment?") is fine; only answers need 15
export const MAX_FOLLOWUPS = 2;
export const MAX_HINTS = 2;
export const MAX_EXTRA_HINTS = 2; // bought with materials (T21), per stage / per checkpoint question; still nudges, never the answer
export const CHECKPOINT_QUESTIONS = 3;

export const REFLECTIONS = [
  'Before I give the verdict: in a sentence or two, which part of this topic do you feel least sure about, and why?',
  'One more thing for the record: pick one case from this session and tell me, in your own words, what it decided.',
  'Last check: what is the single idea from this session you would most want to remember in an exam or with a client?',
];

export const RANK = { missing: 0, partial: 1, solid: 2 };

/** Consolidation rule, exactly VISION §1. */
export function computeOutcome({ stages, checkpoint }) {
  for (const n of [2, 3, 4, 5]) {
    const s = stages[n];
    if (!s || !s.answered || !s.verdict) return 'explored';
    if (RANK[s.verdict] < RANK.partial) return 'explored';
  }
  if (stages[3].verdict !== 'solid' || stages[5].verdict !== 'solid') return 'explored';
  if (checkpoint.correct < 2) return 'explored';
  return 'consolidated';
}

/** Make a tutor's evaluation safe for the engine: unknown verdicts count as partial, lists are arrays. */
export function normaliseEvaluation(ev) {
  const e = ev && typeof ev === 'object' ? { ...ev } : {};
  if (!(e.verdict in RANK)) e.verdict = 'partial';
  e.feedback = typeof e.feedback === 'string' ? e.feedback : '';
  e.conceptsHit = Array.isArray(e.conceptsHit) ? e.conceptsHit.filter(Boolean) : [];
  e.conceptsMissed = Array.isArray(e.conceptsMissed) ? e.conceptsMissed.filter(Boolean) : [];
  if (e.iracScore != null) e.iracScore = Number.isFinite(+e.iracScore) ? +e.iracScore : undefined;
  return e;
}

const words = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9£ ]+/g, ' ').split(/\s+/).filter(Boolean);

/** True if `text` repeats a run of `run` consecutive words from the secret answer. */
export function leaksAnswer(text, secret, run = 8) {
  const w = words(secret);
  if (w.length < run) return false;
  const hay = ' ' + words(text).join(' ') + ' ';
  for (let i = 0; i + run <= w.length; i++) {
    if (hay.includes(' ' + w.slice(i, i + run).join(' ') + ' ')) return true;
  }
  return false;
}
