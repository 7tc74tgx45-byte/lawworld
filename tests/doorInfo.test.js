import test from 'node:test';
import assert from 'node:assert/strict';
import { curriculum } from '../src/data/curriculum.js';
import { createProgress } from '../src/logic/progress.js';
import { describeDoor } from '../src/logic/doorInfo.js';

const FIRST = 'contract-intro.what-is-contract';
const SECOND = 'contract-agreement.objective-approach';

test('an entry building is available and offers a tutor and an honest mode note', () => {
  const d = describeDoor(curriculum, createProgress(), FIRST, { hasOfflineBank: true });
  assert.equal(d.kind, 'study');
  assert.equal(d.mode, 'offline');
  assert.ok(d.canPlay);
  assert.ok(['hale', 'okafor', 'chen'].includes(d.defaultTutor));
});

test('saved tutor preference wins over the suggested tutor', () => {
  const d = describeDoor(curriculum, createProgress(), FIRST, { tutorPreference: { [FIRST]: 'hale' }, hasOfflineBank: true });
  assert.equal(d.defaultTutor, 'hale');
});

test('a building with no bank and no Claude says so rather than failing', () => {
  const d = describeDoor(curriculum, createProgress(), FIRST, { hasOfflineBank: false });
  assert.equal(d.canPlay, false);
  assert.match(d.note, /Claude|Obsidian/);
  const online = describeDoor(curriculum, createProgress(), FIRST, { hasClaudeKey: true, hasObsidianToken: true, hasOfflineBank: false });
  assert.equal(online.mode, 'claude');
  assert.ok(online.canPlay);
});

test('a locked building lists unmet prerequisites by title; explored does not unlock', () => {
  const locked = describeDoor(curriculum, createProgress(), SECOND, {});
  assert.equal(locked.kind, 'locked');
  assert.equal(locked.unmet.length, 1);
  assert.equal(locked.unmet[0].id, FIRST);
  assert.match(locked.text, new RegExp(locked.unmet[0].title.replace(/[()?]/g, '.')));

  const explored = { ...createProgress(), subsections: { [FIRST]: { status: 'explored' } } };
  assert.equal(describeDoor(curriculum, explored, SECOND, {}).kind, 'locked');
  const done = { ...createProgress(), subsections: { [FIRST]: { status: 'consolidated' } } };
  assert.equal(describeDoor(curriculum, done, SECOND, {}).kind, 'study');
});
