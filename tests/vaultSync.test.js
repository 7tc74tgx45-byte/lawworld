import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHeadings,
  isExcluded,
  guessRegion,
  districtFromNote,
  diffAgainstCurriculum,
  mergeVaultDistricts,
} from '../src/logic/vaultSync.js';
import { curriculum } from '../src/data/curriculum.js';
import { allDistricts, flattenSubsections } from '../src/logic/curriculum.js';

describe('parseHeadings', () => {
  it('extracts ## and ### headings', () => {
    const md = '# Title\n\n## Offer\n\n### Counter-offer\n\n#### Deep\n';
    const h = parseHeadings(md);
    assert.equal(h.length, 2);
    assert.equal(h[0].level, 2);
    assert.equal(h[0].text, 'Offer');
    assert.equal(h[1].level, 3);
    assert.equal(h[1].text, 'Counter-offer');
  });

  it('ignores headings inside fenced code blocks', () => {
    const md = '## Real\n\n```\n## Fake\n```\n\n## Also Real\n';
    const h = parseHeadings(md);
    assert.equal(h.length, 2);
    assert.deepEqual(h.map((x) => x.text), ['Real', 'Also Real']);
  });

  it('returns empty array for plain prose', () => {
    assert.deepEqual(parseHeadings('No headings here.'), []);
  });
});

describe('isExcluded', () => {
  it('excludes TUTOR-SESSION files', () => {
    assert.ok(isExcluded('TUTOR-SESSION-2026-01-01T10-00.md'));
    assert.ok(isExcluded('tutor-session-foo.md'));
  });
  it('excludes cheat sheets', () => {
    assert.ok(isExcluded('LAW7054-Cheat-Sheet.md'));
  });
  it('excludes index notes', () => {
    assert.ok(isExcluded('Index.md'));
  });
  it('does not exclude normal study notes', () => {
    assert.ok(!isExcluded('LAW7054-Contract-W1-Offer-and-Acceptance.md'));
  });
});

describe('guessRegion', () => {
  it('identifies LAW7053 as foundations', () => {
    const r = guessRegion('LAW7053-Rutherford-Ch2-What-Is-Law.md');
    assert.equal(r.module, 'LAW7053');
    assert.equal(r.region, 'foundations');
  });
  it('identifies LAW7054 with tort sub-region', () => {
    const r = guessRegion('LAW7054-Tort-W2-Duty-of-Care.md');
    assert.equal(r.module, 'LAW7054');
    assert.equal(r.subregion, 'tort');
  });
  it('identifies LAW7055 with parliament sub-region', () => {
    const r = guessRegion('LAW7055-Parliamentary-Sovereignty-Notes.md');
    assert.equal(r.module, 'LAW7055');
    assert.equal(r.subregion, 'parliament');
  });
  it('returns null for unrecognised prefix', () => {
    assert.equal(guessRegion('random-note.md'), null);
    assert.equal(guessRegion('LAW9999-Something.md'), null);
  });
});

describe('districtFromNote', () => {
  it('returns null for excluded files', () => {
    assert.equal(districtFromNote('TUTOR-SESSION-foo.md', []), null);
  });
  it('returns null for unrecognised region', () => {
    assert.equal(districtFromNote('random-note.md', []), null);
  });
  it('builds a district with one subsection per heading', () => {
    const headings = [
      { level: 2, text: 'Duty of Care', line: 5 },
      { level: 2, text: 'Breach', line: 12 },
    ];
    const d = districtFromNote('LAW7054-Tort-W2-Duty-of-Care-Psychiatric-Injury.md', headings);
    assert.ok(d);
    assert.equal(d.subsections.length, 2);
    assert.equal(d.subsections[0].heading, 'Duty of Care');
  });
  it('creates a fallback subsection when there are no headings', () => {
    const d = districtFromNote('LAW7054-Contract-Week3-Consideration-Estoppel.md', []);
    assert.ok(d);
    assert.equal(d.subsections.length, 1);
  });
  it('all subsections have pre:[] (parallel entry)', () => {
    const headings = [
      { level: 2, text: 'Offer', line: 1 },
      { level: 2, text: 'Acceptance', line: 5 },
    ];
    const d = districtFromNote('LAW7054-Contract-Extra.md', headings);
    for (const sub of d.subsections) {
      assert.deepEqual(sub.prerequisites, []);
    }
  });
  it('sets source to vault-live', () => {
    const d = districtFromNote('LAW7054-Tort-Extra.md', []);
    assert.equal(d.source, 'vault-live');
  });
  it('attaches _regionMeta', () => {
    const d = districtFromNote('LAW7054-Tort-Extra.md', []);
    assert.ok(d._regionMeta);
    assert.equal(d._regionMeta.module, 'LAW7054');
  });
});

