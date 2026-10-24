// Spending materials (VISION §4, T21). Pure JS: no Phaser, no DOM, no storage.
//
// Materials are earned by advising clients (see clients.js) and are the only currency. They buy two things:
//   1. an EXTRA HINT in an encounter, beyond MAX_HINTS. Still a Socratic nudge: it never gives the answer, never
//      changes a verdict, never counts as an answer. It only buys more help *thinking*, not progress.
//   2. lighting a district's BRAZIER early. This is cosmetic and motivational: it does not consolidate anything,
//      does not unlock any building (only the tutor's evaluation does that), and is recorded as "lit early".
//
// Every function takes a save and returns a new one ({ ok, save, ... } or { ok:false, reason, save }); the save is
// never mutated and is returned unchanged on failure.

import { MATERIAL_BY_REGION, MATERIAL_LABEL } from './clients.js';
import { MATERIAL_KEYS } from './save.js';
import { computeStates } from './progress.js';

export const HINT_COST = 1;
export const BRAZIER_COST = 6;

const count = (save, key) => Math.max(0, Math.floor(save?.inventory?.materials?.[key] ?? 0));

function withMaterials(save, patch) {
  return { ...save, inventory: { ...save.inventory, materials: { ...save.inventory?.materials, ...patch } } };
}

// ---------------------------------------------------------------------------
// Extra hints
// ---------------------------------------------------------------------------

/**
 * Which material would pay for an extra hint: the building's own region material when there is enough,
 * otherwise whichever material the player has most of (so a player is never stranded with, say, only Ink in Tort).
 */
export function hintPayment(save, regionId, cost = HINT_COST) {
  const own = MATERIAL_BY_REGION[regionId];
  if (own && count(save, own) >= cost) return own;
  const richest = [...MATERIAL_KEYS].sort((a, b) => count(save, b) - count(save, a))[0];
  return count(save, richest) >= cost ? richest : null;
}

/** What the encounter's "extra hint" button shows. */
export function hintOffer(save, regionId) {
  const key = hintPayment(save, regionId);
  const shown = key ?? MATERIAL_BY_REGION[regionId] ?? MATERIAL_KEYS[0];
  const label = MATERIAL_LABEL[shown];
  return {
    cost: HINT_COST,
    key,
    label,
    have: count(save, shown),
    canAfford: key !== null,
    text: key
      ? `Extra hint (costs ${HINT_COST} ${label})`
      : `Extra hint (needs ${HINT_COST} ${label}: advise a client to earn some)`,
  };
}

/** Pay for one extra hint. Fails without materials. */
export function buyExtraHint(save, regionId) {
  const key = hintPayment(save, regionId);
  if (!key) return { ok: false, reason: 'no-materials', save };
  return { ok: true, key, cost: HINT_COST, save: withMaterials(save, { [key]: count(save, key) - HINT_COST }) };
}

/** Give the materials back (the tutor could not produce the hint, so nothing was bought). */
export function refundHint(save, key, cost = HINT_COST) {
  if (!MATERIAL_KEYS.includes(key)) return save;
  return withMaterials(save, { [key]: count(save, key) + cost });
}

// ---------------------------------------------------------------------------
// Early brazier
// ---------------------------------------------------------------------------

function districtsWithRegion(curriculum) {
  const out = [];
  for (const m of curriculum.modules ?? []) {
    for (const r of m.regions ?? []) {
      for (const d of r.districts ?? []) out.push({ district: d, region: r, module: m });
    }
  }
  return out;
}

/**
 * One offer per district: can it be lit early, and if not, why not.
 * status: 'lit' | 'unvisited' (nothing studied there yet) | 'poor' (not enough material) | 'ready'.
 * Paid in the district's own region material only: the brazier is about that region.
 */
export function brazierOffers(curriculum, save) {
  const states = computeStates(curriculum, save.progress);
  const lit = new Set(save.braziers?.lit ?? []);
  return districtsWithRegion(curriculum).map(({ district, region, module }) => {
    const key = MATERIAL_BY_REGION[region.id] ?? null;
    const have = key ? count(save, key) : 0;
    const visited = district.subsections.some((s) => states[s.id] === 'explored' || states[s.id] === 'consolidated');
    const all = district.subsections.length > 0 && district.subsections.every((s) => states[s.id] === 'consolidated');
    let status = 'ready';
    if (lit.has(district.id) || all) status = 'lit';
    else if (!visited || !key) status = 'unvisited';
    else if (have < BRAZIER_COST) status = 'poor';
    return {
      districtId: district.id, title: district.title, module: module.title, regionId: region.id,
      key, label: key ? MATERIAL_LABEL[key] : null, cost: BRAZIER_COST, have,
      status, canLight: status === 'ready',
      early: (save.braziers?.early ?? []).includes(district.id) && !all,
    };
  });
}

/** Light a district's brazier early, paying BRAZIER_COST of its region's material. Re-checks everything. */
export function lightBrazierEarly(curriculum, save, districtId) {
  const offer = brazierOffers(curriculum, save).find((o) => o.districtId === districtId);
  if (!offer) return { ok: false, reason: 'no-such-district', save };
  if (offer.status === 'lit') return { ok: false, reason: 'already-lit', save };
  if (offer.status === 'unvisited') return { ok: false, reason: 'not-visited', save };
  if (offer.status === 'poor') return { ok: false, reason: 'no-materials', save };
  const paid = withMaterials(save, { [offer.key]: offer.have - BRAZIER_COST });
  const lit = [...new Set([...(save.braziers?.lit ?? []), districtId])];
  const early = [...new Set([...(save.braziers?.early ?? []), districtId])];
  return { ok: true, key: offer.key, cost: BRAZIER_COST, title: offer.title, save: { ...paid, braziers: { ...save.braziers, lit, early } } };
}
