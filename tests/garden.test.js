import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seedsFromResult, plantSeed, waterPlot, plotStatus, retrievalTargets, syncBraziers, gardenView, dampRemainingMs,
  GAME_DAY_MS, WITHER_DAYS, DAMP_MS, MAX_STAGE, PLOT_COUNT,
} from '../src/logic/garden.js';
import { evaluateRetrievalOffline, retrievalQuestion, retrievalHint } from '../src/logic/retrieval.js';
import { createFreshSave, normaliseSave } from '../src/logic/save.js';
import { createSaveStore } from '../src/logic/saveStore.js';
import { logGap, openGaps } from '../src/logic/progress.js';
import { makeDistrict } from '../src/logic/curriculum.js';
import { buildWorld } from '../src/logic/layout.js';
import { curriculum } from '../src/data/curriculum.js';
import { createRetrievalTutorStub } from './helpers/retrievalStub.js';

const T0 = Date.parse('2026-10-24T10:00:00.000Z');
const at = (ms) => T0 + ms;

const mini = {
  modules: [{ id: 'm', regions: [{ id: 'r', districts: [
    makeDistrict({ id: 'a', title: 'A', sourceFile: 'a.md', subs: [['one', 'One', 'H1', ['postal rule', 'acceptance'], ['Adams v Lindsell [1818]'], []], ['two', 'Two', 'H2', ['revocation'], [], []]] }),
    makeDistrict({ id: 'b', title: 'B', sourceFile: 'b.md', subs: [['x', 'X', 'HX', ['duty'], [], []]] }),
  ] }] }],
};

const solidResult = (n) => ({ stages: Object.fromEntries([2, 3, 4, 5].map((s) => [s, { answered: true, verdict: s <= n + 1 ? 'solid' : 'partial' }])) });

function saveWith({ seeds = 2, consolidated = [], gaps = [] } = {}) {
  let s = createFreshSave(T0);
  s = { ...s, inventory: { ...s.inventory, seeds } };
  const subsections = Object.fromEntries(consolidated.map((id) => [id, { status: 'consolidated', attempts: 1, lastPlayed: new Date(T0 - 1000).toISOString() }]));
  let progress = { ...s.progress, subsections };
  for (const g of gaps) progress = logGap(progress, g, T0);
  return { ...s, progress };
}

test('seeds come only from solid, answered, evaluated stages', () => {
  assert.equal(seedsFromResult(null), 0);
  assert.equal(seedsFromResult({ stages: { 2: { answered: false, verdict: 'solid' } } }), 0, 'an unanswered stage earns nothing');
  assert.equal(seedsFromResult({ stages: { 2: { answered: true, verdict: 'partial' }, 3: { answered: true, verdict: 'missing' } } }), 0);
  assert.equal(seedsFromResult(solidResult(2)), 2);
  assert.equal(seedsFromResult(solidResult(9)), 4, 'at most one seed per stage 2-5');
  assert.equal(seedsFromResult({ stages: { 6: { answered: true, verdict: 'solid' } } }), 0, 'checkpoint MCQs do not mint seeds');
});

test('save store: a finished encounter adds seeds equal to its solid answers; leaving with nothing adds none', () => {
  const store = createSaveStore({ storage: mapStorage(), now: () => T0 });
  const res = { subsectionId: 'contract-agreement.offer-and-acceptance', finished: false, exchanges: 3, tutor: 'T', gaps: [], checkpoint: null,
    stages: { 2: { answered: true, verdict: 'solid', conceptsHit: [] }, 3: { answered: true, verdict: 'solid', conceptsHit: [] }, 4: { answered: true, verdict: 'partial', conceptsHit: [] } } };
  assert.equal(store.applyEncounter(res, { subsection: { id: res.subsectionId, title: 'x' } }), true);
  assert.equal(store.state.inventory.seeds, 2);
  assert.equal(store.applyEncounter({ ...res, exchanges: 0, stages: {} }, {}), false);
  assert.equal(store.state.inventory.seeds, 2);
});

function mapStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('planting needs a seed, a free plot and a concept, and uses the seed', () => {
  const s = saveWith({ seeds: 1 });
  const target = { subsectionId: 'a.one', concept: 'postal rule' };
  assert.equal(plantSeed(saveWith({ seeds: 0 }), 'plot-0', target, T0).reason, 'no-seed');
  assert.equal(plantSeed(s, 'plot-9', target, T0).reason, 'no-such-plot');
  assert.equal(plantSeed(s, 'plot-0', { subsectionId: 'a.one', concept: '  ' }, T0).reason, 'no-concept');
  const r = plantSeed(s, 'plot-0', target, T0);
  assert.equal(r.ok, true);
  assert.equal(r.save.inventory.seeds, 0);
  assert.equal(r.save.garden.plots[0].stage, 0);
  const again = plantSeed({ ...r.save, inventory: { ...r.save.inventory, seeds: 3 } }, 'plot-0', target, T0);
  assert.equal(again.reason, 'plot-taken');
  const dup = plantSeed({ ...r.save, inventory: { ...r.save.inventory, seeds: 3 } }, 'plot-1', { ...target, concept: 'Postal Rule' }, T0);
  assert.equal(dup.reason, 'already-planted', 'one plant per concept');
});

