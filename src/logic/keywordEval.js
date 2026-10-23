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
export function evaluateByConcepts(answer, spec) {
  const { concepts } = spec;
  const solidAt = spec.solidAt ?? 0.75;
  const partialAt = spec.partialAt ?? 0.4;
  const { hit, missed } = matchConcepts(answer, concepts);
  const score = concepts.length ? hit.length / concepts.length : 0;
  let verdict = score >= solidAt ? 'solid' : score >= partialAt ? 'partial' : 'missing';
  // Some ideas are essential: without them an answer cannot be "solid".
  if (verdict === 'solid' && spec.requiredIds?.some((id) => missed.some((c) => c.id === id))) {
    verdict = 'partial';
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
  if (verdict === 'solid') parts.push('That is a solid answer.');

  const result = {
    verdict,
    feedback: parts.join(' '),
    conceptsHit: hit.map((c) => c.label),
    conceptsMissed: missed.map((c) => c.label),
  };
  if (verdict !== 'solid' && missed.length) {
    const first = missed[0];
    result.followUp = spec.followUp
      ? spec.followUp(missed)
      : first.nudge ?? `Have another go, focusing on this: ${first.label}. What can you say about it?`;
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
