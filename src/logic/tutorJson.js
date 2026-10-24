// Defensive parsing of the strict-JSON replies we ask Claude for. Pure JS.

/** Remove ```json fences if present. */
export function stripFences(text) {
  const t = String(text ?? '').trim();
  const m = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```\s*$/.exec(t);
  return m ? m[1].trim() : t;
}

/** Find the first balanced {...} object in text (string-aware). Returns the substring or ''. */
export function firstJsonObject(text) {
  const s = String(text ?? '');
  const start = s.indexOf('{');
  if (start < 0) return '';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return '';
}

/** Light repairs: trailing commas, smart quotes around keys are NOT touched (too risky). */
function lightRepair(s) {
  return s.replace(/,\s*([}\]])/g, '$1');
}

/** Try to parse a model reply as a JSON object. Returns the object or null. Never throws. */
export function tryParseJson(text) {
  const candidates = [stripFences(text), firstJsonObject(stripFences(text)), firstJsonObject(text)];
  for (const c of candidates) {
    if (!c) continue;
    for (const attempt of [c, lightRepair(c)]) {
      try {
        const v = JSON.parse(attempt);
        if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

export const REPAIR_PROMPT =
  'Your last reply could not be parsed as JSON. Reply again with ONLY the JSON object that was asked for: no code fences, no commentary, double-quoted keys and strings.';

/**
 * Parse a reply; if that fails, call `retry(badText)` ONCE (it should send the repair prompt and return new text).
 * `validate(obj)` may return a cleaned object or null to reject. Throws a readable Error after the retry.
 */
export async function parseWithRepair(text, retry, validate = (o) => o) {
  const first = tryParseJson(text);
  const ok1 = first ? validate(first) : null;
  if (ok1) return ok1;
  const text2 = await retry(String(text ?? ''));
  const second = tryParseJson(text2);
  const ok2 = second ? validate(second) : null;
  if (ok2) return ok2;
  throw new Error('The tutor sent a reply I could not read, even after asking again. Please retry.');
}

const VERDICTS = ['solid', 'partial', 'missing'];
const strList = (v) => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 8) : []);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** Validate/clean a question object: { text, options?, correct?, modelAnswer? }. Null if unusable. */
export function cleanPrompt(o, { mcq = false } = {}) {
  if (!o) return null;
  const text = str(o.text ?? o.question ?? o.prompt);
  if (!text) return null;
  const out = { text };
  if (mcq) {
    const options = strList(o.options);
    const correct = Number.isInteger(o.correct) ? o.correct : -1;
    if (options.length !== 3 || correct < 0 || correct > 2) return null;
    out.options = options;
    out.correct = correct;
    out.explanation = str(o.explanation);
    out.concept = str(o.concept);
  }
  const model = str(o.modelAnswer);
  if (model) out.modelAnswer = model;
  return out;
}

/** Validate/clean an evaluation object. Unknown verdicts are rejected (so the repair retry runs). */
export function cleanEvaluation(o) {
  if (!o) return null;
  const verdict = str(o.verdict).toLowerCase();
  if (!VERDICTS.includes(verdict)) return null;
  const feedback = str(o.feedback);
  if (!feedback) return null;
  const out = { verdict, feedback, conceptsHit: strList(o.conceptsHit), conceptsMissed: strList(o.conceptsMissed) };
  const f = str(o.followUp);
  if (f && verdict !== 'solid') out.followUp = f;
  if (o.iracScore != null && Number.isFinite(+o.iracScore)) out.iracScore = Math.max(0, Math.min(4, Math.round(+o.iracScore)));
  return out;
}

/** Validate a simple { text } style object (hint, answer, intro). */
export function cleanText(o, key = 'text') {
  const t = str(o?.[key]);
  return t ? { ...o, [key]: t } : null;
}
