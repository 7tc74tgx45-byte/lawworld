import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkshopNote, parseWorkshopFilename, listWorkshopFiles } from './workshopParser.js';

// ── Fixture: real note format (Tort W4) ──────────────────────────────────────
const SAMPLE_NOTE = `---
module: LAW7055
week: 4
topic: Breach of Duty — Workshop Prep
---

# Workshop Prep — Breach of Duty

## Scenario 1: Maria and Bill

Maria runs a medical supply business. In response to an emergency hospital request after a train crash, she drives a delivery van herself despite not having driven for some time.

**Issue: Standard of care**

Maria is not a professional driver — the standard is that of a reasonably competent driver (*Nettleship v Weston* [1971]).

**Issue: Breach**

The evidence that a regular driver could have controlled the van suggests breach.

**Issue: Emergency — utility of conduct (*Watt v Hertfordshire CC* [1954])**

Maria was responding to a genuine emergency.

**Conclusion on breach:** Likely breach.

---

## Scenario 2: Angela, Andy, Mike and Rajinder

Angela has been receiving informal driving lessons from her boss Andy. While driving a forklift truck, she knocks down Mike (a customer), breaking both legs.

**Angela — standard of care**

Applying *Nettleship v Weston* [1971]: a learner driver is held to the standard of a reasonably competent experienced driver.

**Conclusion:** Primary claim lies against Angela and Arco Ltd.

---

## Things to Know Cold

1. **Objective standard** — personal inexperience irrelevant (*Blyth*; *Nettleship*).
2. **Children** — exception: reasonable child of the relevant age (*Mullin v Richards*).
3. ***Watt v Hertfordshire CC*** — emergency services case: saving a life outweighs risk.
`;

const NON_WORKSHOP = `# LAW7054 — Contract Law Notes\n\n## Offer\n\nAn offer is...\n`;

describe('parseWorkshopNote', () => {
  it('returns null for non-workshop notes', () => {
    assert.equal(parseWorkshopNote(NON_WORKSHOP), null);
  });

  it('extracts the title', () => {
    const result = parseWorkshopNote(SAMPLE_NOTE);
    assert.equal(result.title, 'Breach of Duty');
  });

  it('finds both scenarios', () => {
    const result = parseWorkshopNote(SAMPLE_NOTE);
    assert.equal(result.scenarios.length, 2);
  });

  it('extracts scenario names', () => {
    const result = parseWorkshopNote(SAMPLE_NOTE);
    assert.equal(result.scenarios[0].name, 'Maria and Bill');
    assert.equal(result.scenarios[1].name, 'Angela, Andy, Mike and Rajinder');
  });

  it('scenario text excludes Issue blocks', () => {
    const { scenarioText } = parseWorkshopNote(SAMPLE_NOTE).scenarios[0];
    assert.ok(scenarioText.includes('Maria runs a medical supply business'));
    assert.ok(!scenarioText.includes('**Issue:'));
  });

  it('model answer includes all Issue blocks', () => {
    const { modelAnswer } = parseWorkshopNote(SAMPLE_NOTE).scenarios[0];
    assert.ok(modelAnswer.includes('Standard of care'));
    assert.ok(modelAnswer.includes('Watt v Hertfordshire'));
    assert.ok(modelAnswer.includes('Conclusion on breach'));
  });

  it('model answer does not include scenario narrative', () => {
    const { modelAnswer } = parseWorkshopNote(SAMPLE_NOTE).scenarios[0];
    assert.ok(!modelAnswer.includes('Maria runs a medical supply'));
  });

  it('parses Things to Know Cold flash cards', () => {
    const { flashCards } = parseWorkshopNote(SAMPLE_NOTE);
    assert.equal(flashCards.length, 3);
    assert.equal(flashCards[0].index, 1);
    assert.ok(flashCards[0].text.includes('Objective standard'));
    assert.ok(!flashCards[0].text.includes('**'));
  });
});

describe('parseWorkshopFilename', () => {
  it('parses a standard filename', () => {
    assert.deepEqual(parseWorkshopFilename('LAW7054-Tort-W4-Workshop-Prep.md'), { module: 'LAW7054', district: 'Tort', week: 4 });
  });

  it('parses a multi-word district', () => {
    const r = parseWorkshopFilename('LAW7054-Public-Law-W2-Workshop-Prep.md');
    assert.equal(r.district, 'Public-Law');
    assert.equal(r.week, 2);
  });

  it('returns null for non-workshop files', () => {
    assert.equal(parseWorkshopFilename('LAW7054-Tort-W4-Breach-of-Duty.md'), null);
    assert.equal(parseWorkshopFilename('random-file.md'), null);
  });
});

describe('listWorkshopFiles', () => {
  const files = [
    'LAW7054-Tort-W4-Workshop-Prep.md',
    'LAW7054-Tort-W2-Workshop-Prep.md',
    'LAW7054-Contract-W1-Workshop-Prep.md',
    'LAW7055-Tort-W1-Workshop-Prep.md',
    'some-other-note.md',
  ];

  it('filters by module and sorts by week', () => {
    const result = listWorkshopFiles(files, 'LAW7054');
    assert.equal(result.length, 3);
    assert.equal(result[0].week, 1);
    assert.equal(result[1].week, 2);
    assert.equal(result[2].week, 4);
  });

  it('excludes other modules', () => {
    const result = listWorkshopFiles(files, 'LAW7055');
    assert.equal(result.length, 1);
  });

  it('returns empty array when no matches', () => {
    assert.deepEqual(listWorkshopFiles(files, 'LAW9999'), []);
  });
});
