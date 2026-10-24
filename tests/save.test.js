import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_VERSION, SAVE_KEY, BACKUP_KEY, createFreshSave, normaliseSave, migrate, loadSave, writeSave,
  createAutosaver, exportSave, exportFilename, importSave, serializeSave, MATERIAL_KEYS,
} from '../src/logic/save.js';
import { createSaveStore } from '../src/logic/saveStore.js';
import { createProgress, logGap, applyEncounterResult, subsectionState } from '../src/logic/progress.js';

/** In-memory storage with the localStorage surface we use. */
function memStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    _map: m,
  };
}

/** Manual timers so debounce is deterministic. */
function fakeTimers() {
  let id = 0;
  const pending = new Map();
  return {
    setTimeout: (fn) => (pending.set(++id, fn), id),
    clearTimeout: (h) => void pending.delete(h),
    fire: () => { const fns = [...pending.values()]; pending.clear(); fns.forEach((f) => f()); },
    get count() { return pending.size; },
  };
}

const NOW = Date.UTC(2025, 0, 15, 9, 30);

function richSave() {
  let progress = createProgress();
  progress.subsections['a'] = { status: 'consolidated', attempts: 2, lastPlayed: 'x', lastOutcome: 'consolidated' };
  progress.subsections['b'] = { status: 'explored', attempts: 1, lastPlayed: 'x', lastOutcome: 'explored' };
  progress = logGap(progress, { subsectionId: 'b', concept: 'postal rule', stage: 3 }, NOW);
  progress.stats.caseRecall = 7;
  return {
    version: 1,
    player: { x: 123, y: 456, region: 'contract', facing: 'left' },
    cat: { x: 100, y: 440 },
    progress,
    inventory: { seeds: 3, materials: { precedentScrolls: 4, caseReports: 0, statuteRolls: 1, ink: 2 } },
    garden: { plots: [{ id: 'p1', seedId: 's1', subsectionId: 'b', concept: 'postal rule', stage: 2, plantedAt: '2025-01-10T00:00:00.000Z', lastWatered: '2025-01-14T00:00:00.000Z' }] },
    braziers: { lit: ['contract-formation'] },
    tutorPreference: { a: 'hale', b: 'okafor' },
    settings: { claudeModel: 'claude-sonnet-5-5', sound: true },
  };
}

test('fresh save has version 1 and every VISION §7 section', () => {
  const s = createFreshSave(NOW);
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(SAVE_VERSION, 1);
  for (const k of ['player', 'cat', 'progress', 'inventory', 'garden', 'braziers', 'tutorPreference', 'settings']) assert.ok(k in s, k);
  assert.deepEqual(Object.keys(s.inventory.materials).sort(), [...MATERIAL_KEYS].sort());
  assert.deepEqual(s.progress.subsections, {});
  assert.deepEqual(s.garden.plots, []);
});

test('round-trip through storage preserves everything', () => {
  const storage = memStorage();
  const original = normaliseSave(richSave(), NOW);
  assert.deepEqual(writeSave(storage, original, NOW), { ok: true });
  const { save, status } = loadSave(storage);
  assert.equal(status, 'loaded');
  assert.deepEqual(save, { ...original, savedAt: new Date(NOW).toISOString() });
  assert.equal(save.player.region, 'contract');
  assert.equal(save.progress.gaps[0].concept, 'postal rule');
  assert.equal(save.garden.plots[0].stage, 2);
  assert.deepEqual(save.braziers.lit, ['contract-formation']);
});

test('nothing stored gives a fresh game', () => {
  const r = loadSave(memStorage());
  assert.equal(r.status, 'fresh');
  assert.equal(r.save.version, 1);
});

test('corrupt save falls back to fresh without throwing, and keeps a backup', () => {
  for (const bad of ['{not json', '', 'null', '42', '"hi"', '[1,2]', JSON.stringify({ version: 99 }), JSON.stringify({ version: 'one' })]) {
    const storage = memStorage({ [SAVE_KEY]: bad });
    let r;
    assert.doesNotThrow(() => { r = loadSave(storage); }, bad);
    assert.equal(r.status, 'recovered', bad);
    assert.deepEqual(r.save.progress.subsections, {});
    assert.equal(storage.getItem(BACKUP_KEY), bad);
  }
});

test('storage that throws never breaks load or write', () => {
  const angry = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  assert.equal(loadSave(angry).status, 'fresh');
  assert.equal(writeSave(angry, createFreshSave()).ok, false);
  assert.equal(loadSave(null).status, 'fresh');
  assert.equal(writeSave(null, createFreshSave()).ok, false);
});

