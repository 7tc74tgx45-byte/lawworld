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
export function parseWorkshopNote(markdown) {
  const text = String(markdown ?? '');
  const lines = text.split(/\r?\n/);

  // ── Title ──────────────────────────────────────────────────────────────────
  let title = '';
  for (const ln of lines) {
    const m = /^#\s+Workshop Prep\s*[—–-]\s*(.+)$/i.exec(ln.trim());
    if (m) { title = m[1].trim(); break; }
  }
  // Not a workshop note if no matching title
  if (!title) return null;

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
    const scenarioMatch = /^Scenario\s+\d+\s*:\s*(.+)$/i.exec(name);
    if (scenarioMatch) {
      const scenarioName = scenarioMatch[1].trim();
      // Split at the first **Issue: line
      const firstIssueIdx = sectionLines.findIndex(ln => /^\*\*Issue[:\s]/.test(ln.trim()));
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
