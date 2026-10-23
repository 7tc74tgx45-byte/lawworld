import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkWritePath,
  assertWritable,
  encodeVaultPath,
  normaliseBaseUrl,
  PROTECTED_NOTES,
} from '../src/logic/noteGuard.js';

test('allows TUTOR-SESSION notes', () => {
  assert.equal(checkWritePath('TUTOR-SESSION-2025-01-02-2130-contract-offer-acceptance.md').ok, true);
  assert.doesNotThrow(() => assertWritable('TUTOR-SESSION-x.md'));
});

test('refuses study notes and anything without the prefix', () => {
  for (const name of [
    'LAW7054-Contract-W1-Offer-Acceptance.md',
    'tutor-session-lowercase.md',
    'notes.md',
    ' TUTOR-SESSION-x.md',
    'XTUTOR-SESSION-x.md',
  ]) {
    assert.equal(checkWritePath(name).ok, false, name);
    assert.throws(() => assertWritable(name), /Refusing to write/);
  }
});

test('always refuses the protected Tort note, in any form', () => {
  const p = PROTECTED_NOTES[0];
  assert.equal(p, 'LAW7054-Tort-Ch8-Breach-Standard-of-Care.md');
  for (const name of [p, p.toLowerCase(), 'folder/' + p, encodeURIComponent(p), 'TUTOR-SESSION-/../' + p]) {
    assert.equal(checkWritePath(name).ok, false, name);
  }
});

test('refuses folders, traversal, encoded tricks, non-strings and wrong extension', () => {
  for (const name of [
    'TUTOR-SESSION-a/b.md',
    'TUTOR-SESSION-..\\x.md',
    'TUTOR-SESSION-..md',
    'TUTOR-SESSION-%2e%2e%2fx.md',
    'TUTOR-SESSION-%ZZ.md',
    'TUTOR-SESSION-x.txt',
    'TUTOR-SESSION-x',
    '',
    '   ',
    null,
    undefined,
    42,
    {},
  ]) {
    assert.equal(checkWritePath(name).ok, false, String(name));
  }
});

test('refusals explain why', () => {
  assert.match(checkWritePath('notes.md').reason, /TUTOR-SESSION-/);
  assert.match(checkWritePath('LAW7054-Tort-Ch8-Breach-Standard-of-Care.md').reason, /protected/);
});

test('encodeVaultPath encodes each segment but keeps separators', () => {
  assert.equal(encodeVaultPath('a b/c&d.md'), 'a%20b/c%26d.md');
  assert.equal(encodeVaultPath('Bingham - Rule of Law.md'), 'Bingham%20-%20Rule%20of%20Law.md');
  assert.equal(encodeVaultPath('/x//y/'), 'x/y');
});

test('normaliseBaseUrl trims, strips trailing slashes and falls back', () => {
  assert.equal(normaliseBaseUrl('https://127.0.0.1:27124///'), 'https://127.0.0.1:27124');
  assert.equal(normaliseBaseUrl('  '), 'https://127.0.0.1:27124');
  assert.equal(normaliseBaseUrl(undefined), 'https://127.0.0.1:27124');
  assert.equal(normaliseBaseUrl('http://x:1/', 'z'), 'http://x:1');
});
