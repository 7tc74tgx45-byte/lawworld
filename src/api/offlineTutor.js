// Offline tutor: implements the encounter-engine tutor interface from the built-in bank.
// Evaluation is keyword + concept overlap (see src/logic/keywordEval.js). Clearly labelled offline.

import { OFFLINE_BANK, hasOfflineBank } from '../data/offlineBank.js';
import { CASES, SHORT } from '../data/offlineCases.js';
import { normalise } from '../logic/keywordEval.js';
import { getPersona } from '../data/tutors.js';

export const TUTORS = {
  hale: { id: 'hale', name: 'Professor Hale', colour: '#c9a227', style: 'Socratic' },
};

export class NoOfflineBankError extends Error {
  constructor(id) {
    super(`The offline question bank does not cover "${id}" yet. Connect Claude and Obsidian to play this building.`);
    this.name = 'NoOfflineBankError';
    this.subsectionId = id;
  }
}

function bankFor(subsection) {
  const b = hasOfflineBank(subsection.id) ? OFFLINE_BANK[subsection.id] : null;
  if (!b) throw new NoOfflineBankError(subsection.id);
  return b;
}

/** First open gap concepts, phrased for the intro. */
export function gapLine(priorGaps, memory = []) {
  const fromSessions = (memory ?? []).flatMap((m) => (typeof m === 'object' && m ? m.gaps ?? [] : []));
  const all = [...fromSessions, ...(priorGaps ?? []).filter((g) => !g.resolved).map((g) => g.concept)].filter(Boolean);
  const seen = new Set();
  const concepts = all.filter((c) => {
    const k = String(c).trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 2);
  if (!concepts.length) return '';
  return ` Last time ${concepts.join(' and ')} didn't fully land, so we will meet ${concepts.length > 1 ? 'them' : 'it'} again today.`;
}

/** Turn a bank stage-5 prompt into a client's file: drop the "Stage 5" label, keep the facts and the IRAC ask. */
export function clientFileText(stage5Prompt, clientName = 'The client') {
  const body = String(stage5Prompt ?? '').replace(/^Stage 5,?\s*application\.?\s*/i, '').replace(/^Client scenario:\s*/i, '').trim();
  return `${clientName} has come to the office with a problem. The file reads: ${body}`;
}

/**
 * The concepts an "I'm not sure" on this stage should log: the bank stage's own labels, never every keyConcept
 * of the building (QA finding). A stage with no labels falls back to one label naming the stage's skill.
 */
export function stageConcepts(st, stage, subsection) {
  if (st?.conceptLabels?.length) return st.conceptLabels.slice(0, 5);
  const skill = { 2: 'the idea in plain English', 3: 'the legal rule stated precisely', 4: 'authority (a case or statute)', 5: 'applying the rule to the facts' }[stage] ?? 'this stage';
  return [`${subsection?.title ?? 'this topic'}: ${skill}`];
}

/**
 * Extra (paid) hint for an open stage. It gives the NUMBER of points the stage looks for, never their names
 * (labels can contain a case name or the rule itself). A nudge, not the answer.
 */
export function extraStageNudge(st, n = 0) {
  const k = (st?.conceptLabels ?? []).filter(Boolean).length;
  if (n === 0 && k > 1) {
    return `This question looks for about ${k} separate points. Count the distinct points in your answer: if you have fewer, ask which part of the question you have not yet addressed.`;
  }
  return 'Write one sentence for each part the question asks for, then read it back and ask which part is thinnest.';
}

export function extraMcqNudge(n = 0) {
  return n === 0
    ? 'Rule out the option you are surest is wrong first, then test the remaining two against the exact wording of the question.'
    : 'Ask which option would still be true if the facts were slightly different: the right one rests on the rule, not on the facts.';
}

const NOTE_QA = [
  { rx: ['postal'], text: 'The postal rule (Adams v Lindsell) says acceptance by post is complete on posting, if post is a reasonable method. It is an exception to the general receipt rule, and it does not cover revocation (Byrne v Van Tienhoven) or instant communications (Entores).' },
  { rx: ['invitation', 'itt'], text: 'An invitation to treat invites others to make offers and does not bind the person inviting. Standard examples are shop displays (Fisher v Bell, Pharmaceutical Society v Boots), and a price given in reply to a request for information (Harvey v Facey). Adverts can still be offers if worded as a firm promise (Carlill).' },
  { rx: ['advert', 'carlill', 'smoke'], text: 'In Carlill the Court of Appeal treated the advert as a unilateral offer to the world at large, accepted by performing its conditions, with no need to notify the company. The £1,000 deposit helped show a serious intention to be bound.' },
  { rx: ['revo', 'withdraw'], text: 'An offer can generally be revoked before acceptance, but revocation must be communicated to the offeree (Byrne v Van Tienhoven). Revocation of a unilateral offer once performance has begun is a further issue that this offline bank does not cover.' },
  { rx: ['counter'], text: 'A counter-offer rejects and destroys the original offer (Hyde v Wrench). A mere request for information does not (Stevenson v McLean, not covered by this bank).' },
  { rx: ['auction', 's\\.? ?57', 'hammer'], text: 'Section 57 Sale of Goods Act 1979 deals with auction sales: the sale is complete when the auctioneer announces it by the fall of the hammer, and a bidder may retract until then.' },
  { rx: ['telex', 'telephone', 'instant', 'email'], text: 'For instantaneous communications the general rule applies: acceptance is effective when received (Entores v Miles Far East). Where exactly email fits is less settled, and not covered in this bank.' },
];

/** createOfflineTutor({ personaId? | persona? }): the bank is the same for every persona; name and colour follow the choice. */
export function createOfflineTutor(opts = {}) {
  const persona = opts.persona ?? (opts.personaId ? getPersona(opts.personaId) : TUTORS.hale);
  return {
    id: persona.id,
    name: persona.name,
    colour: persona.colour,
    offline: true,

    generate(stage, ctx) {
      const bank = bankFor(ctx.subsection);
      if (stage === 6) {
        const q = bank[6].questions[ctx.mcqIndex];
        return { text: `Question ${ctx.mcqIndex + 1} of ${bank[6].questions.length}: ${q.text}`, options: q.options };
      }
      return { text: bank[stage].prompt + (stage === 1 ? gapLine(ctx.priorGaps, ctx.memory) : ''), modelAnswer: bank[stage].modelAnswer }; // modelAnswer stays inside the engine (hint leak check)
    },

    /** Client NPC case (T12): the bank's stage-5 client scenario, framed as the client's file. */
    clientScenario(ctx) {
      const bank = bankFor(ctx.subsection);
      return { text: clientFileText(bank[5].prompt, ctx.clientName), modelAnswer: bank[5].modelAnswer };
    },

    evaluate(stage, prompt, answer, ctx) {
      const bank = bankFor(ctx.subsection);
      if (stage === 6) {
        const q = bank[6].questions[ctx.mcqIndex];
        const correct = answer === q.correct;
        return {
          verdict: correct ? 'solid' : 'missing',
          correct,
          feedback: correct ? `Correct. ${q.explanation}` : `Not quite. ${q.explanation}`,
          conceptsHit: correct ? [q.concept] : [],
          conceptsMissed: correct ? [] : [q.concept],
        };
      }
      return bank[stage].evaluation(String(answer));
    },

    hint(stage, prompt, index, ctx) {
      const bank = bankFor(ctx.subsection);
      if (stage === 6) {
        const q = bank[6].questions[ctx.mcqIndex];
        if (index >= q.hints.length) return extraMcqNudge(index - q.hints.length);
        return q.hints[index];
      }
      const st = bank[stage];
      // Bought hints (index beyond the bank's own) never repeat a free one: they point at the stage's own checklist.
      if (index >= st.hints.length) return extraStageNudge(st, index - st.hints.length);
      return st.hints[index];
    },

    notSure(stage, prompt, ctx) {
      const bank = bankFor(ctx.subsection);
      if (stage === 6) {
        const q = bank[6].questions[ctx.mcqIndex];
        return { explanation: q.explanation, concepts: [q.concept] };
      }
      const st = bank[stage];
      const names = (st.cases ?? []).map((c) => `${c.name}: ${c.ratio}`).join('\n');
      return {
        explanation: `${st.modelAnswer}${names ? '\n' + names : ''}`,
        concepts: stageConcepts(st, stage, ctx.subsection),
      };
    },

    answerQuestion(question, ctx) {
      const q = normalise(question);
      const id = ctx?.subsection?.id;
      const own = id && hasOfflineBank(id) ? OFFLINE_BANK[id].qa ?? [] : [];
      const ownHit = own.find((e) => e.rx.some((r) => new RegExp(r, 'i').test(q)));
      if (ownHit) return { text: ownHit.text, external: false };
      // The contract formation answers and case notes apply to the demo and to contract subsections only.
      const contractish = !id || id === 'contract-offer-acceptance' || id.startsWith('contract');
      if (contractish) {
        const hit = NOTE_QA.find((e) => e.rx.some((r) => new RegExp(r, 'i').test(q)));
        if (hit) return { text: hit.text, external: false };
        for (const [k, c] of Object.entries(CASES)) {
          if (c.nameRx.some((r) => new RegExp(r, 'i').test(q))) {
            return { text: `${c.name}. ${c.facts} Held: ${c.ratio}`, external: false, short: SHORT[k] };
          }
        }
      }
      return {
        text: 'The offline bank does not cover that, and I cannot search the web in offline mode. Note it down and ask again when you are online with the tutor connected.',
        external: false,
      };
    },
  };
}
