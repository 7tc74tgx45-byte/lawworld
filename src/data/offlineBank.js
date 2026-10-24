// Offline question bank for the demo subsection (contract-offer-acceptance).
// Written by me from standard England & Wales contract law; it is NOT the vault text.
// Stage entry: { prompt, modelAnswer, hints:[h1,h2], cases:[{name,ratio,whyItMatters}], evaluation(answer) }
// The engine never sees modelAnswer; only the offline tutor uses it (for "I'm not sure" teaching).

import { CASES } from './offlineCases.js';
import { evaluateByConcepts, iracScore } from '../logic/keywordEval.js';
import { MCQ_QUESTIONS } from './offlineMcq.js';
import { contractIntroBank } from './bank/contractIntro.js';
import { contractAgreementBank } from './bank/contractAgreement.js';
import { tortBank } from './bank/tortAssault.js';

const caseInfo = (...keys) => keys.map((k) => ({ name: CASES[k].name, ratio: CASES[k].ratio, whyItMatters: CASES[k].whyItMatters }));
const caseConcept = (key, label, extraRx = []) => ({
  id: key,
  label,
  caseName: CASES[key].name,
  ratio: CASES[key].ratio,
  any: [...CASES[key].nameRx, ...extraRx],
});

const stage1 = {
  prompt:
    'Welcome. Almost every contract dispute starts with one question: was there ever an agreement at all? Offer and acceptance is how the law answers it, and it sits underneath consideration, terms and everything else in contract. Over the next few steps you will explain it plainly, state the rules precisely, back them with cases, then use them on a client problem. Ready? Press Continue.',
  modelAnswer: '',
  hints: ['', ''],
  cases: [],
  evaluation: () => ({ verdict: 'solid', feedback: '', conceptsHit: [], conceptsMissed: [] }),
};

const stage2 = {
  prompt:
    'Stage 2, plain English. Imagine a friend has never studied law. In your own words, explain how two people end up with a legally binding agreement. Cover what an offer is, what acceptance is, and why a shop price tag is not quite what it seems.',
  modelAnswer:
    'An offer is a clear statement that one party is willing to be bound on specific terms if the other agrees. Acceptance is an unqualified agreement to those terms, communicated to the offeror. A contract needs both. Many things look like offers but are only invitations to treat (inviting others to make offers), such as goods on a shelf.',
  hints: [
    'Start with who does what: one person puts forward terms, and the other has to respond. What does the response need to be like for it to count?',
    'Think about walking round a shop. At what moment are you both legally stuck with the deal? Is it when you pick the item up?',
  ],
  cases: [],
  evaluation(answer) {
    return evaluateByConcepts(answer, {
      concepts: [
        { id: 'offer', label: 'an offer is a willingness to be bound on certain terms', any: ['offer', 'proposal', 'willing(ness)? to (be bound|sell|buy|contract)', 'put(s)? forward'] },
        { id: 'accept', label: 'acceptance is agreeing to those terms without changing them', any: ['accept', 'agree(s|ment)? (to|with) (the )?(terms|offer)', 'say(s)? yes', 'unqualified', 'exactly'] },
        { id: 'itt', label: 'an invitation to treat only invites offers, it does not bind', any: ['invitation to treat', 'invit(e|es|ing) (offers|people|customers)', 'not (really )?an offer', 'not bound', 'not binding', 'display'] },
        { id: 'bound', label: 'a contract exists once both are matched; the parties are bound', any: ['bound', 'binding', 'contract (is |has )?(formed|made|exists)', 'legally'] },
      ],
      solidAt: 0.75,
      partialAt: 0.5,
      requiredIds: ['offer', 'accept'],
    });
  },
};

