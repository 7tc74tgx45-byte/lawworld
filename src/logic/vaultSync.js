// Pure logic for keeping the game map in step with the Obsidian vault.
// No DOM, no fetch, no Phaser. Imported by src/api/vaultSync.js for the live path.
//
// Hard rules:
//  - Read-only on the vault: nothing here may trigger a write.
//  - No note prose stored: only headings and filenames.
//  - TUTOR-SESSION-* notes and cheat-sheets / indexes are always excluded.
//  - Notes already mapped in the static curriculum are excluded from "unmapped".

import { makeDistrict, allDistricts } from './curriculum.js';
import { listHeadings } from './notes.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Filename patterns that must never become game buildings. */
export const EXCLUDED_PATTERNS = [
  /^TUTOR-SESSION-/i,
  /cheat-?sheet/i,
  /\bindex\b/i,
  /^scratch/i,
];

/** LAW module prefix → region/module metadata. */
const MODULE_MAP = {
  LAW7053: { module: 'LAW7053', region: 'foundations', title: 'Legal Foundations', season: 'spring', material: 'Ink' },
  LAW7054: { module: 'LAW7054', region: 'contract',    title: 'Contract Law',      season: 'summer', material: 'Precedent Scrolls' },
  LAW7055: { module: 'LAW7055', region: 'public-law',  title: 'Public Law',        season: 'autumn', material: 'Stone Tablets' },
};

const SUBREGION_RULES = [
  [/\btort\b/i,           'tort'],
  [/\bcontract\b/i,       'contract'],
  [/\bconstitut/i,        'constitution'],
  [/\bparliament/i,       'parliament'],
  [/rule[- _]of[- _]law/i,'rule-of-law'],
];

// ─── Heading parsing ──────────────────────────────────────────────────────────

export function parseHeadings(markdown) {
  return listHeadings(markdown).filter((h) => h.level === 2 || h.level === 3);
}

// ─── Exclusion ───────────────────────────────────────────────────────────────

export function isExcluded(filename) {
  return EXCLUDED_PATTERNS.some((rx) => rx.test(filename));
}

// ─── Region guessing ─────────────────────────────────────────────────────────

export function guessRegion(filename) {
  const upper = filename.toUpperCase();
  const entry = Object.entries(MODULE_MAP).find(([prefix]) => upper.startsWith(prefix));
  if (!entry) return null;
  const [, meta] = entry;
  let subregion = null;
  for (const [rx, name] of SUBREGION_RULES) {
    if (rx.test(filename)) { subregion = name; break; }
  }
  return { ...meta, subregion };
}

// ─── District building from a note ───────────────────────────────────────────

export function districtFromNote(filename, headings) {
  if (isExcluded(filename)) return null;
  const regionMeta = guessRegion(filename);
  if (!regionMeta) return null;

  const districtId = filename.replace(/\.md$/i, '').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  const districtTitle = filename.replace(/\.md$/i, '').replace(/[-_]+/g, ' ');

  const subs = headings.length > 0
    ? headings.map((h, i) => ['h' + (i + 1), h.text, h.text, [], [], [], { pre: [] }])
    : [['main', districtTitle, districtTitle, [], [], [], { pre: [] }]];

  const district = makeDistrict({
    id: districtId,
    title: districtTitle,
    sourceFile: filename,
    source: 'vault-live',
    after: [],
    tutor: 'chen',
    subs,
  });

  district._regionMeta = regionMeta;
  return district;
}

// ─── Diff against curriculum ──────────────────────────────────────────────────

export function diffAgainstCurriculum(curriculum, vaultFiles, headingsByFile) {
  const vaultSet  = new Set(vaultFiles);
  const districts = allDistricts(curriculum);
  const mappedFiles = new Set(districts.map((d) => d.sourceFile));

  const missingFiles = [...mappedFiles].filter((f) => !vaultSet.has(f));

  const missingHeadings = [];
  for (const district of districts) {
    const liveHeadings = headingsByFile.get(district.sourceFile);
    if (!liveHeadings) continue;
    const liveTexts = new Set(liveHeadings.map((h) => normaliseText(h.text)));
    for (const sub of district.subsections) {
      if (sub.type === 'workshop') continue;
      const wanted = normaliseText(sub.heading);
      if (wanted && !liveTexts.has(wanted)) {
        missingHeadings.push({ file: district.sourceFile, heading: sub.heading });
      }
    }
  }

  const unmappedAll    = vaultFiles.filter((f) => !mappedFiles.has(f) && !isExcluded(f));
  const unguessedNotes = unmappedAll.filter((f) => !guessRegion(f));
  const unmappedNotes  = unmappedAll.filter((f) =>  guessRegion(f));

  return { missingFiles, missingHeadings, unmappedNotes, unguessedNotes };
}

// ─── Merge live districts into curriculum ────────────────────────────────────

export function mergeVaultDistricts(curriculum, unmappedNotes, headingsByFile) {
  const existingIds = new Set(
    curriculum.modules.flatMap((m) => m.regions.flatMap((r) => r.districts.map((d) => d.id)))
  );

  const byRegion = new Map();
  for (const file of unmappedNotes) {
    const headings = headingsByFile.get(file) || [];
    let district = districtFromNote(file, headings);
    if (!district) continue;
    if (existingIds.has(district.id)) district = { ...district, id: district.id + '-live' };
    existingIds.add(district.id);
    const regionId = district._regionMeta?.region || 'foundations';
    if (!byRegion.has(regionId)) byRegion.set(regionId, []);
    byRegion.get(regionId).push(district);
  }

  if (byRegion.size === 0) return curriculum;

  const modules = curriculum.modules.map((mod) => ({
    ...mod,
    regions: mod.regions.map((reg) => {
      const extras = byRegion.get(reg.id) || [];
      if (extras.length === 0) return reg;
      return { ...reg, districts: [...reg.districts, ...extras] };
    }),
  }));

  return { ...curriculum, modules };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function normaliseText(text) {
  return String(text ?? '')
    .replace(/[*_`]/g, '')
    .replace(/\[\[|\]\]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:. ]+$/, '')
    .toLowerCase();
}
