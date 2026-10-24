// Builders for offline-bank subsections (7-stage shape used by src/api/offlineTutor.js).
// Stage entry: { prompt, modelAnswer, hints:[h1,h2], cases:[{name,ratio,whyItMatters}], evaluation(answer) }
// All content is written by me; it is NOT copied from the vault. Where the vault is silent, the bank says so.

import { evaluateByConcepts, iracScore } from '../../logic/keywordEval.js';

const noop = () => ({ verdict: 'solid', feedback: '', conceptsHit: [], conceptsMissed: [] });
const blank = (prompt) => ({ prompt, modelAnswer: '', hints: ['', ''], cases: [], evaluation: noop });

export const caseInfo = (...cs) => cs.map((c) => ({ name: c.name, ratio: c.ratio, whyItMatters: c.whyItMatters }));

/** concept with an attached case so a miss quotes the ratio */
export const caseConcept = (c, label, extraRx = []) => ({ id: c.id, label, caseName: c.name, ratio: c.ratio, any: [...c.nameRx, ...extraRx] });

/** Stages 2 and 3: plain concept-overlap stage. */
export function conceptStage({ prompt, modelAnswer, hints, concepts, solidAt = 0.75, partialAt = 0.45, requiredIds = [], cases = [], followUp }) {
  return {
    prompt, modelAnswer, hints, cases,
    conceptLabels: concepts.map((c) => c.label),
    evaluation: (answer) => evaluateByConcepts(answer, { concepts, solidAt, partialAt, requiredIds, followUp }),
  };
}

/**
 * Stage 4: the player names one case (or authority) from `cases` and explains facts, rule, why it matters.
 * cases: [{ id, name, nameRx, factsRx, ruleRx, ratio, whyItMatters }]
 */
export function authorityStage({ prompt, modelAnswer, hints, cases, noCaseHelp }) {
  return {
    prompt, modelAnswer, hints, cases: caseInfo(...cases.slice(0, 4)),
      conceptLabels: ['name an authority', 'the key facts', 'the rule or ratio', 'why the case matters'],
    evaluation(answer) {
      const named = cases.filter((c) => c.nameRx.some((r) => new RegExp(r, 'i').test(answer)));
      if (!named.length) {
        return {
          verdict: 'missing',
          feedback: `I could not see a named authority in that answer. Authority means naming it, then facts, rule, and why it matters. ${noCaseHelp ?? `For example, ${cases[0].name}: ${cases[0].ratio}`}`,
          conceptsHit: [],
          conceptsMissed: ['name an authority', 'facts', 'rule', 'why it matters'],
          followUp: 'Choose one authority and write it as: facts, rule, why it matters.',
        };
      }
      const c = named[0];
      const short = c.name.split(' [')[0].split(' (')[0];
      const ev = evaluateByConcepts(answer, {
        concepts: [
          { id: 'name', label: `naming ${short}`, any: c.nameRx },
          { id: 'facts', label: 'the key facts', any: c.factsRx },
          { id: 'rule', label: 'the rule or ratio', any: c.ruleRx, caseName: c.name, ratio: c.ratio },
          { id: 'matters', label: 'why the case matters', any: ['matters', 'important', 'significan', 'shows', 'establish', 'authority for', 'illustrat', 'distinguish', 'because', 'so that', 'means that', 'limit', 'principle'] },
        ],
        solidAt: 0.75, partialAt: 0.5, requiredIds: ['rule'],
        followUp: (missed) => `You are part-way there on ${short}. Add: ${missed.map((m) => m.label).join(' and ')}.`,
      });
      ev.feedback += ` For the record, ${c.name}: ${c.whyItMatters}`;
      return ev;
    },
  };
}

/** Stage 5: IRAC application. spec.concepts are the legal points; IRAC structure is scored separately. */
export function applicationStage({
  prompt, modelAnswer, hints, concepts, requiredIds = [], cases = [], solidAt = 0.75, partialAt = 0.4, followUp,
  wrongRx = [], wrongNote, conclusionId = 'conc',
}) {
  return {
    prompt, modelAnswer, hints, cases,
    wrongRx,
    conceptLabels: concepts.map((c) => c.label),
    evaluation(answer) {
      const irac = iracScore(answer);
      const ev = evaluateByConcepts(answer, { concepts, solidAt, partialAt, requiredIds, followUp, wrongRx, wrongNote, conclusionId });
      ev.iracScore = irac;
      if (ev.verdict === 'solid' && irac < 2) {
        ev.verdict = 'partial';
        ev.feedback += ' The law is right, but make the structure visible: label your Issue, Rule, Application and Conclusion.';
        ev.followUp = 'Rewrite it with the four IRAC steps in order, one or two sentences each.';
      } else if (irac >= 3) {
        ev.feedback += ' Your structure is clear (IRAC).';
      }
      return ev;
    },
  };
}

/** Assemble the 7-stage entry. `mcqs` are the three checkpoint questions. */
export function buildSubsectionBank({ intro, s2, s3, s4, s5, mcqs, qa = [] }) {
  return {
    1: { ...blank(intro) },
    2: s2, 3: s3, 4: s4, 5: s5,
    6: { ...blank('Stage 6, checkpoint. Three quick multiple-choice questions.'), questions: mcqs },
    7: blank('Stage 7, verdict. The tutor summarises what landed, what did not, and gives the outcome.'),
    qa,
  };
}
