// Pure keyword + concept overlap evaluator used by the offline tutor.
// A stage defines `concepts`: [{ id, label, any: [regex source strings], caseName?, ratio? }]
// A concept is "hit" if any of its patterns matches the (lower-cased) answer.

export function normalise(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ');
}

export function matchConcepts(answer, concepts) {
  const text = normalise(answer);
  const hit = [];
  const missed = [];
  for (const c of concepts) {
    const ok = c.any.some((src) => new RegExp(src, 'i').test(text));
    (ok ? hit : missed).push(c);
  }
  return { hit, missed };
}

/**
 * @param {string} answer
 * @param {{concepts:Array, solidAt?:number, partialAt?:number, cases?:Array, praise?:string}} spec
 */
/**
 * True when an answer is a pile of comma-separated keywords rather than connected sentences
 * (QA finding: a bare list of case names and terms could earn "solid" offline).
 */
export function looksLikeKeywordList(answer) {
  const text = String(answer ?? '');
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 8) return false;
  const commas = (text.match(/[,;]/g) ?? []).length;
  return commas / words > 0.2;
}

/** Words just before a match that show the writer is reporting or rejecting the view, not asserting it. */
const HEDGE_RX = /\b(not|no|never|unlikely|cannot|can't|isn't|wasn't|argue|argues|argued|claim|claims|claimed|says|said|might|may|whether|if|would say|suppose|mistaken|wrong|incorrect)\b/;
const HEDGE_WINDOW = 60;

/**
 * Returns the first snippet where the answer ASSERTS a wrong conclusion (a `wrongRx` pattern matches and is not
 * negated or reported just before it), else null. Patterns are written positively ("the shop is bound"); a
 * preceding "not", "argue", "might", "says" etc. means the writer is not asserting it.
 */
export function assertsWrong(answer, wrongRx = []) {
  const text = normalise(answer);
  for (const src of wrongRx) {
    for (const m of text.matchAll(new RegExp(src, 'gi'))) {
      // Look back within the same clause only (a hedge in an earlier sentence does not cancel this one).
      const before = text.slice(Math.max(0, m.index - HEDGE_WINDOW), m.index).split(/[.;:!?]/).pop();
      if (!HEDGE_RX.test(before)) return m[0];
    }
  }
  return null;
}

export function evaluateByConcepts(answer, spec) {
  const { concepts } = spec;
  const solidAt = spec.solidAt ?? 0.75;
  const partialAt = spec.partialAt ?? 0.4;
  const { hit, missed } = matchConcepts(answer, concepts);
  const score = concepts.length ? hit.length / concepts.length : 0;
  let verdict = score >= solidAt ? 'solid' : score >= partialAt ? 'partial' : 'missing';
  const listy = looksLikeKeywordList(answer);
  if (listy && verdict === 'solid') verdict = 'partial';
  // Some ideas are essential: without them an answer cannot be "solid".
  if (verdict === 'solid' && spec.requiredIds?.some((id) => missed.some((c) => c.id === id))) {
    verdict = 'partial';
  }
  // Asserting the wrong conclusion caps the verdict: never better than partial, and "missing" when the right
  // conclusion is not there at all (keyword overlap alone must not reward a confidently wrong answer).
  const wrong = spec.wrongRx?.length ? assertsWrong(answer, spec.wrongRx) : null;
  if (wrong) {
    const cid = spec.conclusionId ?? 'conc';
    const at = hit.findIndex((c) => c.id === cid);
    const conclusionHit = at >= 0;
    if (conclusionHit) missed.push(...hit.splice(at, 1)); // a conclusion that contradicts itself is not a hit: log it as a gap
    verdict = conclusionHit ? (verdict === 'solid' ? 'partial' : verdict) : 'missing';
  }

  const parts = [];
  if (hit.length) {
    parts.push(`You got these: ${hit.map((c) => c.label).join('; ')}.`);
  } else {
    parts.push('I could not find any of the key ideas in that answer yet.');
  }
  if (missed.length) {
    parts.push(`Missing or unclear: ${missed.map((c) => c.label).join('; ')}.`);
    // Quote the ratio of any missed case, so the precision is taught.
    for (const c of missed.filter((m) => m.caseName && m.ratio).slice(0, 2)) {
      parts.push(`${c.caseName}: ${c.ratio}`);
    }
  }
  if (listy) parts.push('That reads like a list of keywords. Explain how the ideas connect, in full sentences.');
  if (wrong) {
    parts.push(`Careful: you wrote "${wrong}", which is the wrong conclusion on these facts. ${spec.wrongNote ?? 'Check your conclusion against the rule you stated.'}`);
  }
  if (verdict === 'solid') parts.push('That is a solid answer.');

  const result = {
    verdict,
    feedback: parts.join(' '),
    conceptsHit: hit.map((c) => c.label),
    conceptsMissed: missed.map((c) => c.label),
  };
  if (verdict !== 'solid') {
    if (wrong) {
      result.followUp = spec.wrongFollowUp ?? 'Re-read the facts and test your conclusion against the rule: does it really follow? State the conclusion again, with your reason.';
    } else if (missed.length) {
      const first = missed[0];
      result.followUp = spec.followUp
        ? spec.followUp(missed)
        : first.nudge ?? `Have another go, focusing on this: ${first.label}. What can you say about it?`;
    }
  }
  return result;
}

/** IRAC structure score 0-4 from signal words. */
export function iracScore(answer) {
  const t = normalise(answer);
  let s = 0;
  if (/\b(issue|question is|the question|whether)\b/.test(t)) s++;
  if (/\b(rule|law is|general rule|principle|established|held)\b/.test(t)) s++;
  if (/\b(apply|applying|here|in this case|on these facts|alice|bob|because|therefore)\b/.test(t)) s++;
  if (/\b(conclude|conclusion|in conclusion|so,|therefore|thus|likely|no contract|contract (is|has|was) (formed|concluded))\b/.test(t)) s++;
  return s;
}