const stage3 = {
  prompt:
    'Stage 3, precision. State the legal rules properly. (1) What distinguishes an offer from an invitation to treat? (2) What must acceptance be, and what is the effect of a counter-offer? (3) State the general rule on communication of acceptance and the postal rule exception. (4) When can an offer be revoked, and when does revocation take effect? Statute: where does s.57 Sale of Goods Act 1979 fit?',
  modelAnswer:
    'An offer shows objective intention to be bound on acceptance; an invitation to treat only invites offers. Acceptance must be unqualified and match the offer; a counter-offer rejects and destroys the original (Hyde v Wrench). Acceptance must generally be communicated to the offeror and is effective on receipt for instantaneous methods (Entores). The postal rule is the exception: where post is a reasonable method, acceptance is complete on posting (Adams v Lindsell). An offer may be revoked any time before acceptance, but revocation must be communicated to the offeree (Byrne v Van Tienhoven). Section 57 of the Sale of Goods Act 1979 deals with auction sales: the sale is complete when the auctioneer announces it by the fall of the hammer, and a bidder may retract a bid until then.',
  hints: [
    'Break your answer into the four numbered parts. For the postal rule, ask: is it a general rule, or an exception to one?',
    'On revocation, there are two questions: until when, and effective when? Think about whether posting a revocation is enough.',
  ],
  cases: caseInfo('hyde', 'adams', 'byrne', 'entores'),
  evaluation(answer) {
    return evaluateByConcepts(answer, {
      concepts: [
        { id: 'objective', label: 'offer shows intention to be bound on acceptance, tested objectively', any: ['intention to be bound', 'objective', 'reasonable person', 'willing(ness)? to be bound', 'definite|certain terms|specific terms'] },
        { id: 'itt', label: 'invitation to treat only invites offers', any: ['invitation to treat', 'invit(es|ation|ing) (for )?offers'] },
        { id: 'unqual', label: 'acceptance must be unqualified and mirror the offer', any: ['unqualified', 'unconditional', 'mirror', 'match(es)? (the )?offer', 'exactly', 'without (change|qualification)'] },
        { id: 'hyde', label: 'a counter-offer destroys the original offer', any: ['counter[- ]?offer', 'hyde'], caseName: CASES.hyde.name, ratio: CASES.hyde.ratio },
        { id: 'comm', label: 'acceptance generally must be communicated to the offeror', any: ['communicat', 'brought to the (notice|attention)', 'received', 'receipt', 'entores'], caseName: CASES.entores.name, ratio: CASES.entores.ratio },
        { id: 'postal', label: 'postal rule: acceptance is complete on posting', any: ['postal rule', 'post(ed|ing)', 'adams', 'lindsell'], caseName: CASES.adams.name, ratio: CASES.adams.ratio },
        { id: 'revoke', label: 'revocation is possible until acceptance, but must be communicated', any: ['revo(ke|cation|cable)', 'withdraw', 'byrne', 'tienhoven'], caseName: CASES.byrne.name, ratio: CASES.byrne.ratio },
        { id: 's57', label: 'SGA 1979 s.57 covers auctions: the hammer falls to complete the sale', any: ['s\\.? ?57', 'section 57', 'hammer', 'auction'] },
      ],
      solidAt: 0.7,
      partialAt: 0.4,
      requiredIds: ['postal', 'revoke'],
      followUp: (missed) => `Look again at "${missed[0].label}". Say it as a rule, in one precise sentence, and name the case that stands behind it if you can.`,
    });
  },
};

