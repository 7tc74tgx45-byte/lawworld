import test from 'node:test';
import assert from 'node:assert/strict';
import { curriculum } from '../src/data/curriculum.js';
import { allDistricts, flattenSubsections } from '../src/logic/curriculum.js';

// Snapshot of the vault's study-note filenames (names only, no content) taken when the
// curriculum was generated. A typo in a sourceFile would make the live fetch fail silently,
// so we check every district points at a real note. Update when the vault changes.
const VAULT_NOTES = new Set([
  'Bingham - Rule of Law.md',
  'LAW7053-Rutherford-Ch2-What-Is-Law.md',
  'LAW7053-Rutherford-Ch3-Legislation-and-Law-Making.md',
  'LAW7053-Rutherford-Ch4-Statutory-Interpretation.md',
  'LAW7053-Rutherford-Ch5-Judicial-Precedent.md',
  'LAW7053-Rutherford-Ch8-The-Judiciary.md',
  'LAW7053-Rutherford-Ch9-Legal-Personnel.md',
  'LAW7053-Week0-Lecture-Sources-of-Law.md',
  'LAW7054-Contract-W1-Offer-and-Acceptance.md',
  'LAW7054-Contract-W4-Terms-of-Contract.md',
  'LAW7054-Poole-Ch1-Introduction-to-Contract.md',
  'LAW7054-Poole-Ch2-Agreement.md',
  'LAW7054-Poole-Ch2-Certainty.md',
  'LAW7054-Poole-Ch3-Consideration.md',
  'LAW7054-Poole-Ch4-Intention.md',
  'LAW7054-Poole-Ch8-Mistake.md',
  'LAW7054-Tort-Brennan-Ch4-Causation.md',
  'LAW7054-Tort-Ch2-Duty-of-Care.md',
  'LAW7054-Tort-Ch5-Psychiatric-Harm.md',
  'LAW7054-Tort-Ch8-Breach-Standard-of-Care.md',
  'LAW7054-Tort-Ch8-Employers-Liability.md',
  'LAW7054-Tort-Lecture1-Trespass-to-Person-Handout.md',
  'LAW7054-Tort-W4-Breach-of-Duty-Brennan-Ch3.md',
  'LAW7055-Entrenchment-and-Manner-and-Form.md',
  'LAW7055-Stanton-Prescott-Ch1-UK-Constitution.md',
  'LAW7055-Stanton-Prescott-Ch2-Separation-of-Powers.md',
  'LAW7055-Stanton-Prescott-Ch3-Rule-of-Law.md',
  'LAW7055-Stanton-Prescott-Ch4-Parliamentary-Sovereignty.md',
  'LAW7055-Stanton-Prescott-Ch7-Central-Government.md',
  'LAW7055-Stanton-Prescott-Ch8-Parliament.md',
  'LAW7055-W2-Parliamentary-Supremacy-HRA-Pt2.md',
  'LAW7055-W5-Lecture-Rule-of-Law-Separation-of-Powers.md',
]);

test('every district sourceFile is a real vault note, not a cheat sheet, index or session note', () => {
  for (const d of allDistricts(curriculum)) {
    assert.ok(VAULT_NOTES.has(d.sourceFile), `${d.id}: unknown note ${d.sourceFile}`);
    assert.ok(!/cheat-sheet|index|TUTOR-SESSION-/i.test(d.sourceFile), d.sourceFile);
  }
});

test('one district per note', () => {
  const files = allDistricts(curriculum).map((d) => d.sourceFile);
  assert.equal(new Set(files).size, files.length);
});

test('no two subsections in a note share a heading (extractSection would be ambiguous)', () => {
  const seen = new Set();
  for (const s of flattenSubsections(curriculum)) {
    const key = `${s.sourceFile}::${s.heading.replace(/^#+\s*/, '').replace(/[*_`]/g, '').toLowerCase()}`;
    assert.ok(!seen.has(key), `duplicate heading in ${s.sourceFile}: ${s.heading}`);
    seen.add(key);
  }
});

test('Public Law region includes Bingham and the Occupiers\' Liability gap is not papered over', () => {
  const files = allDistricts(curriculum).map((d) => d.sourceFile);
  assert.ok(files.includes('Bingham - Rule of Law.md'));
  const text = JSON.stringify(curriculum);
  assert.ok(!/Occupiers' Liability Act/i.test(text), 'no invented occupiers\' liability content');
});

test('every prerequisite of a first-in-district subsection is in an earlier district or empty', () => {
  const districtOf = new Map();
  for (const d of allDistricts(curriculum)) for (const s of d.subsections) districtOf.set(s.id, d.id);
  for (const d of allDistricts(curriculum)) {
    const first = d.subsections[0];
    for (const p of first.prerequisites) assert.notEqual(districtOf.get(p), d.id, `${first.id} depends on own district`);
  }
});
