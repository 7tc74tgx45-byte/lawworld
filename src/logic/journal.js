// View model for the journal screen (Tab). Pure JS: takes the curriculum and the save, returns plain data.
// The DOM lives in src/ui/journal.js.

import { allDistricts, subsectionIndex, locateSubsection } from './curriculum.js';
import { computeRollups, openGaps, statLevel, STAT_KEYS, STAT_LABELS } from './progress.js';
import { STAGES } from './encounterRules.js';
import { recentSessions } from './sessionLog.js';
import { MATERIAL_LABEL } from './clients.js';

const stageLabel = (n) => STAGES.find((s) => s.n === n)?.label ?? null;

/** Four stat bars: level, points into the level, and a 0-1 fill. */
export function statBars(progress) {
  return STAT_KEYS.map((key) => {
    const l = statLevel(progress.stats?.[key] ?? 0);
    return { key, label: STAT_LABELS[key], level: l.level, points: l.points, intoLevel: l.intoLevel, needed: l.needed, fraction: l.fraction };
  });
}

/** Open gaps with where they live, most-missed first. Unknown buildings (curriculum changed) are kept and flagged. */
export function revisitList(curriculum, progress) {
  return openGaps(progress).map((g) => {
    const where = locateSubsection(curriculum, g.subsectionId);
    return {
      subsectionId: g.subsectionId,
      concept: g.concept,
      stage: g.stage ?? null,
      stageLabel: stageLabel(g.stage),
      timesMissed: g.timesMissed,
      firstSeen: g.firstSeen,
      lastSeen: g.lastSeen,
      known: !!where,
      building: where?.subsection.title ?? null,
      district: where?.district.title ?? null,
      module: where?.module.title ?? null,
      sourceFile: where?.subsection.sourceFile ?? null,
      heading: where?.subsection.heading ?? null,
    };
  });
}

/** modules -> districts -> subsections with state and open-gap counts, plus rollups. */
export function moduleTree(curriculum, progress) {
  const roll = computeRollups(curriculum, progress);
  const gapCount = {};
  for (const g of openGaps(progress)) gapCount[g.subsectionId] = (gapCount[g.subsectionId] ?? 0) + 1;
  const index = subsectionIndex(curriculum);
  return curriculum.modules.map((m) => {
    const districts = m.regions.flatMap((r) => r.districts).map((d) => ({
      id: d.id,
      title: d.title,
      status: roll.districts[d.id].status,
      counts: roll.districts[d.id].counts,
      total: roll.districts[d.id].total,
      lit: roll.districts[d.id].status === 'consolidated',
      subsections: d.subsections.map((s) => ({
        id: s.id,
        title: s.title,
        state: roll.states[s.id] ?? 'locked',
        gaps: gapCount[s.id] ?? 0,
        needs: roll.states[s.id] === 'locked'
          ? s.prerequisites.filter((p) => roll.states[p] !== 'consolidated').map((p) => index.get(p)?.title ?? p)
          : [],
      })),
    }));
    const r = roll.modules[m.id];
    return { id: m.id, title: m.title, season: m.regions[0]?.season ?? 'spring', counts: r.counts, total: r.total, fraction: r.fraction, districts };
  });
}

/** Materials earned from clients (T12), in a fixed order with their labels. */
export function materialList(save) {
  const mats = save.inventory?.materials ?? {};
  return ['precedentScrolls', 'caseReports', 'statuteRolls', 'ink'].map((key) => ({ key, label: MATERIAL_LABEL[key], count: mats[key] ?? 0 }));
}

/** Everything the journal shows. */
export function buildJournal(curriculum, save) {
  const progress = save.progress;
  return {
    stats: statBars(progress),
    materials: materialList(save),
    clientsServed: save.clients?.served ?? 0,
    seeds: save.inventory?.seeds ?? 0,
    plants: (save.garden?.plots ?? []).length,
    tree: moduleTree(curriculum, progress),
    revisit: revisitList(curriculum, progress),
    sessions: recentSessions(save.sessions ?? []),
    districtCount: allDistricts(curriculum).length,
  };
}
