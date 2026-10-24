// Vault Sync — compare the Obsidian vault against the static curriculum and
// surface any workshop or lecture notes that are not yet wired up.
//
// Security contract (T103):
//   • ONLY TUTOR-SESSION-*.md files may ever be WRITTEN by game code.
//   • Study notes are read-only.  This file never writes any note.
//
// syncVault(curriculum, opts?) → Promise<{ curriculum, report, fromCache }>
//   curriculum  — the merged curriculum (static + any new notes found in vault)
//   report      — human-readable summary { added: string[], missing: string[], unknown: string[] }
//   fromCache   — true when the result came from sessionStorage (vault wasn't queried)

import { getObsidianConfig, listFiles } from './obsidian.js';
import { parseWorkshopFilename } from '../logic/workshopParser.js';
import { allDistricts } from '../logic/curriculum.js';

const CACHE_KEY = 'lawworld:vaultSync:v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Canonical module code from a curriculum module id like 'LAW7054-tort' → 'LAW7054' */
function moduleCode(moduleId) {
  return moduleId.split('-')[0].toUpperCase();
}

/** All workshop files already registered in the static curriculum */
function registeredWorkshopFiles(curriculum) {
  const files = new Set();
  for (const district of allDistricts(curriculum)) {
    for (const sub of district.subsections) {
      if (sub.workshopFile) files.add(sub.workshopFile);
    }
  }
  return files;
}

/** All lecture source files already registered in the static curriculum */
function registeredSourceFiles(curriculum) {
  const files = new Set();
  for (const district of allDistricts(curriculum)) {
    for (const sub of district.subsections) {
      if (sub.sourceFile) files.add(sub.sourceFile);
    }
  }
  return files;
}

/**
 * Build a label from a vault filename for display:
 * "LAW7054-Tort-W5-Workshop-Prep.md" → "Tort W5 Workshop"
 * "LAW7054-Tort-Lecture1-Trespass-to-Person-Handout.md" → "Tort Lecture1 Trespass to Person Handout"
 */
function labelFromFilename(filename) {
  return filename
    .replace(/^LAW\d+-/i, '')
    .replace(/\.md$/i, '')
    .replace(/-/g, ' ');
}

// ──────────────────────────────────────────────────────────────────────────────
// Deep-clone the curriculum (plain objects only; no Phaser refs)
// ──────────────────────────────────────────────────────────────────────────────
function cloneCurriculum(c) {
  return JSON.parse(JSON.stringify(c));
}

// ──────────────────────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Sync the vault against the curriculum.
 *
 * Always resolves (never throws). Falls back to the static curriculum if the
 * vault is unreachable or the token is missing.
 *
 * @param {object} curriculum - The static curriculum object (not mutated).
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<{ curriculum: object, report: object, fromCache: boolean }>}
 */
export async function syncVault(curriculum, { force = false } = {}) {
  const { token } = getObsidianConfig();

  // No token → nothing to sync; return static curriculum silently.
  if (!token) {
    return { curriculum, report: { added: [], missing: [], unknown: [] }, fromCache: false };
  }

  // Cache check
  if (!force) {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
          return { curriculum: cached.curriculum, report: cached.report, fromCache: true };
        }
      }
    } catch { /* sessionStorage may be unavailable */ }
  }

  // ── Fetch vault file list ─────────────────────────────────────────────────
  let vaultFiles;
  try {
    vaultFiles = await listFiles();
  } catch (err) {
    console.warn('[vaultSync] Could not list vault files:', err.message);
    return { curriculum, report: { added: [], missing: [], unknown: [] }, fromCache: false };
  }

  // Only look at .md files
  const mdFiles = vaultFiles.filter((f) => f.endsWith('.md'));

  // ── Compare against curriculum ────────────────────────────────────────────
  const registered = registeredWorkshopFiles(curriculum);
  const registeredSrc = registeredSourceFiles(curriculum);

  const report = { added: [], missing: [], unknown: [] };
  const merged = cloneCurriculum(curriculum);

  // Check which registered workshop files are MISSING from the vault
  for (const wf of registered) {
    if (!mdFiles.includes(wf)) {
      report.missing.push(wf);
    }
  }

  // Check which vault workshop files are NOT yet in the curriculum
  const workshopMdFiles = mdFiles.filter((f) =>
    /^LAW\d+.*Workshop.*Prep\.md$/i.test(f) || /^LAW\d+.*Workshop-Prep\.md$/i.test(f)
  );

  for (const filename of workshopMdFiles) {
    if (registered.has(filename)) continue; // already wired up

    const parsed = parseWorkshopFilename(filename);
    if (!parsed) {
      report.unknown.push(filename);
      continue;
    }

    // Find the matching module in the merged curriculum by module code
    let targetDistrict = null;
    let targetRegion = null;
    let targetModule = null;

    outer:
    for (const mod of merged.modules) {
      if (moduleCode(mod.id) !== parsed.module) continue;
      for (const region of mod.regions) {
        for (const district of region.districts) {
          // Match by district label matching the parsed district name (case-insensitive)
          const districtName = parsed.district.toLowerCase();
          if (
            district.id.toLowerCase().includes(districtName) ||
            district.title.toLowerCase().includes(districtName)
          ) {
            targetDistrict = district;
            targetRegion = region;
            targetModule = mod;
            break outer;
          }
        }
      }
    }

    if (!targetDistrict) {
      report.unknown.push(filename);
      continue;
    }

    // Build a new subsection for this workshop
    const subId = `${targetDistrict.id}.vault-w${parsed.week}`;
    // Avoid duplicating if already present under this id
    if (targetDistrict.subsections.some((s) => s.id === subId || s.workshopFile === filename)) {
      continue;
    }

    const lastSub = targetDistrict.subsections[targetDistrict.subsections.length - 1];
    const newSub = {
      id: subId,
      title: `Workshop W${parsed.week}: ${labelFromFilename(filename)}`,
      sourceFile: targetDistrict.sourceFile || null,
      heading: `Workshop W${parsed.week}`,
      keyConcepts: [],
      keyCases: [],
      statutes: [],
      prerequisites: lastSub ? [lastSub.id] : [],
      suggestedTutor: 'chen',
      type: 'workshop',
      workshopFile: filename,
    };

    targetDistrict.subsections.push(newSub);
    report.added.push(`${targetDistrict.title} W${parsed.week} (${filename})`);
    console.info(`[vaultSync] Added new workshop: ${filename} → ${subId}`);
  }

  // ── Cache the result ──────────────────────────────────────────────────────
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      curriculum: merged,
      report,
    }));
  } catch { /* storage may be full or blocked */ }

  if (report.added.length || report.missing.length) {
    console.info('[vaultSync] Report:', report);
  }

  return { curriculum: merged, report, fromCache: false };
}