test('only a solid answer grows a plant; partial waters; missing does nothing; nothing grows by clicking', () => {
  const planted = plantSeed(saveWith({ seeds: 1 }), 'plot-0', { subsectionId: 'a.one', concept: 'postal rule' }, T0).save;
  const later = at(DAMP_MS + 1000);
  assert.equal(waterPlot(planted, 'plot-0', 'bogus', later).reason, 'bad-verdict');
  const miss = waterPlot(planted, 'plot-0', 'missing', later);
  assert.equal(miss.save.garden.plots[0].stage, 0);
  assert.equal(miss.save.garden.plots[0].lastWatered, planted.garden.plots[0].lastWatered, 'missing does not water');
  assert.equal(openGaps(miss.save.progress).length, 1, 'missing logs the gap');
  const part = waterPlot(planted, 'plot-0', 'partial', later);
  assert.equal(part.save.garden.plots[0].stage, 0);
  assert.equal(part.save.garden.plots[0].lastWatered, new Date(later).toISOString());
  const solid = waterPlot(planted, 'plot-0', 'solid', later);
  assert.equal(solid.grew, true);
  assert.equal(solid.save.garden.plots[0].stage, 1);
});

test('a plant cannot be watered again while the soil is damp, and stage never passes the top', () => {
  let s = plantSeed(saveWith({ seeds: 1 }), 'plot-0', { subsectionId: 'a.one', concept: 'postal rule' }, T0).save;
  assert.ok(dampRemainingMs(s.garden.plots[0], T0 + 1000) > 0);
  assert.equal(waterPlot(s, 'plot-0', 'solid', T0 + 1000).reason, 'damp');
  let t = T0;
  for (let i = 0; i < 8; i++) {
    t += DAMP_MS + 1000;
    s = waterPlot(s, 'plot-0', 'solid', t).save;
  }
  assert.equal(s.garden.plots[0].stage, MAX_STAGE);
});

test('withers after 3 in-game days without water, and a solid answer revives it without growth', () => {
  const s = plantSeed(saveWith({ seeds: 1 }), 'plot-0', { subsectionId: 'a.one', concept: 'postal rule' }, T0).save;
  const plot = s.garden.plots[0];
  assert.equal(plotStatus(plot, T0 + (WITHER_DAYS * GAME_DAY_MS) - 1000), 'growing');
  assert.equal(plotStatus(plot, T0 + (WITHER_DAYS * GAME_DAY_MS) + 1000), 'withered');
  const late = T0 + WITHER_DAYS * GAME_DAY_MS + 1000;
  const miss = waterPlot(s, 'plot-0', 'missing', late);
  assert.equal(plotStatus(miss.save.garden.plots[0], late), 'withered', 'a missed answer does not revive');
  const rev = waterPlot(s, 'plot-0', 'solid', late);
  assert.equal(rev.revived, true);
  assert.equal(rev.grew, false);
  assert.equal(plotStatus(rev.save.garden.plots[0], late + 1000), 'growing');
  const view = gardenView(s, late).find((v) => v.id === 'plot-0');
  assert.equal(view.status, 'withered');
  assert.equal(gardenView(s, late).length, PLOT_COUNT);
});

test('a solid retrieval answer resolves the gap on that concept', () => {
  const base = saveWith({ seeds: 1, consolidated: ['a.one'], gaps: [{ subsectionId: 'a.one', concept: 'postal rule', stage: 3 }] });
  const planted = plantSeed(base, 'plot-0', { subsectionId: 'a.one', concept: 'postal rule' }, T0).save;
  const r = waterPlot(planted, 'plot-0', 'solid', at(DAMP_MS + 1));
  assert.equal(openGaps(r.save.progress).length, 0);
  assert.ok(r.save.progress.subsections['a.one'].lastReviewed, 'review time is remembered for spacing');
});

test('retrieval targets: open gaps first (most missed), then consolidated topics least recently seen; planted concepts skipped', () => {
  let s = saveWith({ consolidated: ['a.one', 'b.x'], gaps: [{ subsectionId: 'a.two', concept: 'revocation', stage: 3 }] });
  s = { ...s, progress: logGap(s.progress, { subsectionId: 'a.two', concept: 'revocation' }, T0) }; // missed twice
  s = { ...s, progress: { ...s.progress, subsections: { ...s.progress.subsections, 'a.one': { ...s.progress.subsections['a.one'], lastPlayed: '2026-10-20T00:00:00.000Z' }, 'b.x': { ...s.progress.subsections['b.x'], lastPlayed: '2026-10-10T00:00:00.000Z' } } } };
  const t = retrievalTargets(mini, s.progress, []);
  assert.deepEqual(t.map((x) => [x.kind, x.concept]), [['gap', 'revocation'], ['consolidated', 'duty'], ['consolidated', 'postal rule']]);
  const skipped = retrievalTargets(mini, s.progress, [{ subsectionId: 'b.x', concept: 'Duty' }]);
  assert.ok(!skipped.some((x) => x.concept === 'duty'));
  // a review resets the clock: b.x moves to the back of the queue
  const reviewed = { ...s.progress, subsections: { ...s.progress.subsections, 'b.x': { ...s.progress.subsections['b.x'], lastReviewed: '2026-10-23T00:00:00.000Z' } } };
  assert.equal(retrievalTargets(mini, reviewed, [])[1].subsectionId, 'a.one');
  assert.ok(!retrievalTargets(mini, saveWith({}).progress, []).length, 'nothing consolidated and no gaps: nothing to plant for');
});