describe('diffAgainstCurriculum', () => {
  const KNOWN_FILE = 'LAW7054-Contract-W1-Offer-and-Acceptance.md';

  it('reports a note in curriculum but absent from the vault', () => {
    const vaultFiles = ['LAW7054-Tort-W4-Breach-of-Duty-Brennan-Ch3.md'];
    const diff = diffAgainstCurriculum(curriculum, vaultFiles, new Map());
    assert.ok(diff.missingFiles.includes(KNOWN_FILE));
  });

  it('reports headings that moved in the live note', () => {
    const vaultFiles = allDistricts(curriculum).map((d) => d.sourceFile);
    const headingsByFile = new Map();
    for (const f of vaultFiles) headingsByFile.set(f, []);
    const diff = diffAgainstCurriculum(curriculum, vaultFiles, headingsByFile);
    assert.ok(diff.missingHeadings.length > 0);
  });

  it('does not report missing headings for workshop subsections', () => {
    const vaultFiles = allDistricts(curriculum).map((d) => d.sourceFile);
    const headingsByFile = new Map();
    for (const f of vaultFiles) headingsByFile.set(f, []);
    const diff = diffAgainstCurriculum(curriculum, vaultFiles, headingsByFile);
    for (const mh of diff.missingHeadings) {
      assert.ok(!mh.file.includes('Workshop-Prep'), `workshop heading leaked: ${mh.file}`);
    }
  });

  it('reports an extra vault note as unmapped', () => {
    const extraNote = 'LAW7054-Tort-W2-Duty-of-Care-Psychiatric-Injury.md';
    const vaultFiles = [...allDistricts(curriculum).map((d) => d.sourceFile), extraNote];
    const diff = diffAgainstCurriculum(curriculum, vaultFiles, new Map());
    assert.ok(diff.unmappedNotes.includes(extraNote));
  });

  it('places unrecognised notes in unguessedNotes, not unmappedNotes', () => {
    const weirdNote = 'completely-unknown-note.md';
    const vaultFiles = [...allDistricts(curriculum).map((d) => d.sourceFile), weirdNote];
    const diff = diffAgainstCurriculum(curriculum, vaultFiles, new Map());
    assert.ok(diff.unguessedNotes.includes(weirdNote));
    assert.ok(!diff.unmappedNotes.includes(weirdNote));
  });

  it('excluded files do not appear in unmapped or unguessed', () => {
    const excluded = ['TUTOR-SESSION-2026-01-01.md', 'Cheat-Sheet.md'];
    const vaultFiles = [...allDistricts(curriculum).map((d) => d.sourceFile), ...excluded];
    const diff = diffAgainstCurriculum(curriculum, vaultFiles, new Map());
    for (const f of excluded) {
      assert.ok(!diff.unmappedNotes.includes(f));
      assert.ok(!diff.unguessedNotes.includes(f));
    }
  });
});

describe('mergeVaultDistricts', () => {
  it('returns the same object when there are no unmapped notes', () => {
    const result = mergeVaultDistricts(curriculum, [], new Map());
    assert.equal(result, curriculum);
  });

  it('adds a new district for an unmapped note', () => {
    const newNote = 'LAW7054-Contract-Week3-Consideration-Estoppel.md';
    const headings = [{ level: 2, text: 'Promissory Estoppel', line: 1 }];
    const headingsByFile = new Map([[newNote, headings]]);
    const merged = mergeVaultDistricts(curriculum, [newNote], headingsByFile);
    const districts = allDistricts(merged);
    const added = districts.find((d) => d.sourceFile === newNote);
    assert.ok(added, 'new district should exist in merged curriculum');
    assert.equal(added.source, 'vault-live');
  });

  it('avoids id collision with existing districts', () => {
    const newNote = 'LAW7054-Tort-W2-Duty-of-Care-Psychiatric-Injury.md';
    const merged = mergeVaultDistricts(curriculum, [newNote], new Map());
    const ids = allDistricts(merged).map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length, 'all district ids must be unique');
  });

  it('merged curriculum has no duplicate subsection ids', () => {
    const newNotes = [
      'LAW7054-Tort-W2-Duty-of-Care-Psychiatric-Injury.md',
      'LAW7055-Parliamentary-Sovereignty-Notes.md',
    ];
    const headingsByFile = new Map(newNotes.map((f) => [f, [{ level: 2, text: 'Section A', line: 1 }]]));
    const merged = mergeVaultDistricts(curriculum, newNotes, headingsByFile);
    const subIds = flattenSubsections(merged).map((s) => s.id);
    assert.equal(new Set(subIds).size, subIds.length, 'all subsection ids must be unique');
  });

  it('every subsection in merged curriculum has keyConcepts and keyCases arrays', () => {
    const newNote = 'LAW7054-Contract-Week3-Consideration-Estoppel.md';
    const merged = mergeVaultDistricts(curriculum, [newNote], new Map());
    for (const sub of flattenSubsections(merged)) {
      assert.ok(Array.isArray(sub.keyConcepts));
      assert.ok(Array.isArray(sub.keyCases));
    }
  });
});
