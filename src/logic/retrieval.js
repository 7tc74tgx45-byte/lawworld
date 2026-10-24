// Garden retrieval questions (T13): one short typed question per watering, plus a local keyword evaluator used
// only when no Claude tutor is available (clearly labelled offline in the UI). Pure JS.

import { MIN_ANSWER_CHARS } from './encounterRules.js';

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'is', 'on', 'for', 'by', 'with', 'as', 'at', 'it', 'be', 'that', 'this', 'are']);
const sigWords = (s) => [...new Set(String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
const stem = (w) => w.replace(/(ing|ed|es|s)$/, '');

/** The question the plant asks. It names the concept and the building it came from; it never gives the answer. */
export function retrievalQuestion(plot, subsection) {
  const where = subsection?.title ? ` (from "${subsection.title}")` : '';
  return `Your plant is thirsty. Without looking at your notes, explain "${plot.concept}"${where}: what is the rule or idea, and name any case or statute that goes with it.`;
}

/** A Socratic nudge for the garden: points at where to look, never states the rule. Two levels. */
export function retrievalHint(plot, subsection, index = 0) {
  const where = subsection?.title ?? 'the building';
  if (index === 0) return `Think about "${where}". What problem is "${plot.concept}" there to solve, and who is arguing against whom?`;
  const cases = subsection?.keyCases ?? [];
  const aside = cases.length ? ` Can you recall which of these cases belongs with it: ${cases.slice(0, 3).join('; ')}?` : '';
  return `Break it into parts: what must be shown, and what is the effect if it is?${aside}`;
}

/** First-name part of a case citation, e.g. "Carlill v Carbolic Smoke Ball Co [1893]" -> "carlill". */
const caseStem = (c) => String(c).split(/ v | \[| \(/)[0].trim().toLowerCase();

/**
 * Offline evaluation, crude by design (the UI labels it). Repeating the concept's own words is not enough:
 * "solid" also needs a real explanation (enough distinct words) AND either a key case from the building or
 * vocabulary from the building's other key concepts. Returns an evaluation-shaped object.
 */
export function evaluateRetrievalOffline(answer, plot, subsection) {
  const text = String(answer ?? '').trim();
  if (text.length < MIN_ANSWER_CHARS) return { rejected: true, feedback: `Write a sentence or two (at least ${MIN_ANSWER_CHARS} characters). That was not counted.` };
  const have = new Set(sigWords(text).map(stem));
  const conceptWords = sigWords(plot.concept).map(stem);
  const hit = conceptWords.filter((w) => have.has(w));
  const lower = text.toLowerCase();
  const caseHit = (subsection?.keyCases ?? []).some((c) => {
    const first = caseStem(c);
    return first.length > 3 && lower.includes(first);
  });
  const statuteHit = (subsection?.statutes ?? []).some((s) => {
    const m = /(?:s\.?|section)\s*(\d+[a-z]?)/i.exec(String(s));
    return m ? new RegExp(`\\b(?:s\\.?|section)\\s*${m[1]}\\b`, 'i').test(text) : false;
  });
  const own = new Set(conceptWords);
  const related = new Set((subsection?.keyConcepts ?? []).flatMap((c) => sigWords(c).map(stem)).filter((w) => !own.has(w)));
  const relatedHits = [...related].filter((w) => have.has(w)).length;
  const share = conceptWords.length ? hit.length / conceptWords.length : 0;
  const explained = [...have].filter((w) => !own.has(w)).length >= 8;
  const grounded = caseHit || statuteHit || relatedHits >= 1 || related.size === 0;
  let verdict = 'missing';
  if (explained && grounded && (share >= 0.6 || (share >= 0.4 && (caseHit || statuteHit)))) verdict = 'solid';
  else if (share >= 0.3 || caseHit || statuteHit) verdict = 'partial';
  const where = subsection?.title ?? 'the building';
  const feedback = verdict === 'solid'
    ? `That covers "${plot.concept}". (Offline check: I can only match key words, so re-read your note to be sure of the precision.)`
    : verdict === 'partial'
      ? `Part of "${plot.concept}" is there, but it is thin. Re-read that part of your note: ${where}. The plant stays alive but does not grow.`
      : `I could not find the key idea of "${plot.concept}" in that. Revisit ${where} and try again; the gap stays on your list.`;
  return { verdict, feedback, conceptsHit: verdict === 'solid' ? [plot.concept] : [], conceptsMissed: verdict === 'solid' ? [] : [plot.concept] };
}