test('half-broken save keeps usable parts and repairs the rest', () => {
  const raw = {
    version: 1,
    player: { x: 'far', y: 50, region: '', facing: 'sideways' },
    progress: {
      subsections: { good: { status: 'explored' }, bad: { status: 'locked' }, worse: 'yes' },
      gaps: [{ subsectionId: 'good', concept: 'consideration' }, { nope: 1 }, null],
      stats: { caseRecall: -5, application: 'lots', iracFluency: 4 },
    },
    inventory: { seeds: -2, materials: { ink: 3.9, bogus: 5 } },
    garden: { plots: [null, { id: 'p', stage: 99 }] },
    braziers: { lit: ['d1', 'd1', 7] },
    tutorPreference: { a: 'hale', b: 5 },
  };
  const { ok, save } = migrate(raw);
  assert.ok(ok);
  assert.equal(save.player.y, 50);
  assert.equal(save.player.x, 480); // default
  assert.equal(save.player.facing, 'down');
  assert.deepEqual(Object.keys(save.progress.subsections), ['good']); // only valid stored statuses survive
  assert.equal(save.progress.gaps.length, 1);
  assert.equal(save.progress.stats.caseRecall, 0);
  assert.equal(save.progress.stats.application, 0);
  assert.equal(save.progress.stats.iracFluency, 4);
  assert.equal(save.inventory.seeds, 0);
  assert.equal(save.inventory.materials.ink, 3);
  assert.ok(!('bogus' in save.inventory.materials));
  assert.equal(save.garden.plots.length, 1);
  assert.equal(save.garden.plots[0].stage, 5);
  assert.deepEqual(save.braziers.lit, ['d1']);
  assert.deepEqual(save.tutorPreference, { a: 'hale' });
});

test('migration hook runs: unversioned prototype save is upgraded to v1', () => {
  const legacy = { subsections: { x: { status: 'consolidated' } }, gaps: [], stats: { caseRecall: 2 }, player: { x: 9, y: 9 } };
  const r = migrate(legacy);
  assert.ok(r.ok);
  assert.equal(r.from, 0);
  assert.equal(r.steps, 1);
  assert.equal(r.save.version, 1);
  assert.equal(r.save.progress.subsections.x.status, 'consolidated');
  assert.equal(r.save.progress.stats.caseRecall, 2);
  assert.equal(r.save.player.x, 9);
});

test('migration chain runs each step in order, and failures are reported not thrown', () => {
  const calls = [];
  const migrations = {
    1: (s) => (calls.push(1), { ...s, player: { ...s.player, region: 'renamed' } }),
    2: (s) => (calls.push(2), s),
  };
  const r = migrate({ version: 1, player: { region: 'old' } }, { migrations, target: 3 });
  assert.ok(r.ok);
  assert.deepEqual(calls, [1, 2]);
  assert.equal(r.steps, 2);
  assert.equal(r.save.player.region, 'renamed');

  assert.equal(migrate({ version: 1 }, { migrations: { 1: () => { throw new Error('boom'); } }, target: 2 }).reason, 'migration-failed');
  assert.equal(migrate({ version: 1 }, { migrations: {}, target: 2 }).reason, 'missing-migration-1');
  assert.equal(migrate({ version: 5 }).reason, 'newer-version');
  assert.equal(migrate(null).reason, 'not-a-save');
});

test('load runs migrations on an old stored save and reports migratedFrom', () => {
  const storage = memStorage({ [SAVE_KEY]: JSON.stringify({ subsections: { x: { status: 'explored' } } }) });
  const r = loadSave(storage);
  assert.equal(r.status, 'loaded');
  assert.equal(r.migratedFrom, 0);
  assert.equal(r.save.progress.subsections.x.status, 'explored');
});

test('saves never contain API keys or tokens, even if settings held them', () => {
  const s = normaliseSave({ settings: { claudeApiKey: 'sk-secret', obsidianToken: 'tok', claudeModel: 'm', sound: false } });
  assert.deepEqual(s.settings, { claudeModel: 'm', sound: false });
  assert.ok(!serializeSave(s).includes('sk-secret'));
});

test('autosave is debounced: a burst of changes makes one write', () => {
  const storage = memStorage();
  const timers = fakeTimers();
  let writes = 0;
  const origSet = storage.setItem;
  storage.setItem = (k, v) => { writes++; origSet(k, v); };
  let state = createFreshSave(NOW);
  const saver = createAutosaver({ storage, getState: () => state, timers, now: () => NOW });

  for (let i = 0; i < 10; i++) { state = { ...state, player: { ...state.player, x: i } }; saver.schedule(); }
  assert.equal(writes, 0);
  assert.equal(saver.pending, true);
  assert.equal(timers.count, 1);
  timers.fire();
  assert.equal(writes, 1);
  assert.equal(saver.pending, false);
  assert.equal(loadSave(storage).save.player.x, 9); // the latest state, not the first
});

