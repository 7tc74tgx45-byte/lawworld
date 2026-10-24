// Offline bank: contract-intro.what-is-contract (note: LAW7054-Poole-Ch1-Introduction-to-Contract.md, "Key points").
// Written by me, grounded in that note's headings and ideas; not note prose.
// The note names no case. Stage 4 therefore uses well-known authorities for each requirement, flagged as "not named in this note".

import { CASES } from '../offlineCases.js';
import { buildSubsectionBank, conceptStage, authorityStage, applicationStage } from './helpers.js';

const carlill = { id: 'carlill', ...CASES.carlill };
const balfour = {
  id: 'balfour',
  name: 'Balfour v Balfour [1919] 2 KB 571 (CA)',
  nameRx: ['balfour'],
  factsRx: ['£ ?30', 'husband', 'wife', 'ceylon', 'abroad', 'allowance', 'maintenance'],
  ruleRx: ['intention to create legal relations', 'domestic', 'social', 'not (intend|legally)', 'no (intention|contract)', 'presumption'],
  ratio: 'A domestic arrangement between husband and wife, here a promise of monthly allowance while he worked abroad, was not intended to create legal relations, so it was not an enforceable contract.',
  whyItMatters: 'It is the classic example of the intention requirement, and of the presumption against legal intention in family arrangements.',
};
const currie = {
  id: 'currie',
  name: 'Currie v Misa (1875) LR 10 Ex 153',
  nameRx: ['currie', 'misa'],
  factsRx: ['cheque', 'bill of exchange', 'bank', 'banker'],
  ruleRx: ['right, interest, profit or benefit', 'benefit', 'detriment', 'forbearance', 'loss', 'responsibility'],
  ratio: 'Consideration is some right, interest, profit or benefit accruing to one party, or some forbearance, detriment, loss or responsibility given, suffered or undertaken by the other.',
  whyItMatters: 'It is the standard definition of consideration, the first of the three enforceability requirements.',
};

