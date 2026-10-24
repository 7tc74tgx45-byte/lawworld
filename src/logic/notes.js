// Pure helpers for reading study notes (no DOM, no fetch).

const HEADING_RX = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/** Normalise heading text for matching: drop emphasis markers, wikilink brackets, case and trailing colons. */
export function normaliseHeading(text) {
  return String(text ?? '')
    .replace(/[*_`]/g, '')
    .replace(/\[\[|\]\]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:.\s]+$/, '')
    .toLowerCase();
}

/** List the headings of a markdown note: [{ level, text, line }] (line is 0-based). Skips fenced code. */
export function listHeadings(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const out = [];
  let fence = false;
  lines.forEach((ln, i) => {
    if (/^\s*(```|~~~)/.test(ln)) fence = !fence;
    if (fence) return;
    const m = HEADING_RX.exec(ln);
    if (m) out.push({ level: m[1].length, text: m[2], line: i });
  });
  return out;
}

/**
 * Extract the section under `heading`: from that heading line to the next heading of the same or higher
 * level (nested sub-headings are included). Matching ignores #, emphasis, case and trailing colons;
 * an exact match wins, otherwise the first heading that starts with the wanted text.
 * Returns the section text including its heading line, or '' if the heading is not found.
 */
export function extractSection(markdown, heading) {
  const want = normaliseHeading(String(heading ?? '').replace(/^#+\s*/, ''));
  if (!want) return '';
  const lines = String(markdown ?? '').split(/\r?\n/);
  const heads = listHeadings(markdown);
  let idx = heads.findIndex((h) => normaliseHeading(h.text) === want);
  if (idx < 0) idx = heads.findIndex((h) => normaliseHeading(h.text).startsWith(want));
  if (idx < 0) return '';
  const start = heads[idx];
  let end = lines.length;
  for (let j = idx + 1; j < heads.length; j++) {
    if (heads[j].level <= start.level) {
      end = heads[j].line;
      break;
    }
  }
  return lines.slice(start.line, end).join('\n').replace(/\n-{3,}\s*$/, '').trim();
}

/** Trim a section to a size the model can take, cutting at a line boundary. */
export function clipText(text, maxChars = 9000) {
  const t = String(text ?? '');
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const nl = cut.lastIndexOf('\n');
  return (nl > maxChars * 0.6 ? cut.slice(0, nl) : cut) + '\n[... section truncated ...]';
}

/** Filenames of TUTOR-SESSION notes for one subsection, newest first (name has date-time then id). */
export function sessionFilesFor(files, subsectionId) {
  const suffix = `-${subsectionId}.md`;
  return (files ?? [])
    .map((f) => String(f))
    .filter((f) => f.startsWith('TUTOR-SESSION-') && f.endsWith(suffix))
    .sort()
    .reverse();
}
