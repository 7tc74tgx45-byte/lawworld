// Parser for Workshop Prep vault notes.
// Format: # Workshop Prep — {Topic}
//         ## Scenario N: {Name}
//         [scenario text]
//         **Issue: ...**  [IRAC model answer blocks]
//         ---            (separator between scenarios, optional)
//         ## Things to Know Cold
//         1. item ...

/**
 * Parse a workshop prep markdown note into structured data.
 *
 * Returns:
 * {
 *   title: string,           // from the # heading
 *   scenarios: [
 *     {
 *       name: string,        // "Maria and Bill"
 *       scenarioText: string,// everything before the first **Issue:** line
 *       modelAnswer: string, // all **Issue:** blocks concatenated (private)
 *     }
 *   ],
 *   flashCards: [            // from ## Things to Know Cold numbered list
 *     { index: number, text: string }
 *   ],
 * }
 *
 * Returns null if the note does not look like a workshop prep file.
 */
export function parseWorkshopNote(markdown, filename = '') {
  const text = String(markdown ?? '');
  const lines = text.split(/\r?\n/);

  // ── Title ──────────────────────────────────────────────────────────────────
  // Accept any # heading that contains "workshop" or "prep" (case-insensitive).
  // Extract the descriptive topic portion using several patterns:
  //   "# Workshop Prep — Breach of Duty"   → "Breach of Duty"
  //   "# LAW7054 — Workshop 3: Certainty…" → "Certainty…"
  //   "# LAW7054 Workshop – Duty of Care"  → "Duty of Care"
  //   "# Botsche… — Workshop Prep"         → "Botsche… — Workshop Prep" (fallback)
  let title = '';
  for (const ln of lines) {
    const t = ln.trim();
    if (!/^#\s/.test(t)) continue;
    const heading = t.replace(/^#+\s*/, '');
    if (!/workshop|prep/i.test(heading)) continue;
    // Pattern 1: "Workshop Prep — {topic}" or "Workshop Prep: {topic}"
    let m = /^Workshop Prep\s*[—–:\-]\s*(.+)$/i.exec(heading);
    if (m) { title = m[1].trim(); break; }
    // Pattern 2: "LAW#### — Workshop N: {topic}" or "LAW#### — Workshop N Prep: {topic}"
    m = /^LAW\d+\s*[—–]\s*(?:Chapter\s*\d+\s*)?Workshop\s*(?:Prep\s*[:\-]?\s*|\d+\s*[:\-]\s*)(.+)$/i.exec(heading);
    if (m) { title = m[1].trim(); break; }
    // Pattern 3: "LAW#### Workshop N — {topic}"
    m = /^LAW\d+\s+Workshop\s*\d*\s*[—–\-]\s*(.+)$/i.exec(heading);
    if (m) { title = m[1].trim(); break; }
    // Pattern 4: "{case name} — Workshop Prep" (e.g. Botsche case)
    m = /^(.+)\s*[—–]\s*Workshop Prep$/i.exec(heading);
    if (m) { title = m[1].trim(); break; }
    // Fallback: use the whole heading minus the LAW#### prefix
    title = heading.replace(/^LAW\d+\s*[—–]?\s*/i, '').trim() || heading;
    break;
  }
  // Also accept notes that have ## Scenario sections even without a matching title
  const hasScenarios = lines.some(ln => /^##\s+(?:Scenario|Question)\s+\d+/i.test(ln));
  if (!title && !hasScenarios) return null;
  if (!title) {
    // Derive a readable title from the filename if provided
    // e.g. "LAW7054-Tort-W5-Workshop-Prep.md" → "Tort W5"
    const fnm = /^LAW\d+-([A-Za-z]+(?:-[A-Za-z]+)*)-W(\d+)-Workshop/i.exec(filename);
    title = fnm ? `${fnm[1].replace(/-/g, ' ')} W${fnm[2]}` : 'Workshop';
  }

  // ── Split into top-level ## sections ──────────────────────────────────────
  // We collect line ranges for each ## heading at level 2.
  const sectionStarts = []; // { name, startLine }
  for (let i = 0; i < lines.length; i++) {
    const m = /^##\s+(.+)$/.exec(lines[i]);
    if (m) sectionStarts.push({ name: m[1].trim(), startLine: i });
  }

  const scenarios = [];
  const flashCards = [];

  for (let si = 0; si < sectionStarts.length; si++) {
    const { name, startLine } = sectionStarts[si];
    const endLine = si + 1 < sectionStarts.length ? sectionStarts[si + 1].startLine : lines.length;
    const sectionLines = lines.slice(startLine + 1, endLine); // exclude the ## heading itself

    // ── Scenario sections ───────────────────────────────────────────────────
    const scenarioMatch = /^(?:Scenario|Question)\s+\d+\s*[:\u2014\u2013-]\s*(.+)$/i.exec(name);
    if (scenarioMatch) {
      const scenarioName = scenarioMatch[1].trim();
      // Split at the first analysis line: **Issue:, **Conclusion:, or **BoldHeader — (e.g. Angela — standard of care)
      const firstIssueIdx = sectionLines.findIndex(ln => {
        const t = ln.trim();
        return /^\*\*Issue[:\s]/i.test(t) ||
               /^\*\*Conclusion[:\s]/i.test(t) ||
               /^\*\*[A-Z][^*]+[\u2014\-]\s/.test(t); // e.g. **Angela — standard of care**
      });
      let scenarioText, modelAnswer;
      if (firstIssueIdx === -1) {
        // No Issue blocks — whole section is scenario text
        scenarioText = sectionLines.join('\n').replace(/^-{3,}\s*$/mg, '').trim();
        modelAnswer = '';
      } else {
        scenarioText = sectionLines.slice(0, firstIssueIdx).join('\n').replace(/^-{3,}\s*$/mg, '').trim();
        // Collect all Issue blocks (everything from firstIssueIdx onwards, stripping trailing ---)
        modelAnswer = sectionLines.slice(firstIssueIdx).join('\n').replace(/^-{3,}\s*$/mg, '').trim();
      }
      scenarios.push({ name: scenarioName, scenarioText, modelAnswer });
      continue;
    }

    // ── Things to Know Cold ─────────────────────────────────────────────────
    if (/things\s+to\s+know\s+cold/i.test(name)) {
      for (const ln of sectionLines) {
        // Match numbered list items: "1. text" or "1) text"
        const m = /^\s*(\d+)[.)]\s+(.+)$/.exec(ln);
        if (m) {
          // Strip bold markers from the text
          const clean = m[2].replace(/\*\*/g, '').trim();
          flashCards.push({ index: parseInt(m[1], 10), text: clean });
        }
      }
    }
  }

  // ── Fallback: treat any non-meta ## section as a scenario ───────────────
  // Covers notes whose sections are named things like "## 1. Certainty of Terms"
  // or "## Exercise 2: ECHR Rights Problem Question" rather than Scenario/Question N.
  if (scenarios.length === 0) {
    const SKIP_SECTION = /things\s+to\s+know\s+cold|cases\s+used|citation|key\s+cases|key\s+stat|summary\s+table|overview|at\s+a\s+glance|format$/i;
    for (let si = 0; si < sectionStarts.length; si++) {
      const { name, startLine } = sectionStarts[si];
      if (SKIP_SECTION.test(name)) continue;
      const endLine = si + 1 < sectionStarts.length ? sectionStarts[si + 1].startLine : lines.length;
      const sectionLines = lines.slice(startLine + 1, endLine);
      const body = sectionLines.join('\n').replace(/^-{3,}\s*$/mg, '').trim();
      if (!body) continue;
      // Strip leading numbering from name: "1. Certainty of Terms" → "Certainty of Terms"
      const cleanName = name.replace(/^\d+[.)\s]+/, '').trim();
      scenarios.push({ name: cleanName, scenarioText: body, modelAnswer: '' });
    }
  }

  return { title, scenarios, flashCards };
}

/**
 * Extract the module code and week number from a workshop filename.
 * e.g. "LAW7054-Tort-W4-Workshop-Prep.md" → { module: "LAW7054", district: "Tort", week: 4 }
 * Returns null if the filename doesn't match the pattern.
 */
export function parseWorkshopFilename(filename) {
  const m = /^(LAW\d+)-([A-Za-z]+(?:-[A-Za-z]+)*)-W(\d+)-Workshop/i.exec(filename);
  if (!m) return null;
  return {
    module: m[1].toUpperCase(),
    district: m[2],
    week: parseInt(m[3], 10),
  };
}

/**
 * Given a list of vault filenames, return those that are workshop prep notes
 * for the given module (e.g. "LAW7054"), sorted by week number ascending.
 */
export function listWorkshopFiles(files, module) {
  return files
    .map(f => ({ filename: f, parsed: parseWorkshopFilename(f) }))
    .filter(({ parsed }) => parsed && parsed.module === module.toUpperCase())
    .sort((a, b) => a.parsed.week - b.parsed.week)
    .map(({ filename, parsed }) => ({ filename, ...parsed }));
}
