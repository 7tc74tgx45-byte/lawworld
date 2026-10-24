// Pure helpers for the curriculum: building districts from compact specs,
// flattening, lookup, cycle detection and a topological order.
// No Phaser, no DOM, no fetch.

export const TUTORS = ['hale', 'okafor', 'chen'];

/**
 * Compact subsection tuple:
 *   [slug, title, heading, concepts[], cases[], statutes[], opts?]
 * opts: { pre?: string[], tutor?: string, id?: string }
 *   pre   – prerequisite slugs (same district) or full ids (other districts).
 *           Omitted → previous subsection in the district (first one → district.after).
 *           [] → no prerequisites (parallel entry).
 */
export function makeDistrict(spec) {
  const { id, title, sourceFile, after = [], tutor = 'chen', source = 'vault', chapter = null } = spec;
  const subsections = [];
  const localSlugs = new Set(spec.subs.map((t) => t[0]));
  spec.subs.forEach((tuple, i) => {
    const [slug, subTitle, heading, keyConcepts = [], keyCases = [], statutes = [], opts = {}] = tuple;
    const subId = opts.id || `${id}.${slug}`;
    let prerequisites;
    if (opts.pre) {
      prerequisites = opts.pre.map((p) => (localSlugs.has(p) ? `${id}.${p}` : p));
    } else if (i === 0) {
      prerequisites = [...after];
    } else {
      prerequisites = [subsections[i - 1].id];
    }
    subsections.push({
      id: subId,
      title: subTitle,
      sourceFile,
      heading,
      keyConcepts,
      keyCases,
      statutes,
      prerequisites,
      suggestedTutor: opts.tutor || tutor,
    });
  });
  return { id, title, chapter, sourceFile, source, subsections };
}

export function allDistricts(curriculum) {
  return curriculum.modules.flatMap((m) => m.regions.flatMap((r) => r.districts));
}

export function flattenSubsections(curriculum) {
  return allDistricts(curriculum).flatMap((d) => d.subsections);
}

export function subsectionIndex(curriculum) {
  return new Map(flattenSubsections(curriculum).map((s) => [s.id, s]));
}

export function findSubsection(curriculum, id) {
  return subsectionIndex(curriculum).get(id) || null;
}

/** Returns an id path forming a cycle, or null. */
export function findCycle(subsections) {
  const byId = new Map(subsections.map((s) => [s.id, s]));
  const state = new Map(); // 1 visiting, 2 done
  const stack = [];
  function visit(id) {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 1);
    stack.push(id);
    for (const p of byId.get(id)?.prerequisites || []) {
      if (!byId.has(p)) continue;
      const c = visit(p);
      if (c) return c;
    }
    stack.pop();
    state.set(id, 2);
    return null;
  }
  for (const s of subsections) {
    const c = visit(s.id);
    if (c) return c;
  }
  return null;
}

/** Prerequisites-first ordering; throws on a cycle. */
export function topologicalOrder(subsections) {
  const cycle = findCycle(subsections);
  if (cycle) throw new Error(`Curriculum cycle: ${cycle.join(' -> ')}`);
  const byId = new Map(subsections.map((s) => [s.id, s]));
  const seen = new Set();
  const out = [];
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const p of byId.get(id).prerequisites) visit(p);
    out.push(id);
  };
  subsections.forEach((s) => visit(s.id));
  return out;
}