const stage4 = {
  prompt:
    'Stage 4, authority. Pick one case from this topic and explain it as facts, then rule, then why it matters. Choose from Carlill, Pharmaceutical Society v Boots, Fisher v Bell, Harvey v Facey, Hyde v Wrench, Adams v Lindsell, Byrne v Van Tienhoven or Entores. Carlill is a good one if you are unsure.',
  modelAnswer:
    'Carlill v Carbolic Smoke Ball Co [1893]: the company advertised £100 to anyone who caught flu after using the ball as directed, and said money was deposited at a bank. The Court of Appeal held the advert was a unilateral offer to the world at large, accepted by performance without notifying the company; the deposit showed intention to be bound, so it was not a puff. It matters because it distinguishes an advert that is an offer from a mere invitation to treat, and shows acceptance by conduct.',
  hints: [
    'Pick one case and use three labelled parts: what happened, what the court decided in law, and what the case is used for.',
    'Think about what sort of statement the case was about: an advert, a price in a window, a letter, a telex? That fact usually points to the rule.',
  ],
  cases: caseInfo('carlill', 'boots', 'fisher', 'harvey'),
  evaluation(answer) {
    const entries = Object.entries(CASES);
    const named = entries.filter(([, c]) => c.nameRx.some((r) => new RegExp(r, 'i').test(answer)));
    if (!named.length) {
      return {
        verdict: 'missing',
        feedback: 'I could not see a named case in that answer. Authority means naming the case; then facts, rule, and why it matters. Example: ' + CASES.carlill.name + ': ' + CASES.carlill.ratio,
        conceptsHit: [],
        conceptsMissed: ['name a case', 'facts', 'rule', 'why it matters'],
        followUp: 'Choose one case and write it as: facts, rule, why it matters.',
      };
    }
    // Score against the case the player named most clearly.
    const [key, c] = named[0];
    const spec = {
      concepts: [
        { id: 'name', label: `naming ${c.name.split(' [')[0].split(' (')[0]}`, any: c.nameRx },
        { id: 'facts', label: 'the key facts', any: c.factsRx },
        { id: 'rule', label: 'the rule or ratio', any: c.ruleRx, caseName: c.name, ratio: c.ratio },
        { id: 'matters', label: 'why the case matters', any: ['matters', 'important', 'significan', 'shows', 'establish', 'authority for', 'illustrat', 'distinguish', 'because', 'so that', 'means that', 'exception', 'limit'] },
      ],
      solidAt: 0.75,
      partialAt: 0.5,
      requiredIds: ['rule'],
      followUp: (missed) => `You are part-way there on ${c.name.split(' [')[0]}. Add: ${missed.map((m) => m.label).join(' and ')}.`,
    };
    const ev = evaluateByConcepts(answer, spec);
    ev.feedback += ` For the record, ${c.name}: ${c.whyItMatters}`;
    return ev;
  },
};

// Wrong conclusions for stage 5, written positively; a "not", "argue", "might" etc. just before one means it is not asserted.
const STAGE5_WRONG = [
  'contract (was |is |has been |has )?(formed|made|concluded|complete) (when|as soon as|the moment|once|at the point) (alice|she|the customer)? ?(picked|pick|took|take|grabbed|lifted|put)',
  '(contract|sale|deal) (is|was|has been|had been) (already )?(formed|made|concluded|complete|binding) (on|at) the shelf',
  'the (shop|supermarket|store|bob) (is|was|are) (legally |contractually )?(bound|obliged|required) to sell',
  'alice (is|was) (legally )?entitled to (buy|pay|the|have)',
  'bob (cannot|can\'t|can not|must not) (refuse|withdraw|change)',
  '(display|shelf|goods on (the )?shelf) (is|was|are) (an|the) offer',
  'alice (accepted|has accepted) (the offer )?(by|when|as soon as)',
];

