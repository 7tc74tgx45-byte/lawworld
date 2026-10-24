// Client NPCs (T12): which problem a client brings, and what good advice earns. Pure JS: no Phaser, no DOM.
//
// A client's problem is built from a subsection the player has already explored or consolidated in that region,
// biased toward subsections with open gaps (so a client doubles as spaced retrieval). Nothing is earned by clicking:
// the reward is computed from the tutor's evaluation of the typed advice, and recomputed here from the evaluations
// in the result, never from a verdict the caller merely claims.

import { subsectionState, openGaps, recordRetrieval, awardStat, VERDICT_POINTS, conceptKey } from './progress.js';

export const MATERIAL_BY_REGION = { foundations: 'ink', contract: 'precedentScrolls', tort: 'caseReports', 'public-law': 'statuteRolls' };
export const MATERIAL_LABEL = { ink: 'Ink', precedentScrolls: 'Precedent Scrolls', caseReports: 'Case Reports', statuteRolls: 'Statute Rolls' };
const MATERIAL_BY_VERDICT = { missing: 0, partial: 1, solid: 2 };

export const CLIENT_COOLDOWN_MS = 5 * 60 * 1000; // a served client leaves; a new one arrives after this
export const RECENT_KEEP = 6;

const NAMES = [
  'Maya Rahman', 'Tomás Ortega', 'Mr Abara', 'Mrs Whitlock', 'Priya Nair', 'Dev Malhotra', 'Greta Holm', 'Mr Penhallow',
  'Chidi Eze', 'Rosa Bellamy', 'Sam Okoye', 'Ms Kowalczyk', 'Jo Pritchard', 'Hamza Qureshi', 'Ellis Dray', 'Nia Thomas',
];

/** One client NPC per region. */
export const slotIdFor = (regionId) => `client-${regionId}`;
export const materialKeyFor = (regionId) => MATERIAL_BY_REGION[regionId] ?? null;

/** Which tutor serves a region's clients by default (VISION §3: Okafor frames things as a client file). */
export const CLIENT_TUTOR_BY_REGION = { contract: 'okafor', tort: 'okafor', 'public-law': 'hale', foundations: 'chen' };
export const clientTutorFor = (regionId) => CLIENT_TUTOR_BY_REGION[regionId] ?? 'okafor';

/**
 * Should a client be standing in this region right now? Needs a served-able explored/consolidated subsection and
 * no cooldown. Returns the candidates too so the caller can pick one. Pure.
 */
export function clientPresence(curriculum, progress, clients, regionId, { canServe, recent, now = Date.now() } = {}) {
  const candidates = clientCandidates(curriculum, progress, regionId, { canServe, recent: recent ?? clients?.recent ?? [] });
  const present = candidates.length > 0 && !onCooldown(clients, slotIdFor(regionId), now);
  return { present, candidates };
}

/** Deterministic client name: the Nth client of a region always has the same name. */
export function clientName(regionId, visit = 0) {
  let h = 7;
  for (const ch of String(regionId)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return NAMES[(h + visit * 5) % NAMES.length];
}

// ---------------------------------------------------------------------------
// Save slice: { cooldowns: { [slotId]: ISO }, recent: [subsectionId], served: n }
// ---------------------------------------------------------------------------

export function normaliseClients(c) {
  const o = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  const cooldowns = {};
  for (const [k, v] of Object.entries(o.cooldowns && typeof o.cooldowns === 'object' ? o.cooldowns : {})) {
    if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) cooldowns[k] = v;
  }
  const recent = (Array.isArray(o.recent) ? o.recent : []).filter((x) => typeof x === 'string' && x).slice(-RECENT_KEEP);
  const served = Number.isFinite(+o.served) && +o.served > 0 ? Math.floor(+o.served) : 0;
  return { cooldowns, recent, served };
}

export function onCooldown(clients, slotId, now = Date.now()) {
  const until = Date.parse(clients?.cooldowns?.[slotId] ?? '');
  return Number.isFinite(until) && until > now;
}

// ---------------------------------------------------------------------------
// Choosing a problem
// ---------------------------------------------------------------------------

/** Subsections of a region the player has explored or consolidated and that can be served (a bank or Claude exists). */
export function clientCandidates(curriculum, progress, regionId, { canServe = () => true, recent = [] } = {}) {
  const region = curriculum.modules.flatMap((m) => m.regions).find((r) => r.id === regionId);
  if (!region) return [];
  const out = [];
  for (const d of region.districts) {
    for (const sub of d.subsections) {
      const state = subsectionState(curriculum, progress, sub.id);
      if (state !== 'explored' && state !== 'consolidated') continue;
      if (!canServe(sub)) continue;
      const gaps = openGaps(progress, { subsectionId: sub.id }).length;
      // Bias: open gaps first (retrieval), explored before consolidated, and not the same one again and again.
      let weight = 1 + 3 * Math.min(gaps, 3) + (state === 'explored' ? 1 : 0);
      if (recent.includes(sub.id)) weight *= 0.2;
      out.push({ subsection: sub, state, gaps, weight });
    }
  }
  return out;
}

/** Weighted pick; rng() in [0,1). Returns the candidate or null. */
export function pickClientCase(candidates, rng = Math.random) {
  const total = candidates.reduce((n, c) => n + c.weight, 0);
  if (!candidates.length || !(total > 0)) return null;
  let r = rng() * total;
  for (const c of candidates) {
    r -= c.weight;
    if (r < 0) return c;
  }
  return candidates[candidates.length - 1];
}

