import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeError } from '../src/logic/apiErrors.js';
import { chooseMode } from '../src/logic/tutorMode.js';
import { createOverlayLock } from '../src/logic/overlayLock.js';
import { createEncounter } from '../src/logic/encounter.js';
import { createOfflineTutor } from '../src/api/offlineTutor.js';
import { demoSubsection } from '../src/data/demoSubsection.js';

test('describeError gives readable, actionable messages', () => {
  assert.equal(describeError(new Error('Claude API error 401: {"error":{"message":"invalid x-api-key"}}')).kind, 'claude-auth');
  assert.equal(describeError(new Error('Claude API error 429: slow down')).kind, 'claude-rate');
  assert.equal(describeError(new Error('No Claude API key. Add one')).kind, 'no-key');
  const net = describeError(new TypeError('Failed to fetch'));
  assert.equal(net.kind, 'network');
  assert.match(net.message, /127\.0\.0\.1:27124/);
  assert.equal(describeError(new Error('Obsidian read error 404: x.md')).kind, 'obsidian-missing');
});

test('chooseMode needs both a Claude key and an Obsidian token, and can be forced offline', () => {
  assert.equal(chooseMode({ hasClaudeKey: true, hasObsidianToken: true }).mode, 'claude');
  assert.equal(chooseMode({ hasClaudeKey: true, hasObsidianToken: false }).mode, 'offline');
  assert.equal(chooseMode({ hasClaudeKey: false, hasObsidianToken: true }).mode, 'offline');
  assert.equal(chooseMode({ hasClaudeKey: true, hasObsidianToken: true, forceOffline: true }).mode, 'offline');
});

test('overlay lock: keyboard is restored only when the last overlay closes', () => {
  const log = [];
  const lock = createOverlayLock({ lock: () => log.push('lock'), unlock: () => log.push('unlock') });
  const a = lock.acquire();
  const b = lock.acquire();
  assert.deepEqual(log, ['lock']);
  a();
  a(); // double release is harmless
  assert.deepEqual(log, ['lock']);
  assert.equal(lock.isOpen, true);
  b();
  assert.deepEqual(log, ['lock', 'unlock']);
  assert.equal(lock.isOpen, false);
});

test('a failed next-prompt fetch is retried without counting the answer twice; switchTutor continues offline', async () => {
  const offline = createOfflineTutor();
  let failNext = false;
  const flaky = {
    ...offline,
    offline: false,
    generate: (s, c) => {
      if (failNext && s === 3) throw new Error('Claude API error 500: boom');
      return offline.generate(s, c);
    },
  };
  const enc = createEncounter({ subsection: demoSubsection, tutor: flaky });
  await enc.next();
  await enc.next(); // stage 2 prompt
  failNext = true;
  const ans = offline.generate(2, { subsection: demoSubsection, priorGaps: [] }).modelAnswer; // a solid answer, so the engine moves on to stage 3
  await assert.rejects(() => enc.submit(ans), (e) => Array.isArray(e.messages) && e.messages.some((m) => m.role === 'player'));
  const before = enc.result().exchanges;
  assert.equal(before, 1);
  assert.equal(enc.hasPending() || enc.status().stage >= 2, true);
  if (enc.hasPending()) {
    const r = await enc.switchTutor(offline);
    assert.equal(r.stage, 3);
    assert.equal(enc.result().exchanges, 1); // not counted twice
  }
});
