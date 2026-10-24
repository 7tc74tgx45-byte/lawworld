// Garden retrieval questions (T13): one short typed question per watering, plus a local keyword evaluator used
// only when no Claude tutor is available (clearly labelled offline in the UI). Pure JS.

import { MIN_ANSWER_CHARS } from './encounterRules.js';
import { evaluateByConcepts } from './keywordEval.js';

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'is', 'on', 'for', 'by', 'with', 'as', 'at', 'it', 'be', 'that', 'this', 'are']);
const sigWords = (s) => [...new Set(String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
const stem = (w) => w.replace(/(ing|ed|es|s)$/, '');

/** The three kinds of retrieval question (T22). Rotating them stops the player memorising one phrasing. */
export const QUESTION_KINDS = ['rule', 'case', 'apply'];

const hashStr = (s) => [...String(s ?? '')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/**
 * Which kind to ask this time. Each watering round moves on to the next kind, starting from a point that depends on
 * the concept (so two plants planted together do not both begin with "rule"). A 'case' question needs a case or a
 * statute in the building; when there is none it is skipped, so we never ask for a case that does not exist.
 */
export function pickKind(plot, subsection, { available = QUESTION_KINDS } = {}) {
  const kinds = QUESTION_KINDS.filter((k) => available.includes(k) && (k !== 'case' || (subsection?.keyCases?.length || subsection?.statutes?.length)));
  const list = kinds.length ? kinds : ['rule'];
  return list[((plot?.waterings ?? 0) + hashStr(plot?.concept)) % list.length];
}

/** Generic templates (used for Claude, and offline for buildings with no retrieval bank). They name the concept, never the answer. */
export function retrievalQuestion(plot, subsection, kind = 'rule') {
  const where = subsection?.title ? ` (from "${subsection.title}")` : '';
  const c = plot.concept;
  if (kind === 'case') {
    const authority = subsection?.keyCases?.length
      ? 'Name the case that goes with it (or another you know), then give its facts, the rule it decided, and why it matters.'
      : 'Name the statutory section or authority that goes with it, and say what it provides.';
    return `Your plant is thirsty. Without looking at your notes: "${c}"${where} has authority behind it. ${authority}`;
  }
  if (kind === 'apply') {
    return `Your plant is thirsty. Without looking at your notes: a client's problem turns on "${c}"${where}. Invent two or three facts that would engage it, then advise in Issue, Rule, Application, Conclusion order: what must be shown, how the facts measure up, and what you would tell the client.`;
  }
  return `Your plant is thirsty. Without looking at your notes, state the rule for "${c}"${where} precisely: what is the idea or test, what are its parts, and which case or statute goes with it?`;
}

/**
 * The full plan for one watering: { kind, question, item } where `item` is a banked offline item (or null).
 * With `useBank` and a bank for this building, the question comes from the bank (concrete facts for 'apply').
 */
export function planRetrieval(plot, subsection, { bank = null, useBank = false } = {}) {
  const items = useBank && Array.isArray(bank) && bank.length ? bank : null;
  const kind = pickKind(plot, subsection, { available: items ? [...new Set(items.map((i) => i.kind))] : QUESTION_KINDS });
  if (items) {
    const ofKind = items.filter((i) => i.kind === kind);
    const concept = String(plot.concept ?? '');
    const item = ofKind.find((i) => i.about && new RegExp(i.about, 'i').test(concept)) ?? ofKind[0] ?? items[0];
    return { kind: item.kind, question: `Your plant is thirsty. ${item.q}`, item };
  }
  return { kind, question: retrievalQuestion(plot, subsection, kind), item: null };
}

const KIND_LABEL = { rule: 'rule question', case: 'case question', apply: 'apply-to-facts question' };
export const kindLabel = (k) => KIND_LABEL[k] ?? 'question';

/** Offline judge for a banked item: concept overlap (the same rules as the encounter bank), labelled by the UI. */
export function evaluateRetrievalItem(answer, item, plot) {
  const text = String(answer ?? '').trim();
  if (text.length < MIN_ANSWER_CHARS) return { rejected: true, feedback: `Write a sentence or two (at least ${MIN_ANSWER_CHARS} characters). That was not counted.` };
  const ev = evaluateByConcepts(text, { concepts: item.concepts, solidAt: item.solidAt ?? 0.75, partialAt: 0.4, requiredIds: item.requiredIds ?? [], wrongRx: item.wrongRx ?? [], wrongNote: item.wrongNote, conclusionId: 'conc' });
  const label = plot?.concept ?? 'this concept';
  const tail = ev.verdict === 'solid' ? '' : ` A model answer, so the point lands: ${item.model}`;
  return { verdict: ev.verdict, feedback: `${ev.feedback}${tail}`, conceptsHit: ev.verdict === 'solid' ? [label] : [], conceptsMissed: ev.verdict === 'solid' ? [] : [label] };
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
