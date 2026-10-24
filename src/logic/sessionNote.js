// Pure helpers for TUTOR-SESSION notes (T08): filename builder, note formatter, parser and the
// short "memory" line that goes into the tutor's context. No DOM, no fetch, no storage.
//
// A session note never contains the transcript or any study-note prose: only the stage verdicts,
// concept labels the tutor judged, the gap list, and a few rule-based "next time" pointers.

import { STAGES, CHECKPOINT_QUESTIONS } from './encounterRules.js';

export const SESSION_PREFIX = 'TUTOR-SESSION-';

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Local calendar date, YYYY-MM-DD. */
export function formatDate(d) {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Local time, HHMM (used in filenames). */
export function formatHHMM(d) {
  return `${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Make a subsection id safe to sit inside a vault filename (ids are already slugs; this is a belt-and-braces step). */
export function sessionIdPart(subsectionId) {
  const s = String(subsectionId ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-.]+|[-]+$/g, '');
  return s || 'unknown';
}

/** TUTOR-SESSION-YYYY-MM-DD-HHMM-<subsectionId>.md (local time). */
export function sessionFilename(date, subsectionId) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error('sessionFilename needs a valid date.');
  return `${SESSION_PREFIX}${formatDate(d)}-${formatHHMM(d)}-${sessionIdPart(subsectionId)}.md`;
}

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True if `filename` is a session note for exactly this subsection (not one whose id merely ends the same way). */
export function isSessionFileFor(filename, subsectionId) {
  const rx = new RegExp(`^${escapeRx(SESSION_PREFIX)}\\d{4}-\\d{2}-\\d{2}-\\d{4}-${escapeRx(sessionIdPart(subsectionId))}\\.md$`);
  return rx.test(String(filename));
}

/** 'YYYY-MM-DD' from a session filename, or ''. */
export function sessionDateFromFilename(filename) {
  const m = /^TUTOR-SESSION-(\d{4}-\d{2}-\d{2})-\d{4}-/.exec(String(filename));
  return m ? m[1] : '';
}

/** Did the player answer anything? Opening and leaving at once leaves no note. */
export function hasSessionContent(result) {
  if (!result) return false;
  const stages = result.stages ?? {};
  return Object.values(stages).some((s) => s?.answered || s?.notSure) || (result.checkpoint?.answered ?? 0) > 0;
}

const yamlStr = (v) => JSON.stringify(String(v ?? ''));
const stageLabel = (n) => STAGES[n - 1]?.label ?? `Stage ${n}`;
const oneLine = (s, max = 200) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const key = (c) => String(c ?? '').trim().toLowerCase();

function uniqueBy(list) {
  const seen = new Set();
  return list.filter((c) => {
    const k = key(c);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Distinct gaps (concept + the stage where it was found). */
function gapRows(result) {
  const seen = new Set();
  const rows = [];
  for (const g of result.gaps ?? []) {
    const k = `${key(g.concept)}|${g.stage}`;
    if (!g.concept || seen.has(k)) continue;
    seen.add(k);
    rows.push(g);
  }
  return rows;
}

function coveredLines(result) {
  const lines = [];
  for (const n of [2, 3, 4, 5]) {
    const s = result.stages?.[n];
    if (!s?.answered) {
      lines.push(`- ${stageLabel(n)}: ${s?.notSure ? 'said "not sure" (taught, not secured)' : 'not answered'}`);
      continue;
    }
    const extra = [];
    if (s.followUps) extra.push(`${s.followUps} follow-up${s.followUps > 1 ? 's' : ''}`);
    if (s.hints) extra.push(`${s.hints} hint${s.hints > 1 ? 's' : ''}`);
    if (s.notSure) extra.push('said "not sure" first');
    if (n === 5 && typeof s.iracScore === 'number') extra.push(`IRAC ${s.iracScore}/4`);
    lines.push(`- ${stageLabel(n)}: ${s.verdict ?? 'not judged'}${extra.length ? ` (${extra.join(', ')})` : ''}`);
  }
  const cp = result.checkpoint ?? {};
  lines.push(`- Checkpoint: ${cp.correct ?? 0}/${cp.total ?? CHECKPOINT_QUESTIONS}${(cp.answered ?? 0) < (cp.total ?? CHECKPOINT_QUESTIONS) ? ` (${cp.answered ?? 0} answered)` : ''}`);
  if (!result.finished) lines.push('- Left before the verdict.');
  return lines;
}

function landedConcepts(result, gaps) {
  const gapKeys = new Set(gaps.map((g) => key(g.concept)));
  const hit = [];
  for (const n of [2, 3, 4, 5]) {
    const s = result.stages?.[n];
    if (s?.answered && (s.verdict === 'solid' || s.verdict === 'partial')) hit.push(...(s.conceptsHit ?? []));
  }
  hit.push(...(result.checkpoint?.conceptsHit ?? []));
  return uniqueBy(hit).filter((c) => !gapKeys.has(key(c)));
}

function nextTimeLines(result, gaps) {
  const lines = [];
  const concepts = uniqueBy(gaps.map((g) => g.concept)).slice(0, 6);
  if (concepts.length) lines.push(`- Open with a retrieval question on: ${concepts.join('; ')}.`);
  const unanswered = [2, 3, 4, 5].filter((n) => !result.stages?.[n]?.answered);
  if (unanswered.length) lines.push(`- Still to answer: ${unanswered.map(stageLabel).join(', ')}.`);
  const notSolid = [3, 5].filter((n) => result.stages?.[n]?.answered && result.stages[n].verdict !== 'solid');
  if (notSolid.length) lines.push(`- To consolidate, ${notSolid.map(stageLabel).join(' and ')} must come out solid.`);
  const cp = result.checkpoint ?? {};
  if (result.finished && (cp.correct ?? 0) < 2) lines.push(`- Checkpoint was ${cp.correct ?? 0}/${cp.total ?? CHECKPOINT_QUESTIONS}: re-read the section before retrying.`);
  for (const r of result.reflections ?? []) {
    if (r) lines.push(`- In your own words, the shakiest or most memorable part: "${oneLine(r)}"`);
  }
  if (!lines.length) lines.push('- Nothing outstanding. A retrieval question in the garden will keep it fresh.');
  return lines;
}

/**
 * Build the note text.
 * @param {{ date: Date, subsection: {id,title}, module?: string, district?: string, tutor?: string, result: object }} p
 */
export function formatSessionNote({ date, subsection, module, district, tutor, result }) {
  const d = date instanceof Date ? date : new Date(date);
  const gaps = gapRows(result);
  const cp = result.checkpoint ?? {};
  const fm = [
    '---',
    `date: ${formatDate(d)}`,
    `time: ${yamlStr(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`,
    `module: ${yamlStr(module ?? subsection.module ?? '')}`,
    `district: ${yamlStr(district ?? '')}`,
    `subsection: ${yamlStr(subsection.id)}`,
    `title: ${yamlStr(subsection.title)}`,
    `tutor: ${yamlStr(tutor ?? result.tutor ?? '')}`,
    `outcome: ${result.outcome === 'consolidated' ? 'consolidated' : 'explored'}`,
    `finished: ${result.finished ? 'true' : 'false'}`,
    `checkpoint: ${yamlStr(`${cp.correct ?? 0}/${cp.total ?? CHECKPOINT_QUESTIONS}`)}`,
    'tags: [tutor-session]',
    '---',
  ];
  const landed = landedConcepts(result, gaps);
  const body = [
    '',
    `# Tutor session: ${subsection.title}`,
    '',
    '## Covered',
    ...coveredLines(result),
    '',
    '## Landed',
    ...(landed.length ? landed.map((c) => `- ${c}`) : ['- Nothing judged solid yet.']),
    '',
    '## Gaps',
    ...(gaps.length ? gaps.map((g) => `- ${g.concept} — ${stageLabel(g.stage)}, ${g.verdict ?? 'missing'}`) : ['- None logged.']),
    '',
    '## Next time',
    ...nextTimeLines(result, gaps),
    '',
  ];
  return [...fm, ...body].join('\n');
}

// ---------------------------------------------------------------------------
// Reading a session note back (memory)
// ---------------------------------------------------------------------------

function sectionLines(md, heading) {
  const lines = String(md ?? '').split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${escapeRx(heading)}\\s*$`, 'i').test(l));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) break;
    const t = lines[i].replace(/^\s*[-*]\s+/, '').trim();
    if (t) out.push(t);
  }
  return out;
}

/** Pull what the tutor needs from a session note: { date, outcome, gaps[], nextTime[] }. */
export function parseSessionNote(markdown, filename = '') {
  const md = String(markdown ?? '');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1] ?? '';
  const field = (name) => {
    const m = new RegExp(`^${name}:\\s*(.*)$`, 'm').exec(fm);
    return m ? m[1].trim().replace(/^"(.*)"$/, '$1') : '';
  };
  const gaps = sectionLines(md, 'Gaps')
    .filter((l) => !/^none\b/i.test(l))
    .map((l) => {
      const i = l.lastIndexOf(' — ');
      return (i > 0 ? l.slice(0, i) : l).trim();
    });
  const nextTime = sectionLines(md, 'Next time').filter((l) => !/^nothing outstanding/i.test(l));
  return { date: field('date') || sessionDateFromFilename(filename), outcome: field('outcome'), gaps, nextTime };
}

/** One compact line of memory for the tutor prompt. Accepts a parsed session object or a plain string. */
export function formatSessionMemory(s, maxChars = 700) {
  if (typeof s === 'string') return oneLine(s, maxChars);
  const parts = [];
  if (s.date || s.outcome) parts.push(`${s.date || 'earlier'}${s.outcome ? ` (${s.outcome})` : ''}.`);
  if (s.gaps?.length) parts.push(`Gaps: ${s.gaps.join('; ')}.`);
  if (s.nextTime?.length) parts.push(`Next time: ${s.nextTime.join(' ')}`);
  return oneLine(parts.join(' '), maxChars);
}
