import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClientEncounter } from '../src/logic/clientEncounter.js';
import { applyClientResult, clientPresence, clientVerdict, clientReaction, clientTutorFor, slotIdFor } from '../src/logic/clients.js';
import { createOfflineTutor, clientFileText } from '../src/api/offlineTutor.js';
import { createClaudeTutor } from '../src/api/tutor.js';
import { OFFLINE_BANK } from '../src/data/offlineBank.js';
import { curriculum } from '../src/data/curriculum.js';
import { flattenSubsections } from '../src/logic/curriculum.js';
import { createFreshSave } from '../src/logic/save.js';
import { buildJournal, materialList } from '../src/logic/journal.js';
import { messageView } from '../src/logic/encounterView.js';
import { buildWorld } from '../src/logic/layout.js';
import { clientSpawn, createWanderer, stepWanderer, WANDER_RADIUS } from '../src/logic/clientWander.js';
import { blockedAt, moveWithCollision, TILE_SIZE } from '../src/logic/worldQuery.js';

const BANKED = Object.keys(OFFLINE_BANK).filter((id) => id.includes('.'));
const sub = (id) => flattenSubsections(curriculum).find((s) => s.id === id);

test('offline client case: the bank scenario becomes a client file and the model answer earns a solid, rewarded verdict', async () => {
  for (const id of BANKED) {
    const s = sub(id);
    if (!s) continue;
    const tutor = createOfflineTutor({ personaId: 'okafor' });
    const e = createClientEncounter({ subsection: s, tutor, clientName: 'Maya Rahman' });
    const start = await e.start();
    assert.match(start.messages[0].text, /Maya Rahman has come to the office/, id);
    assert.doesNotMatch(start.messages[0].text, /^Stage 5/);
    // The model answer is IRAC-structured, so the engine must accept and reward it.
    const secret = OFFLINE_BANK[id][5].modelAnswer;
    const r = await e.submit(secret);
    assert.equal(r.done, true, `${id} model answer should end the case`);
    const res = e.result();
    assert.equal(clientVerdict(res), 'solid', id);
    const region = id.startsWith('tort') ? 'tort' : 'contract';
    const { save, reward } = applyClientResult(createFreshSave(), res, { regionId: region, slotId: slotIdFor(region), subsection: s });
    assert.ok(reward.amount >= 2);
    assert.ok(Object.values(save.inventory.materials).some((n) => n >= 2));
  }
});

test('offline client case: a vague answer is not rewarded as solid, gets one follow-up, and the client is honest', async () => {
  const id = BANKED[0];
  const e = createClientEncounter({ subsection: sub(id), tutor: createOfflineTutor({ personaId: 'okafor' }), clientName: 'Priya Nair' });
  await e.start();
  const r1 = await e.submit('I think this is quite an interesting area and there are many different views about it.');
  assert.equal(r1.done, false);
  assert.ok(r1.messages.some((m) => m.role === 'client' && m.kind === 'followUp'));
  const r2 = await e.submit('Still not sure really, it depends on lots of different things in the end.');
  assert.equal(r2.done, true);
  const v = clientVerdict(e.result());
  assert.notEqual(v, 'solid');
  assert.match(clientReaction('Priya Nair', v), /Priya/);
  assert.doesNotMatch(clientReaction('Priya Nair', 'missing'), /thank/i);
});

test('client case: the player can ask a question and it does not count as advice', async () => {
  const e = createClientEncounter({ subsection: sub(BANKED[0]), tutor: createOfflineTutor() });
  await e.start();
  const r = await e.ask('What is the main idea here?');
  assert.equal(r.messages.at(-1).role, 'tutor');
  assert.equal(e.result().evaluations.length, 0);
  assert.equal((await e.ask('hi')).rejected, true);
});

test('client case: switching tutor is only allowed before the client has spoken', async () => {
  const failing = { clientScenario: async () => { throw new Error('network'); }, evaluate: () => ({}) };
  const e = createClientEncounter({ subsection: sub(BANKED[0]), tutor: failing });
  await assert.rejects(() => e.start());
  assert.equal(e.started(), false);
  e.switchTutor(createOfflineTutor());
  await e.start();
  assert.equal(e.started(), true);
  assert.throws(() => e.switchTutor(createOfflineTutor()));
});