test('flush writes pending changes immediately and is a no-op when clean', () => {
  const storage = memStorage();
  const timers = fakeTimers();
  let state = createFreshSave(NOW);
  const saver = createAutosaver({ storage, getState: () => state, timers, now: () => NOW });
  state = { ...state, player: { ...state.player, x: 77 } };
  saver.schedule();
  assert.equal(saver.flush().ok, true);
  assert.equal(loadSave(storage).save.player.x, 77);
  assert.equal(timers.count, 0);
  const before = storage.getItem(SAVE_KEY);
  saver.flush();
  assert.equal(storage.getItem(SAVE_KEY), before);
});

test('export then import round-trips; export is pretty JSON with a dated filename', () => {
  const original = normaliseSave(richSave(), NOW);
  const text = exportSave(original, NOW);
  assert.ok(text.includes('\n'));
  assert.equal(exportFilename(NOW), 'lawworld-save-2025-01-15-0930.json');
  const r = importSave(text);
  assert.ok(r.ok);
  assert.deepEqual(r.save.progress, original.progress);
  assert.deepEqual(r.save.garden, original.garden);
  assert.deepEqual(r.save.inventory, original.inventory);
});

test('import rejects junk with a message and never throws', () => {
  for (const bad of ['nope', '{}', '[]', '{"hello":1}', '{"version":42}', 'null']) {
    let r;
    assert.doesNotThrow(() => { r = importSave(bad); }, bad);
    assert.equal(r.ok, false, bad);
    assert.ok(r.message.length > 10);
  }
});

test('save store: failed import leaves the current game untouched', () => {
  const storage = memStorage();
  const store = createSaveStore({ storage, timers: fakeTimers(), now: () => NOW });
  store.update((s) => ({ ...s, inventory: { ...s.inventory, seeds: 5 } }));
  assert.equal(store.importText('garbage').ok, false);
  assert.equal(store.state.inventory.seeds, 5);
  const good = exportSave(normaliseSave({ inventory: { seeds: 9 } }), NOW);
  assert.equal(store.importText(good).ok, true);
  assert.equal(store.state.inventory.seeds, 9);
  assert.equal(loadSave(storage).save.inventory.seeds, 9); // import saved immediately
});

test('save store: update is debounced, reset clears storage', () => {
  const storage = memStorage();
  const timers = fakeTimers();
  const store = createSaveStore({ storage, timers, now: () => NOW });
  assert.equal(store.loadStatus, 'fresh');
  store.update((s) => ({ ...s, player: { ...s.player, x: 5 } }));
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(store.pending, true);
  timers.fire();
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).player.x, 5);
  store.reset();
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(store.state.player.x, 480);
});

test('save store: reload restores progress, so a consolidated subsection stays consolidated', () => {
  const storage = memStorage();
  const timers = fakeTimers();
  const store = createSaveStore({ storage, timers, now: () => NOW });
  // A finished solid encounter, as produced by the encounter engine.
  const solid = { verdict: 'solid', answered: true, conceptsHit: ['offer'] };
  const result = {
    subsectionId: 's1', finished: true, exchanges: 12, gaps: [],
    stages: { 2: { ...solid }, 3: { ...solid }, 4: { ...solid }, 5: { ...solid } },
    checkpoint: { correct: 3, total: 3, answered: 3, conceptsHit: [] },
  };
  assert.equal(store.applyEncounter(result, { subsection: { id: 's1' } }), true);
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).progress.subsections.s1.status, 'consolidated'); // immediate write
  const reloaded = createSaveStore({ storage, timers, now: () => NOW });
  assert.equal(reloaded.loadStatus, 'loaded');
  const cur = { modules: [{ id: 'm', regions: [{ id: 'r', districts: [{ id: 'd', subsections: [{ id: 's1', prerequisites: [] }, { id: 's2', prerequisites: ['s1'] }] }] }] }] };
  assert.equal(subsectionState(cur, reloaded.state.progress, 's1'), 'consolidated');
  assert.equal(subsectionState(cur, reloaded.state.progress, 's2'), 'available');
});

test('save store: an encounter with no answers changes nothing and writes nothing', () => {
  const storage = memStorage();
  const store = createSaveStore({ storage, timers: fakeTimers(), now: () => NOW });
  const empty = { subsectionId: 's1', finished: false, exchanges: 0, gaps: [], stages: { 2: {}, 3: {}, 4: {}, 5: {} }, checkpoint: { correct: 0, total: 3, answered: 0 } };
  assert.equal(store.applyEncounter(empty), false);
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(applyEncounterResult(store.state.progress, empty), store.state.progress);
});