// ---------------------------------------------------------------------------
// Verdict, reaction, reward
// ---------------------------------------------------------------------------

const RANK = { missing: 0, partial: 1, solid: 2 };

/** The verdict a client case earns, from its evaluations: the latest one, capped at partial after "I'm not sure". */
export function clientVerdict(result) {
  const evs = Array.isArray(result?.evaluations) ? result.evaluations : [];
  const last = evs[evs.length - 1];
  if (!last || !(last.verdict in RANK)) return null;
  return result.notSure && last.verdict === 'solid' ? 'partial' : last.verdict;
}

export function clientIrac(result) {
  const xs = (result?.evaluations ?? []).map((e) => e.iracScore).filter((x) => Number.isFinite(x));
  return xs.length ? Math.max(0, Math.min(4, Math.round(Math.max(...xs)))) : 0;
}

/** What the client says back. Honest about the verdict; never gushing over a thin answer. */
export function clientReaction(name, verdict) {
  const first = String(name ?? 'The client').split(' ')[0];
  if (verdict === 'solid') return `${first} sits back, relieved. "That is clear, and I know what to do next. Thank you. Please take this for your trouble."`;
  if (verdict === 'partial') return `${first} nods slowly. "That helps a bit, but I am not sure I understand where I stand. I will think about it. Here is something for your time."`;
  return `${first} frowns. "I am sorry, I am more confused than when I came in. I might ask somebody else." You leave with nothing, but the tutor has noted what to revisit.`;
}

const ZERO_STATS = () => ({ caseRecall: 0, statutoryInterpretation: 0, application: 0, iracFluency: 0 });

/** { verdict, material, amount, stats } for a client result. Unanswered cases earn nothing. */
export function clientReward(result, regionId, subsection) {
  const verdict = clientVerdict(result);
  const stats = ZERO_STATS();
  if (!verdict) return { verdict: null, material: null, amount: 0, stats };
  const irac = clientIrac(result);
  let amount = MATERIAL_BY_VERDICT[verdict] ?? 0;
  if (verdict === 'solid' && irac >= 3) amount += 1; // a clearly structured answer earns a bonus
  stats.application = VERDICT_POINTS[verdict] ?? 0;
  if (verdict !== 'missing') stats.iracFluency = irac;
  if (verdict === 'solid' && subsection?.statutes?.length) stats.statutoryInterpretation = 1;
  if (verdict === 'solid' && subsection?.keyCases?.length) stats.caseRecall = 1;
  return { verdict, material: amount ? materialKeyFor(regionId) : null, amount, stats };
}

/**
 * Fold a finished (or abandoned) client case into a save: stats, materials, gaps (resolved on solid, logged otherwise),
 * cooldown for the client slot and the recent list. Returns { save, reward } or { save: the same object, reward: null }
 * when nothing was answered. Pure.
 */
export function applyClientResult(save, result, { regionId, slotId, subsection, now } = {}) {
  const reward = clientReward(result, regionId, subsection);
  if (!reward.verdict || !result?.subsectionId) return { save, reward: null };
  const t = (now === undefined ? new Date() : new Date(now)).toISOString();
  const id = result.subsectionId;
  let progress = save.progress;
  const last = result.evaluations[result.evaluations.length - 1];
  if (reward.verdict === 'solid') {
    for (const c of last.conceptsHit ?? []) progress = recordRetrieval(progress, { subsectionId: id, concept: c, verdict: 'solid', stage: 5 }, t);
  } else {
    const seen = new Set();
    for (const c of last.conceptsMissed ?? []) {
      if (!conceptKey(c) || seen.has(conceptKey(c))) continue;
      seen.add(conceptKey(c));
      progress = recordRetrieval(progress, { subsectionId: id, concept: c, verdict: reward.verdict, stage: 5 }, t);
    }
  }
  for (const [k, pts] of Object.entries(reward.stats)) progress = awardStat(progress, k, pts);

  const inventory = { ...save.inventory, materials: { ...save.inventory.materials } };
  if (reward.material) inventory.materials[reward.material] = (inventory.materials[reward.material] ?? 0) + reward.amount;

  const clients = normaliseClients(save.clients);
  clients.cooldowns[slotId ?? slotIdFor(regionId)] = new Date(Date.parse(t) + CLIENT_COOLDOWN_MS).toISOString();
  clients.recent = [...clients.recent.filter((x) => x !== id), id].slice(-RECENT_KEEP);
  clients.served += 1;
  return { save: { ...save, progress, inventory, clients }, reward };
}

/** One line for the banner. */
export function describeReward(reward) {
  if (!reward) return 'Nothing answered, so nothing changed.';
  const bits = [];
  if (reward.amount && reward.material) bits.push(`+${reward.amount} ${MATERIAL_LABEL[reward.material]}`);
  const labels = { caseRecall: 'Case Recall', statutoryInterpretation: 'Statutory Interpretation', application: 'Application', iracFluency: 'IRAC Fluency' };
  for (const [k, v] of Object.entries(reward.stats)) if (v > 0) bits.push(`+${v} ${labels[k]}`);
  return bits.length ? bits.join(', ') : 'No reward this time.';
}