test('braziers light when every building in a district is consolidated, and stay lit', () => {
  const districts = mini.modules[0].regions[0].districts;
  const states = { 'a.one': 'consolidated', 'a.two': 'explored', 'b.x': 'consolidated' };
  const s = createFreshSave(T0);
  const none = syncBraziers(s, districts, states);
  assert.deepEqual([...none.lit], ['b']);
  assert.deepEqual(none.newlyLit, ['b']);
  const saved = none.save;
  assert.deepEqual(saved.braziers.lit, ['b']);
  // the same state again changes nothing
  assert.equal(syncBraziers(saved, districts, states).save, saved);
  // a building later regresses (or the vault grows): the brazier stays lit
  const grown = [districts[0], { ...districts[1], subsections: [...districts[1].subsections, { id: 'b.new' }] }];
  const after = syncBraziers(saved, grown, { ...states, 'b.new': 'locked' });
  assert.deepEqual([...after.lit], ['b']);
  assert.deepEqual(after.newlyLit, []);
  // lighting survives a save round-trip
  assert.deepEqual(normaliseSave(JSON.parse(JSON.stringify(saved))).braziers.lit, ['b']);
  // an empty district never lights
  assert.deepEqual(syncBraziers(s, [{ id: 'e', subsections: [] }], {}).newlyLit, []);
});

test('the hub has six reachable garden plots on walkable tiles', () => {
  const w = buildWorld(curriculum);
  assert.equal(w.garden.plots.length, PLOT_COUNT);
  for (const p of w.garden.plots) assert.notEqual(w.tiles[p.ty * w.cols + p.tx] >= 2, true, `${p.id} must be walkable`);
});

test('garden save slice survives normalisation and an old save with no garden loads', () => {
  const s = plantSeed(saveWith({ seeds: 1 }), 'plot-2', { subsectionId: 'a.one', concept: 'postal rule' }, T0).save;
  const round = normaliseSave(JSON.parse(JSON.stringify(s)));
  assert.equal(round.garden.plots[0].id, 'plot-2');
  assert.equal(round.garden.plots[0].concept, 'postal rule');
  assert.deepEqual(normaliseSave({}).garden.plots, []);
});

test('offline retrieval check: needs a real answer; parroting the concept is not solid; a grounded answer is', () => {
  const plot = { concept: 'postal rule' };
  const sub = mini.modules[0].regions[0].districts[0].subsections[0];
  assert.equal(evaluateRetrievalOffline('too short', plot, sub).rejected, true);
  assert.notEqual(evaluateRetrievalOffline('the postal rule', plot, sub).verdict, 'solid');
  assert.notEqual(evaluateRetrievalOffline('It is about the postal rule and what the rule is for postal things in general.', plot, sub).verdict, 'solid');
  const good = evaluateRetrievalOffline('Under the postal rule an acceptance is effective when the letter is posted, not when received, as in Adams v Lindsell, even if the letter is lost in the post.', plot, sub);
  assert.equal(good.verdict, 'solid');
  assert.equal(evaluateRetrievalOffline('I have no idea about this topic at all, honestly speaking.', plot, sub).verdict, 'missing');
});

test('retrieval question and hints name the concept but never give the answer', () => {
  const plot = { concept: 'postal rule' };
  const sub = { title: 'One', keyCases: ['Adams v Lindsell [1818]'] };
  assert.match(retrievalQuestion(plot, sub), /postal rule/);
  assert.match(retrievalHint(plot, sub, 0), /One/);
  assert.ok(!/posted/.test(retrievalHint(plot, sub, 1)));
});

test('Claude tutor: retrieve() judges one concept from the live note and returns a clean evaluation', async () => {
  const { tutor, calls } = createRetrievalTutorStub('{"verdict":"solid","feedback":"Right: effective on posting.","conceptsHit":["postal rule"],"conceptsMissed":[]}');
  const ev = await tutor.retrieve({ subsection: { id: 's', title: 'One', sourceFile: 'N.md', heading: 'H', keyConcepts: ['postal rule'], keyCases: [], statutes: [] }, priorGaps: [] },
    { concept: 'postal rule', question: 'Q?', answer: 'Effective on posting.' });
  assert.equal(ev.verdict, 'solid');
  const last = calls[calls.length - 1].messages[0].content;
  assert.match(last, /GARDEN RETRIEVAL CHECK/);
  assert.match(last, /Effective on posting\./);
  assert.match(last, /NOTE SECTION/);
});
