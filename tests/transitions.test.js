import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransitionController, seasonStyle, SEASON_STYLE, bannerTitle, contrastRatio, TRANSITION_MS, HALF_MS } from '../src/logic/transitions.js';

function fakeClock() {
  let now = 0;
  const q = [];
  return {
    schedule: (fn, ms) => q.push({ at: now + ms, fn }),
    advance(ms) {
      const target = now + ms;
      for (;;) {
        q.sort((a, b) => a.at - b.at);
        if (!q.length || q[0].at > target) break;
        const t = q.shift();
        now = t.at;
        t.fn();
      }
      now = target;
    },
  };
}

const regions = {
  hub: { id: 'foundations', title: 'Legal Foundations', season: 'spring', isHub: true },
  contract: { id: 'contract', title: 'Contract Law', season: 'summer' },
};

function setup() {
  const log = [];
  const clock = fakeClock();
  const view = {
    begin: (o) => log.push(['begin', o]),
    fadeOut: () => log.push(['fadeOut']),
    end: () => log.push(['end']),
  };
  return { log, clock, ctl: createTransitionController({ view, schedule: clock.schedule }) };
}

test('transition: total is 600ms and the midpoint callback runs at the peak, before the fade back', () => {
  assert.equal(TRANSITION_MS, 600);
  const { log, clock, ctl } = setup();
  let mid = 0;
  assert.equal(ctl.crossRegion(regions.hub, regions.contract, () => { mid++; log.push(['mid']); }), true);
  assert.deepEqual(log.map((l) => l[0]), ['begin']);
  clock.advance(HALF_MS - 1);
  assert.equal(mid, 0);
  clock.advance(1);
  assert.equal(mid, 1);
  assert.deepEqual(log.map((l) => l[0]), ['begin', 'mid', 'fadeOut']);
  clock.advance(HALF_MS);
  assert.deepEqual(log.map((l) => l[0]), ['begin', 'mid', 'fadeOut', 'end']);
  assert.equal(ctl.busy, false);
});

test('transition: uses the destination season colour and region name; the hub is Foundations Town', () => {
  const { log, ctl } = setup();
  ctl.crossRegion(regions.contract, regions.hub);
  assert.equal(log[0][1].title, 'Foundations Town');
  assert.equal(log[0][1].fade, SEASON_STYLE.spring.fade);
  assert.equal(bannerTitle(regions.contract), 'Contract Law');
});

test('transition: one at a time, and never into the region you are already in', () => {
  const { clock, ctl } = setup();
  assert.equal(ctl.crossRegion(regions.contract, regions.contract), false);
  assert.equal(ctl.crossRegion(regions.hub, null), false);
  assert.equal(ctl.crossRegion(regions.hub, regions.contract), true);
  assert.equal(ctl.crossRegion(regions.contract, regions.hub), false);
  clock.advance(TRANSITION_MS);
  assert.equal(ctl.crossRegion(regions.contract, regions.hub), true);
});

test('transition: a throwing midpoint callback still finishes the fade', () => {
  const { log, clock, ctl } = setup();
  const orig = console.error;
  console.error = () => {};
  try {
    ctl.crossRegion(regions.hub, regions.contract, () => { throw new Error('boom'); });
    clock.advance(TRANSITION_MS);
  } finally {
    console.error = orig;
  }
  assert.deepEqual(log.map((l) => l[0]), ['begin', 'fadeOut', 'end']);
  assert.equal(ctl.busy, false);
});

test('season styles: four distinct flashes, unknown season falls back, banner text is readable on the flash', () => {
  const fades = ['spring', 'summer', 'autumn', 'winter'].map((s) => seasonStyle(s).fade);
  assert.equal(new Set(fades).size, 4);
  assert.deepEqual(seasonStyle('nope'), SEASON_STYLE.spring);
  for (const [s, st] of Object.entries(SEASON_STYLE)) {
    assert.ok(contrastRatio(st.fade, st.text) >= 3, `${s} banner contrast ${contrastRatio(st.fade, st.text).toFixed(2)}`);
  }
});