const stage5 = {
  prompt:
    'Stage 5, application. Client scenario: a supermarket displays tins of beans on the shelf, each marked 50p. Alice picks one up. Bob, the manager, sees her and says "sorry, that is mispriced, they are £2." Alice says she is entitled to buy at 50p. Has a contract formed? Advise in IRAC: Issue, Rule, Application, Conclusion.',
  modelAnswer:
    'Issue: whether the supermarket was bound to sell at 50p, which depends on whether the shelf display was an offer Alice accepted by picking up the tin. Rule: goods on display with a price are an invitation to treat, not an offer (Fisher v Bell [1961]); in a self-service shop the customer makes the offer when presenting the goods at the till, and the sale is complete on the cashier accepting (Pharmaceutical Society v Boots [1953]). Application: Alice picking up the tin is not acceptance; the shelf is only an invitation to treat. Alice\'s offer is made at the till, and Bob can refuse it before the cashier accepts, so he can correct the mistaken price. Conclusion: no contract has yet been formed, so the shop need not sell at 50p; Alice has no claim, though a deliberate false price might raise other (consumer) issues that the vault does not cover here.',
  hints: [
    'Start with the Issue: what exactly must you decide? Ask who the offeror is when you pick a tin up in a self-service shop.',
    'For the Rule, which two cases deal with display of goods? Then ask: at what point in the shop does the customer make the offer and the shop accept?',
  ],
  cases: caseInfo('fisher', 'boots'),
  wrongRx: STAGE5_WRONG,
  evaluation(answer) {
    const irac = iracScore(answer);
    const ev = evaluateByConcepts(answer, {
      concepts: [
        { id: 'itt', label: 'the shelf display is an invitation to treat, not an offer', any: ['invitation to treat'] },
        caseConcept('fisher', 'Fisher v Bell (display is an invitation to treat)'),
        caseConcept('boots', 'Pharmaceutical Society v Boots (self-service: customer offers at the till)'),
        { id: 'till', label: 'the offer is Alice taking the goods to the till, and acceptance is the cashier\'s', any: ['(till|cash ?desk|checkout|cashier)'] },
        { id: 'refuse', label: 'Bob can refuse, so no contract has formed at 50p', any: ['no contract', 'not (yet )?(been )?(formed|bound|concluded)', 'can (still )?(refuse|decline|correct)', 'not obliged', 'not bound', 'free to (refuse|decline)', 'no (binding )?contract'] },
      ],
      solidAt: 0.8,
      partialAt: 0.4,
      requiredIds: ['itt', 'till'],
      conclusionId: 'refuse',
      wrongRx: STAGE5_WRONG,
      wrongNote: 'On the shelf there is only an invitation to treat, so Alice picking up a tin cannot be an acceptance; in a self-service shop her offer is made at the till (Pharmaceutical Society v Boots).',
      followUp: (missed) => `Think about the till. In a self-service shop, who makes the offer and who accepts, and where? Your answer is missing: ${missed.map((m) => m.label).join('; ')}.`,
    });
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

const stage6 = {
  prompt: 'Stage 6, checkpoint. Three quick multiple-choice questions.',
  modelAnswer: '',
  hints: ['', ''],
  cases: [],
  questions: MCQ_QUESTIONS,
  evaluation: () => ({ verdict: 'solid', feedback: '', conceptsHit: [], conceptsMissed: [] }),
};

const stage7 = {
  prompt: 'Stage 7, verdict. The tutor summarises what landed, what did not, and gives the outcome.',
  modelAnswer: '',
  hints: ['', ''],
  cases: [],
  evaluation: () => ({ verdict: 'solid', feedback: '', conceptsHit: [], conceptsMissed: [] }),
};

// The hand-written demo stages carry their own concept labels, so "I'm not sure" logs this stage's ideas only.
stage2.conceptLabels = ['what an offer is', 'what acceptance is', 'invitation to treat', 'when the parties are bound'];
stage3.conceptLabels = ['offer v invitation to treat', 'acceptance and counter-offer (Hyde v Wrench)', 'communication of acceptance', 'the postal rule (Adams v Lindsell)', 'revocation (Byrne v Van Tienhoven)', 'auctions (SGA 1979 s.57)'];
stage4.conceptLabels = ['name an authority', 'the key facts', 'the rule or ratio', 'why the case matters'];
stage5.conceptLabels = ['shelf display is an invitation to treat', 'Fisher v Bell', 'Pharmaceutical Society v Boots', 'the offer is made at the till', 'no contract at 50p'];

export const OFFLINE_BANK = {
  'contract-offer-acceptance': { 1: stage1, 2: stage2, 3: stage3, 4: stage4, 5: stage5, 6: stage6, 7: stage7 },
  // Curriculum subsections (T06): first three Contract subsections and the first Tort subsection.
  'contract-intro.what-is-contract': contractIntroBank,
  ...contractAgreementBank,
  ...tortBank,
};

export const hasOfflineBank = (id) => Object.prototype.hasOwnProperty.call(OFFLINE_BANK, id);
