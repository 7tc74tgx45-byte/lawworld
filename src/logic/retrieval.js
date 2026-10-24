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

/**
 * Offline evaluation: share of the concept's significant words (stemmed) that the answer uses, plus any key case
 * named. Crude by design; the UI labels it. Returns an evaluation-shaped object.
 */
export function evaluateRetrievalOffline(answer, plot, subsection) {
  const text = String(answer ?? '').trim();
  if (text.length < MIN_ANSWER_CHARS) return { rejected: true, feedback: `Write a sentence or two (at least ${MIN_ANSWER_CHARS} characters). That was not counted.` };
  const have = new Set(sigWords(text).map(stem));
  const want = sigWords(plot.concept).map(stem);
  const hit = want.filter((w) => have.has(w));
  const caseHit = (subsection?.keyCases ?? []).some((c) => {
    const first = String(c).split(/ v | \[| \(/)[0].trim().toLowerCase();
    return first.length > 3 && text.toLowerCase().includes(first);
  });
  const share = want.length ? hit.length / want.length : 0;
  const long = sigWords(text).length >= 12;
  let verdict = 'missing';
  if (long && (share >= 0.6 || (share >= 0.4 && caseHit))) verdict = 'solid';
  else if (share >= 0.3 || caseHit) verdict = 'partial';
  const feedback = verdict === 'solid'
    ? `That covers "${plot.concept}". (Offline check: I can only match key words, so re-read your note to be sure of the precision.)`
    : verdict === 'partial'
      ? `Part of "${plot.concept}" is there, but it is thin. Re-read that part of your note: ${subsection?.title ?? 'the building'}. The plant stays alive but does not grow.`
      : `I could not find the key idea of "${plot.concept}" in that. Revisit ${subsection?.title ?? 'the building'} and try again; the gap stays on your list.`;
  return { verdict, feedback, conceptsHit: verdict === 'solid' ? [plot.concept] : [], conceptsMissed: verdict === 'solid' ? [] : [plot.concept] };
}
