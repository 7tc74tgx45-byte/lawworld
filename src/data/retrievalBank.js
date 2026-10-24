// Offline garden retrieval bank (T22): for each banked subsection, three questions of different KINDS
// (rule, case, apply-to-facts). Written by me from standard England & Wales law and the extracted headings,
// not copied from the vault. Each item: { kind, about: regex source matching the planted concept, q, model,
// concepts: [{ id, label, any: [regex] }], solidAt?, requiredIds?, wrongRx?, wrongNote? }.
// `model` is shown only after a non-solid answer, to teach the point (the plant gives no second attempt).

import { moreRetrievalItems } from './retrievalBankMore.js';

const C = (id, label, ...any) => ({ id, label, any });

export const introItems = [
  {
    kind: 'rule', about: 'contract|enforce|consideration|intention|form',
    q: 'From memory: what are the requirements before a promise becomes an enforceable contract, and which of them is needed only for some contracts?',
    model: 'Consideration (something given in return), intention to create legal relations, and, for some contracts only, a particular form such as writing or a deed.',
    concepts: [C('cons', 'consideration (something in return)', 'consideration', 'in return'), C('int', 'intention to create legal relations', 'intention', 'legal relations', 'intend'), C('form', 'form, needed only for some contracts', 'form', 'writing', 'deed', 'written')],
    solidAt: 0.99, requiredIds: ['cons', 'int'],
  },
  {
    kind: 'case', about: 'intention|domestic|enforce|contract',
    q: 'Which case do you associate with a family promise that was not a contract? Give the facts, what the court decided, and why it matters.',
    model: 'Balfour v Balfour [1919] 2 KB 571: a husband promised his wife a monthly allowance while he worked abroad; the Court of Appeal held no contract, because domestic arrangements are presumed not to be intended to create legal relations.',
    concepts: [C('name', 'naming Balfour v Balfour', 'balfour'), C('facts', 'the facts (husband, wife, allowance while abroad)', 'husband', 'wife', 'allowance', 'abroad', 'ceylon'), C('rule', 'the rule: no intention to create legal relations in a domestic arrangement', 'legal relations', 'domestic', 'presumption', 'not (intend|legally|binding)')],
    solidAt: 0.99, requiredIds: ['name', 'rule'],
  },
  {
    kind: 'apply', about: 'intention|domestic|enforce|contract',
    q: 'Facts: at a family barbecue Sam promises his brother Theo £200 towards a holiday. Sam later changes his mind and Theo wants to sue. In a few sentences, is there an enforceable contract, and why?',
    model: 'Probably not. Between family members there is a presumption that no legal relations were intended (Balfour v Balfour), so a casual promise at a barbecue is unlikely to be a contract, unless facts show the parties meant to be bound.',
    concepts: [C('rule', 'the rule: intention to create legal relations is required', 'legal relations', 'intention', 'intend'), C('dom', 'family or social promises are presumed not legally intended', 'family', 'domestic', 'social', 'brother', 'presumption', 'barbecue'), C('conc', 'conclusion: probably no enforceable contract', 'no (enforceable |binding |legal )?(contract|claim)', 'not (an )?(enforceable|binding)', 'unlikely', 'cannot sue', 'fail')],
    solidAt: 0.99, requiredIds: ['dom', 'conc'],
    wrongRx: ['(sam|the promise|it) (is|was|will be) (an? )?(legally |contractually )?(binding|enforceable|bound)', 'theo (will|can|should|is likely to) (win|succeed|recover)', 'there (is|was) (a|an) (valid |binding |enforceable )?contract'],
    wrongNote: 'Family and social promises start with a presumption against legal intention (Balfour v Balfour).',
  },
];

export const objectiveItems = [
  {
    kind: 'rule', about: 'objective|observer|reasonable',
    q: 'From memory: how does English law decide whether two parties agreed, and what is the limit on that test where one side has made a mistake?',
    model: 'Agreement is judged objectively: what a reasonable person would conclude from the parties\' words and conduct, not their private intentions. The limit: a party who knows or ought to know the other is mistaken about the terms cannot snap up the mistake.',
    concepts: [C('obj', 'judged objectively by a reasonable person', 'objective', 'reasonable (person|man|observer)', 'outward'), C('wc', 'by words and conduct, not private intentions', 'words and conduct', 'said and did', 'not (their |the )?(subjective|private|secret)', 'subjective'), C('know', 'a party who knows or ought to know of the mistake cannot snap it up', 'knew', 'knows', 'ought to', 'snap up')],
    solidAt: 0.99, requiredIds: ['obj', 'know'],
  },
  {
    kind: 'case', about: 'objective|observer|reasonable',
    q: 'Pick Smith v Hughes, Storer v Manchester City Council or RTS v Müller. Give the facts, the rule, and why it matters.',
    model: 'Smith v Hughes (1871): the buyer of oats believed he was buying old oats while the seller sold them as oats; the court looked at what was communicated, and a party who knows the other is mistaken as to the terms cannot hold him to the contract. It shows the objective test and its limit.',
    concepts: [C('name', 'naming the case', 'smith', 'hughes', 'storer', 'rts', 'm[uü]ller'), C('facts', 'the key facts', 'oats', 'sample', 'council', 'house', 'tenant', 'letter of intent', 'engineering', 'work began'), C('rule', 'the rule: objective approach / what was communicated / knowledge of mistake', 'objective', 'communicated', 'outward', 'knew', 'knows', 'snap up', 'reasonable')],
    solidAt: 0.99, requiredIds: ['name', 'rule'],
  },
  {
    kind: 'apply', about: 'objective|observer|reasonable|mistake',
    q: 'Facts: a website lists a £250 watch at £2.50 by a typing error. A buyer who has posted online about hunting for pricing errors orders it and gets an automated acknowledgement. Is the seller bound? Answer briefly in Issue, Rule, Application, Conclusion order.',
    model: 'Probably not. Agreement is objective, so the listing looks like an offer, but a buyer who knows or ought to know of the seller\'s mistake cannot snap it up (Smith v Hughes); a price a hundred times too low and a bargain-hunting buyer point to that knowledge.',
    concepts: [C('obj', 'the general rule: agreement is objective', 'objective', 'reasonable (person|man|observer)', 'words and conduct'), C('know', 'the exception: knew or ought to know of the mistake, so cannot snap it up', 'knew', 'knows', 'ought to', 'snap up'), C('facts', 'applied to these facts: far too low, buyer hunting for errors', 'hunt', 'too low', 'hundred', 'error', 'mistake', 'obvious'), C('conc', 'conclusion: seller probably not bound', 'not bound', 'no contract', 'can (avoid|refuse|resist)', 'unlikely to be bound', 'probably not')],
    solidAt: 0.74, requiredIds: ['know', 'conc'],
    wrongRx: ['(the )?seller (is|was|will be) (legally |contractually )?(bound|liable|obliged)', '(the )?(buyer|customer) (can|may|will|is entitled to) (hold|enforce|insist)', 'a contract (was |has been |is )?(formed|made|concluded) at £?2\\.50'],
    wrongNote: 'A buyer who knows or ought to know of an obvious pricing error cannot snap it up (Smith v Hughes).',
  },
];

export const RETRIEVAL_BANK = {
  'contract-intro.what-is-contract': introItems,
  'contract-agreement.objective-approach': objectiveItems,
  ...moreRetrievalItems,
};

export const hasRetrievalBank = (id) => Object.prototype.hasOwnProperty.call(RETRIEVAL_BANK, id);
