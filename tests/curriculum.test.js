import test from 'node:test';
import assert from 'node:assert/strict';
import { curriculum } from '../src/data/curriculum.js';
import { allDistricts, flattenSubsections, findCycle, topologicalOrder, TUTORS } from '../src/logic/curriculum.js';

const subs = flattenSubsections(curriculum);
const ids = new Set(subs.map((s) => s.id));

test('curriculum has the four modules and seasons', () => {
  const seasons = curriculum.modules.flatMap((m) => m.regions.map((r) => r.season));
  assert.deepEqual(seasons, ['spring', 'summer', 'autumn', 'winter']);
  assert.ok(subs.length > 150);
});

test('subsection ids are unique', () => {
  assert.equal(ids.size, subs.length);
  const dIds = allDistricts(curriculum).map((d) => d.id);
  assert.equal(new Set(dIds).size, dIds.length);
});

test('all prerequisites exist and none is self-referencing', () => {
  for (const s of subs) {
    for (const p of s.prerequisites) {
      assert.ok(ids.has(p), `${s.id} has unknown prerequisite ${p}`);
      assert.notEqual(p, s.id);
    }
  }
});

test('no prerequisite cycles; topological order covers everything', () => {
  assert.equal(findCycle(subs), null);
  const order = topologicalOrder(subs);
  assert.equal(order.length, subs.length);
  const pos = new Map(order.map((id, i) => [id, i]));
  for (const s of subs) for (const p of s.prerequisites) assert.ok(pos.get(p) < pos.get(s.id));
});

test('findCycle detects a cycle', () => {
  const c = findCycle([
    { id: 'a', prerequisites: ['b'] },
    { id: 'b', prerequisites: ['a'] },
  ]);
  assert.ok(c);
});

test('every subsection has sourceFile, heading, title, valid tutor and arrays', () => {
  for (const s of subs) {
    assert.ok(s.sourceFile && s.sourceFile.endsWith('.md'), s.id);
    assert.ok(s.heading && s.heading.trim(), s.id);
    assert.ok(s.title, s.id);
    assert.ok(TUTORS.includes(s.suggestedTutor), s.id);
    for (const k of ['keyConcepts', 'keyCases', 'statutes', 'prerequisites']) assert.ok(Array.isArray(s[k]), `${s.id}.${k}`);
    assert.ok(s.keyConcepts.length >= 1, `${s.id} needs a concept`);
    assert.ok(!s.sourceFile.startsWith('TUTOR-SESSION-'));
  }
});

test('districts share their subsections\' sourceFile and carry a source flag', () => {
  for (const d of allDistricts(curriculum)) {
    assert.ok(['vault', 'fallback'].includes(d.source));
    assert.ok(d.subsections.length > 0);
    for (const s of d.subsections) assert.equal(s.sourceFile, d.sourceFile);
  }
});

test('each region has at least one entry subsection with no prerequisites', () => {
  for (const m of curriculum.modules) {
    for (const r of m.regions) {
      const entries = r.districts.flatMap((d) => d.subsections).filter((s) => s.prerequisites.length === 0);
      assert.ok(entries.length >= 1, `${r.id} has no entry`);
    }
  }
});

test('extracted lists are short (no copied prose)', () => {
  for (const s of subs) {
    for (const item of [...s.keyConcepts, ...s.keyCases, ...s.statutes]) assert.ok(item.length <= 80, `${s.id}: ${item}`);
    assert.ok(s.keyConcepts.length <= 8 && s.keyCases.length <= 8, s.id);
  }
});

test('VISION §2 ordering holds across districts', () => {
  const before = (a, b) => {
    const seen = new Set();
    const walk = (id) => {
      for (const p of subs.find((s) => s.id === id).prerequisites) if (!seen.has(p)) { seen.add(p); walk(p); }
    };
    walk(b);
    return seen.has(a);
  };
  assert.ok(before('contract-agreement.acceptance', 'contract-consideration.estoppel-requirements'));
  assert.ok(before('contract-consideration.estoppel-requirements', 'contract-intention.contextual'));
  assert.ok(before('contract-intention.contextual', 'contract-terms.incorporation'));
  assert.ok(before('contract-terms.classification', 'contract-mistake.common'));
  assert.ok(before('tort-duty.caparo', 'tort-breach.reasonable-person'));
  assert.ok(before('tort-breach.reasonable-person', 'tort-causation.remoteness'));
  assert.ok(before('tort-causation.remoteness', 'tort-employers.defences'));
  assert.ok(before('tort-duty.caparo', 'tort-psychiatric.alcock-criteria'));
  assert.ok(before('pl-constitution.nature', 'pl-separation.separation-theory'));
  assert.ok(before('pl-separation.separation-theory', 'pl-rule-of-law.defining'));
  assert.ok(before('pl-rule-of-law.defining', 'pl-sovereignty.introduction'));
  assert.ok(before('pl-sovereignty.limbs', 'pl-hra.s3'));
  assert.ok(before('found-precedent.ratio', 'found-interpretation.literal'));
});