export const contractIntroBank = buildSubsectionBank({
  intro:
    'Welcome to the start of the Contract region. Before offers and acceptances, you need the map: what the law means by a contract, what makes a promise enforceable, and how contract differs from tort. Everything else in this module hangs off those ideas. Press Continue.',
  s2: conceptStage({
    prompt: 'Stage 2, plain English. A friend says "a promise is a promise, so surely I can sue if someone breaks one?" In your own words, explain what a contract is in law, and why not every promise is enforceable.',
    modelAnswer: 'A contract is an agreement the law will enforce, used for planned exchanges. Not every promise counts: the law asks for something in return (consideration), an intention to create legal consequences, and sometimes a particular form such as writing. A casual social promise usually fails.',
    hints: [
      'Start from the word "enforceable": what extra ingredients does the law ask for beyond two people agreeing?',
      'Think of a promise to meet a friend for coffee and a promise to deliver goods for money. What is different about them?',
    ],
    concepts: [
      { id: 'enf', label: 'a contract is a legally enforceable agreement', any: ['enforceab', 'legally binding', 'law (will )?enforce', 'court(s)? (will )?enforce'] },
      { id: 'cons', label: 'something must be given in return (consideration)', any: ['consideration', 'in return', 'exchange', 'something back', 'give or promise'] },
      { id: 'int', label: 'the parties must intend legal consequences', any: ['intention', 'intend', 'legal relations', 'legal consequences', 'social (arrangement|promise)'] },
      { id: 'form', label: 'some contracts need a particular form, such as writing', any: ['form', 'writing', 'in writing', 'written', 'deed'] },
    ],
    requiredIds: ['cons', 'int'],
  }),
  s3: conceptStage({
    prompt: 'Stage 3, precision. (1) State the three requirements for an enforceable contract. (2) Distinguish contract from tort, and say what the note\'s courier example shows. (3) State the position of English law on a general duty of good faith, and how the gap is filled.',
    modelAnswer: 'The three requirements are consideration, intention to create legal relations, and (for some contracts) form. Contract obligations are voluntary, chosen by the parties; tort obligations are imposed by law whether or not the parties agreed. The same facts can give rise to both, for example a courier who loses a parcel may be in breach of contract and negligent. English law resists a general duty of good faith and instead uses piecemeal tools such as unfair terms controls, duress and estoppel.',
    hints: [
      'Number your answer 1 to 3. For part 2, ask: who chose the obligation, the parties or the law?',
      'For good faith, think about whether English law has one general rule or many separate doctrines.',
    ],
    concepts: [
      { id: 'cons', label: 'consideration is a requirement', any: ['consideration'] },
      { id: 'int', label: 'intention to create legal relations is a requirement', any: ['intention', 'legal relations'] },
      { id: 'form', label: 'form (writing) is needed for some contracts only', any: ['form', 'writing', 'written'] },
      { id: 'vol', label: 'contract obligations are voluntary', any: ['voluntar', 'chose', 'choose', 'agreed to', 'agree to'] },
      { id: 'imposed', label: 'tort obligations are imposed by law', any: ['imposed', 'by law', 'regardless', 'whether or not'] },
      { id: 'both', label: 'the same facts can give rise to both (courier or parcel)', any: ['both', 'courier', 'parcel', 'same facts', 'overlap', 'concurrent'] },
      { id: 'faith', label: 'no general duty of good faith in English law', any: ['good faith'] },
      { id: 'piece', label: 'filled piecemeal (unfair terms, duress, estoppel)', any: ['piecemeal', 'duress', 'estoppel', 'unfair terms', 'case by case', 'specific doctrines'] },
    ],
    solidAt: 0.75, partialAt: 0.4, requiredIds: ['cons', 'int', 'imposed'],
    followUp: (missed) => `Look again at "${missed[0].label}". Put it in one precise sentence.`,
  }),
  s4: authorityStage({
    prompt: 'Stage 4, authority. Your note for this section names no cases, so use one you will meet later in the module. Choose one: Carlill v Carbolic Smoke Ball (intention, and an advert as an offer), Balfour v Balfour (intention in a domestic arrangement), or Currie v Misa (the definition of consideration). Explain it as facts, rule, why it matters.',
    modelAnswer: 'Balfour v Balfour [1919]: a husband promised his wife a monthly sum while he worked abroad, and later stopped paying. The Court of Appeal held there was no contract: such domestic arrangements are not intended to create legal relations. It matters as the standard illustration of the intention requirement and the presumption against legal intention in family arrangements.',
    hints: [
      'Pick one case and write three labelled parts: what happened, what the court decided in law, and why it is used.',
      'Which of the three requirements does your chosen case illustrate? Say which, and why it was the deciding issue.',
    ],
    cases: [balfour, carlill, currie],
    noCaseHelp: `The note names none, so any of Carlill, Balfour v Balfour or Currie v Misa will do. For example, ${balfour.name}: ${balfour.ratio}`,
  }),
  s5: applicationStage({
    prompt: 'Stage 5, application. Client scenario: Maya\'s sister Dee promised, over dinner, to pay Maya £500 a month towards childcare while Dee was working abroad. Dee has stopped paying. Maya wants to sue. Separately, Maya\'s courier lost a parcel of Maya\'s craft supplies. Advise Maya in IRAC on whether the sister\'s promise is an enforceable contract, and say in one sentence how the parcel loss could be both contract and tort.',
    modelAnswer: 'Issue: whether Dee\'s promise is a contract. Rule: an enforceable contract needs consideration, intention to create legal relations and, sometimes, form; domestic arrangements are presumed not to be intended to be legally binding (Balfour v Balfour). Application: a family promise at dinner points to a social arrangement; unless Maya relied on it in a way both treated as binding, or there are facts showing legal intention, the presumption is likely to stand. Conclusion: probably no contract, so Maya is unlikely to succeed. The courier: breach of the delivery contract and possibly negligence, because the same facts can trigger both.',
    hints: [
      'Begin with the Issue: which of the three requirements is under pressure on these facts?',
      'For the Rule, which requirement are family arrangements usually judged on, and what is the starting presumption?',
    ],
    concepts: [
      { id: 'req', label: 'the requirements for enforceability (consideration, intention, form)', any: ['consideration', 'intention to create', 'legal relations'] },
      { id: 'dom', label: 'domestic or family promises are presumed not legally intended', any: ['domestic', 'family', 'social', 'sister', 'presumption'] },
      caseHit(balfour, 'Balfour v Balfour (domestic arrangement, no legal intention)'),
      { id: 'conc', label: 'likely conclusion: no enforceable contract', any: ['no (enforceable |binding )?contract', 'not (an )?(enforceable|binding)', 'unlikely to (succeed|win)', 'not legally binding', 'fail'] },
      { id: 'courier', label: 'the courier loss can be both contract and tort', any: ['courier', 'parcel', 'both (contract|breach)', 'negligen'] },
    ],
    requiredIds: ['dom', 'conc'],
    followUp: (missed) => `Re-read the facts: a promise made between sisters at dinner. Your answer is missing: ${missed.map((m) => m.label).join('; ')}.`,
  }),
  mcqs: [
    {
      text: 'Which is NOT one of the three requirements for an enforceable contract listed in this section?',
      options: ['Consideration', 'Intention to create legal relations', 'A signature from both parties in every case'],
      correct: 2,
      concept: 'requirements for enforceability',
      explanation: 'The requirements are consideration, intention to create legal relations and, for some contracts only, form such as writing. A signature is not needed for every contract.',
      hints: ['Which requirement applies only to some contracts?', 'Think about a bus ticket or a shop purchase: does anyone sign?'],
    },
    {
      text: 'A courier loses Priya\'s parcel through carelessness. Which statement is right?',
      options: ['Only contract applies, because there was an agreement.', 'Priya may have claims in both contract and tort on the same facts.', 'Only tort applies, because the loss was careless.'],
      correct: 1,
      concept: 'same facts can be contract and tort',
      explanation: 'The same facts can breach a contractual promise and a tort duty of care. Contract obligations are voluntary, tort obligations are imposed by law.',
      hints: ['Does having a contract remove the duty the law imposes anyway?', 'Which of the two kinds of obligation comes from the parties\' choice?'],
    },
    {
      text: 'What is the position of English law on a general duty of good faith in contract?',
      options: ['A general duty of good faith applies to all contracts.', 'There is no general duty; the law uses piecemeal tools such as unfair terms controls, duress and estoppel.', 'Good faith applies only to consumer contracts.'],
      correct: 1,
      concept: 'no general duty of good faith',
      explanation: 'English law resists a general good faith duty, unlike many other systems, and addresses unfairness through specific doctrines instead.',
      hints: ['Is the answer one rule or several separate doctrines?', 'Name one doctrine that deals with unfairness in a particular situation.'],
    },
  ],
  qa: [
    { rx: ['good faith'], text: 'English law has no general duty of good faith in contract; the note says it deals with unfairness piecemeal (unfair terms, duress, estoppel). The note does not go further than that.' },
    { rx: ['contract.{0,20}tort|tort.{0,20}contract'], text: 'Contract obligations are voluntary, chosen by the parties; tort obligations are imposed by law. Same facts can trigger both, as with a courier who loses a parcel (breach of contract and negligence).' },
    { rx: ['consideration'], text: 'Consideration means each party gives or promises something in return. This note only lists it as one of three requirements; Chapter 3 (Consideration) in your vault covers it in detail.' },
  ],
});

function caseHit(c, label) {
  return { id: c.id, label, caseName: c.name, ratio: c.ratio, any: c.nameRx };
}