test('Claude client case: scenario and IRAC evaluation come from the note, the model answer stays private', async () => {
  const calls = [];
  const SECRET = 'Issue: whether assault needs contact. Rule: apprehension of immediate force is enough. Application: the threat was close. Conclusion: assault.';
  const call = async (req) => {
    calls.push(req);
    const u = req.messages[req.messages.length - 1].content;
    if (/is a client who has walked in/.test(u)) return { text: JSON.stringify({ text: 'He swung at me and stopped. Do I have a claim?', modelAnswer: SECRET }) };
    if (/Evaluate the LATEST advice/.test(u)) return { text: '{"verdict":"solid","feedback":"Clear IRAC.","conceptsHit":["apprehension"],"conceptsMissed":[],"iracScore":4}' };
    if (/Give hint number/.test(u)) return { text: JSON.stringify({ text: SECRET }) }; // a leaky hint
    return { text: '{}' };
  };
  const S = { id: 's1', title: 'Assault', module: 'Tort Law', sourceFile: 'N.md', heading: 'ASSAULT', keyConcepts: ['apprehension'], keyCases: [], statutes: [] };
  const tutor = createClaudeTutor({ personaId: 'okafor', call, readNote: async () => '# T\n## ASSAULT\nAssault is X.', listFiles: async () => [] });
  const e = createClientEncounter({ subsection: S, tutor, clientName: 'Sam Okoye' });
  const start = await e.start();
  assert.match(start.messages[0].text, /Do I have a claim/);
  const hint = await e.hint();
  assert.ok(!hint.messages[0].text.includes('apprehension of immediate force is enough'), 'a hint that copies the model answer is replaced');
  const done = await e.submit('Issue: is it assault. Rule: apprehension of immediate force. Application: he swung. Conclusion: yes.');
  assert.equal(done.done, true);
  const evalCall = calls.find((c) => /Evaluate the LATEST advice/.test(c.messages[0].content));
  assert.match(evalCall.messages[0].content, /He swung at me and stopped/); // the client's words are the question
  assert.match(evalCall.messages[0].content, /Assault is X\./); // the live note section
  assert.equal(e.result().evaluations[0].iracScore, 4);
});

test('clientPresence: nothing explored means no client; a cooldown removes the client; defaults per region', () => {
  const save = createFreshSave();
  const s = flattenSubsections(curriculum).find((x) => x.id.startsWith('contract') && x.prerequisites.length === 0);
  assert.equal(clientPresence(curriculum, save.progress, save.clients, 'contract').present, false);
  const progress = { ...save.progress, subsections: { [s.id]: { status: 'explored' } } };
  assert.equal(clientPresence(curriculum, progress, save.clients, 'contract').present, true);
  const now = Date.parse('2026-01-01T10:00:00Z');
  const cooling = { cooldowns: { 'client-contract': new Date(now + 60000).toISOString() }, recent: [], served: 1 };
  assert.equal(clientPresence(curriculum, progress, cooling, 'contract', { now }).present, false);
  assert.equal(clientPresence(curriculum, progress, cooling, 'contract', { now: now + 120000 }).present, true);
  assert.equal(clientPresence(curriculum, progress, save.clients, 'contract', { canServe: () => false }).present, false);
  assert.equal(clientTutorFor('contract'), 'okafor');
  assert.equal(clientTutorFor('nowhere'), 'okafor');
});

test('client file text strips the stage label and keeps the facts', () => {
  const t = clientFileText('Stage 5, application. Client scenario: Dee promised £500. Advise in IRAC.', 'Mr Abara');
  assert.match(t, /^Mr Abara has come to the office/);
  assert.match(t, /Dee promised £500/);
  assert.doesNotMatch(t, /Stage 5/);
});

test('journal lists materials earned and the number of clients served', () => {
  const save = createFreshSave();
  const base = materialList(save);
  assert.deepEqual(base.map((m) => m.count), [0, 0, 0, 0]);
  assert.deepEqual(base.map((m) => m.label), ['Precedent Scrolls', 'Case Reports', 'Statute Rolls', 'Ink']);
  const withMats = { ...save, inventory: { ...save.inventory, materials: { ...save.inventory.materials, ink: 3 } }, clients: { cooldowns: {}, recent: [], served: 2 } };
  const j = buildJournal(curriculum, withMats);
  assert.equal(j.materials.find((m) => m.key === 'ink').count, 3);
  assert.equal(j.clientsServed, 2);
});

test('client messages get their own label and style', () => {
  const v = messageView({ role: 'client', kind: 'scenario', text: 'x' }, 'Ms Okafor', 'Maya');
  assert.match(v.className, /client/);
  assert.equal(v.label, 'Maya');
  assert.equal(messageView({ role: 'client', kind: 'reaction', text: 'x' }, 'T', 'Maya').label, 'Maya reacts');
});

test('clients spawn on walkable tiles in their region and wander without leaving it or entering walls', () => {
  const world = buildWorld(curriculum);
  let seed = 12345;
  const rng = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  for (const region of world.regions) {
    const at = clientSpawn(world, region.id, null, rng);
    assert.ok(at, `${region.id} has a spawn`);
    assert.equal(blockedAt(world, Math.floor(at.x / TILE_SIZE), Math.floor(at.y / TILE_SIZE)), false);
    const w = createWanderer(at.x, at.y);
    for (let i = 0; i < 4000; i++) {
      stepWanderer(w, 1 / 30, { rng, move: (x, y, dx, dy) => moveWithCollision(world, x, y, dx, dy) });
      assert.equal(blockedAt(world, Math.floor(w.x / TILE_SIZE), Math.floor(w.y / TILE_SIZE)), false);
    }
    assert.ok(Math.hypot(w.x - w.homeX, w.y - w.homeY) <= WANDER_RADIUS + TILE_SIZE, 'stays near home');
  }
  const held = createWanderer(100, 100);
  stepWanderer(held, 5, { rng, move: () => assert.fail('must not move while held'), hold: true });
  assert.equal(held.walking, false);
});
