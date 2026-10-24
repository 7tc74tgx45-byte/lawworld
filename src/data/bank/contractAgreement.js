// Offline bank: contract-agreement.objective-approach and contract-agreement.offer-and-acceptance
// (note: LAW7054-Poole-Ch2-Agreement.md, sections 2.1 and 2.2). Written by me, grounded in those headings.
// Case details beyond the names and holdings in the note are standard England & Wales law, kept short.

import { CASES } from '../offlineCases.js';
import { buildSubsectionBank, conceptStage, authorityStage, applicationStage, caseConcept } from './helpers.js';

const storer = {
  id: 'storer',
  name: 'Storer v Manchester City Council [1974] 1 WLR 1403 (CA)',
  nameRx: ['storer'],
  factsRx: ['council', 'house', 'tenant', 'sign', 'return', 'agreement', 'purchase', 'sale of (the )?(council )?house'],
  ruleRx: ['objective', 'outward appearance', 'what (he|they) (said|did)', 'reasonable (person|man|observer)', 'not (the )?subjective', 'concluded'],
  ratio: 'Whether a contract exists is judged objectively: you look at what the parties said and did, and a contract is formed when, to all outward appearances, there is one (Lord Denning), whatever either privately thought.',
  whyItMatters: 'It is the note\'s lead authority for the objective approach to agreement.',
};
const smith = {
  id: 'smith',
  name: 'Smith v Hughes (1871) LR 6 QB 597',
  nameRx: ['smith v hughes', 'hughes'],
  factsRx: ['oats', 'hay', 'old', 'new', 'sample', 'horse'],
  ruleRx: ['objective', 'communicated', 'subjective', 'reasonable (person|man)', 'privately', 'snap'],
  ratio: 'What counts is what was communicated, judged objectively; a party who knows the other is mistaken about the terms the other thinks he is agreeing to cannot hold him to the contract.',
  whyItMatters: 'It shows the objective test and the residual subjective exception: you cannot snap up a mistake you know about.',
};
const rts = {
  id: 'rts',
  name: 'RTS Flexible Systems Ltd v Molkerei Alois Müller GmbH [2010] UKSC 14',
  nameRx: ['rts', 'm[uü]ller', 'flexible systems'],
  factsRx: ['letter of intent', 'work began', 'engineering', 'start(ed)? work', 'no (signed|formal) contract', 'subject to contract'],
  ruleRx: ['objective', 'communicated', 'subjective state of mind', 'what was communicated'],
  ratio: 'Whether a binding contract exists depends not on the parties\' subjective states of mind but on what was communicated between them, objectively assessed, including their conduct.',
  whyItMatters: 'It is the modern Supreme Court statement of the objective test.',
};
const chwee = {
  id: 'chwee',
  name: 'Chwee Kin Keong v Digilandmall.com Pte Ltd [2005] 1 SLR 502 (Singapore CA)',
  nameRx: ['chwee', 'digilandmall'],
  factsRx: ['laser printer', 'printer', 'website', 'online', 'price', 'mispric', 'typographical', 'error'],
  ruleRx: ['knew', 'ought to (have )?know', 'snap up', 'mistake', 'not (bound|enforce)'],
  ratio: 'A buyer who knew or ought to have known that an online price was a mistake could not hold the seller to it; the objective test does not allow a party to snap up an obvious error.',
  whyItMatters: 'It illustrates the residual subjective element in the objective test. It is a Singapore authority, which an English court would treat as persuasive only.',
};

const objectiveBank = buildSubsectionBank({
  intro:
    'We are at the start of the Agreement chapter, and the question underneath it all is: how do we know two people have agreed? This section gives the lens the courts use, before you meet offer and acceptance in detail. It builds directly on the idea that a contract is an enforceable agreement. Press Continue.',
  s2: conceptStage({
    prompt: 'Stage 2, plain English. Two people argue about whether they made a deal. One says "I never really meant to be bound". In your own words, how does the law decide whether they agreed, and why does it work that way?',
    modelAnswer: 'The law looks at what the parties said and did, judged as a reasonable observer would see it, not at what they secretly had in mind. This gives certainty, discourages cheating and protects people who reasonably relied on the other side\'s words.',
    hints: [
      'Ask yourself: can a court read minds? What can it actually look at?',
      'Think about the other person who relied on what you said. Why would it be unfair to let you escape by pointing to a private thought?',
    ],
    concepts: [
      { id: 'obj', label: 'agreement is judged objectively', any: ['objective', 'reasonable (person|man|observer|onlooker)', 'outward', 'appear'] },
      { id: 'said', label: 'by what the parties said and did', any: ['said and did', 'words and conduct', 'what (was|is) (said|communicated)', 'conduct', 'communicated', 'outward'] },
      { id: 'notsub', label: 'not their secret or subjective intentions', any: ['subjective', 'secret', 'private', 'internal', 'inside (their|his|her) head', 'what (they|he|she) really (meant|thought)'] },
      { id: 'why', label: 'because it gives certainty and protects reliance and prevents fraud', any: ['certain', 'reli(ance|ed|ant)', 'fraud', 'fair', 'unfair', 'trust', 'cheat'] },
    ],
    requiredIds: ['obj', 'notsub'],
  }),
  s3: conceptStage({
    prompt: 'Stage 3, precision. (1) State the objective test of agreement. (2) Give the two main reasons the courts prefer it. (3) What is the residual subjective element, and when does it stop a party relying on the objective appearance?',
    modelAnswer: 'Agreement is determined by what a reasonable person would conclude from the parties\' words and conduct, not by their subjective intentions. The note gives three reasons: a subjective approach would create uncertainty, invite fraud, and defeat good-faith reliance on promises. There is a residual subjective element: if the promisee knows or ought to know that the promisor did not intend those terms (a mispriced item such as a TV at £4.99 instead of £499), the promisee cannot snap up the mistake.',
    hints: [
      'Part 3 is about a limit on the objective test. What must the other party know before the appearance of agreement stops protecting them?',
      'Think of the knowledge standard: is it only actual knowledge, or something wider?',
    ],
    concepts: [
      { id: 'obj', label: 'agreement is judged by what a reasonable person would conclude from words and conduct', any: ['reasonable (person|man|observer)', 'objective'] },
      { id: 'notsub', label: 'subjective intentions are not the test', any: ['subjective', 'secret', 'private', 'internal'] },
      { id: 'unc', label: 'subjective approach would create uncertainty', any: ['uncertain', 'certainty', 'unpredictab'] },
      { id: 'fraud', label: 'it would invite fraud', any: ['fraud', 'dishonest', 'cheat', 'false claims'] },
      { id: 'rely', label: 'it would defeat reliance on promises', any: ['reli(ance|ed|ant)', 'good faith reliance', 'rely'] },
      { id: 'know', label: 'a party who knows or ought to know of the mistake cannot snap it up', any: ['(knows|knew|ought to (have )?know)', 'snap up', 'knowledge'] },
      { id: 'tv', label: 'example: a mispriced item (TV at £4.99 not £499)', any: ['mispric', 'tv', 'television', '4\\.99', 'wrong price', 'price error', 'typo'] },
    ],
    solidAt: 0.7, partialAt: 0.4, requiredIds: ['obj', 'know'],
    followUp: (missed) => `Look again at "${missed[0].label}". State it as a rule in one precise sentence.`,
  }),
  s4: authorityStage({
    prompt: 'Stage 4, authority. Pick one case from this section and explain it as facts, rule, why it matters: Storer v Manchester City Council, Smith v Hughes, RTS Flexible Systems v Müller, or Chwee Kin Keong v Digilandmall.com (a Singapore case, persuasive only in England).',
    modelAnswer: 'Storer v Manchester CC [1974]: the council and a tenant were dealing over the sale of a council house, with a document to be signed and returned. The Court of Appeal held that a contract existed because, objectively, one had been concluded; Lord Denning said you look at what he said and did, and a contract is formed when there is, to all outward appearances, a contract. It matters as the lead authority for the objective approach.',
    hints: [
      'Choose one case and write three labelled parts: what happened, what the court said in law, why it is used.',
      'For the rule, which phrase captures it: "what was communicated" or "what they privately intended"?',
    ],
    cases: [storer, smith, rts, chwee],
  }),
  s5: applicationStage({
    prompt: 'Stage 5, application. A client, Tomás, runs a small online shop. A typing error priced a £499 TV at £4.99. Within minutes a buyer, who had been watching the site for such errors, ordered five and received an automated acknowledgement. Tomás says he never meant to sell at that price. Advise in IRAC whether he is bound.',
    modelAnswer: 'Issue: whether Tomás is bound at £4.99 despite never intending that price. Rule: agreement is judged objectively, by words and conduct, not by subjective intention (Storer; RTS v Müller), but there is a residual subjective element: a party who knows or ought to know of the other\'s mistake cannot snap it up (Smith v Hughes; Chwee Kin Keong, a Singapore authority and only persuasive in England). Application: objectively the listing looks like an offer at £4.99, but a price a hundred times too low and a buyer hunting for errors point to knowledge or constructive knowledge of the mistake. Conclusion: Tomás can argue he is not bound, with a strong claim if he can evidence the buyer\'s knowledge; he should act quickly and gather the order history. The note does not cover the consumer statutes that may also apply.',
    hints: [
      'Start with the Issue: does Tomás\'s private intention matter, or something else?',
      'For the Rule, there is a general test and a limit to it. State both, then ask which of them the buyer\'s behaviour engages.',
    ],
    concepts: [
      { id: 'obj', label: 'the general rule: agreement is objective (words and conduct)', any: ['objective', 'reasonable (person|man|observer)', 'outward'] },
      { id: 'know', label: 'the exception: a party who knows or ought to know of the mistake cannot snap it up', any: ['knew', 'knows', 'ought to (have )?known?', 'snap up', 'constructive knowledge'] },
      caseConcept(smith, 'Smith v Hughes or Chwee Kin Keong (knowledge of the mistake)', ['chwee', 'digilandmall']),
      { id: 'facts', label: 'applying the facts: the price was 100 times too low and the buyer was hunting for errors', any: ['hunt', 'watching', 'obvious', 'too low', 'hundred', 'looking for (errors|mistakes)', 'error'] },
      { id: 'conc', label: 'conclusion: Tomás is probably not bound, if he can show the buyer knew', any: ['not bound', 'no contract', 'can (avoid|resist|refuse)', 'unlikely to be bound', 'not (be )?liable', 'probably not'] },
    ],
    requiredIds: ['obj', 'know'],
    // Wrong conclusions: that Tomás is bound / the buyer wins, or that private intention is the test.
    wrongRx: [
      'tom[aá]s (is|was|will be|would be) (legally |contractually )?(bound|liable|obliged)',
      'tom[aá]s (must|has to|will have to|should) (honou?r|sell|fulfil|supply|deliver)',
      '(the )?(buyer|customer) (is|was) (entitled|able) to (hold|enforce|insist|buy)',
      '(the )?(buyer|customer) (can|may|will) (hold|enforce|insist)',
      'a contract (was |has been |is )?(formed|made|concluded) (at|for) £?4\\.99',
      '(his|tom[aá]s\'?s?|private|subjective) (private |subjective )?(intention|intentions) (is|are|was) (what matters|the test|decisive|enough)',
    ],
    wrongNote: 'The listing looks like an offer objectively, but a party who knows or ought to know of the other\'s mistake cannot snap it up (Smith v Hughes), so Tomás has a real argument that he is not bound.',
    followUp: (missed) => `Think about what the buyer knew. Your answer is missing: ${missed.map((m) => m.label).join('; ')}.`,
  }),
  mcqs: [
    {
      text: 'On the objective approach, what decides whether the parties agreed?',
      options: ['What each party privately intended.', 'What a reasonable person would conclude from the parties\' words and conduct.', 'What the court thinks is fair between the parties.'],
      correct: 1,
      concept: 'objective approach to agreement',
      explanation: 'Agreement is judged by words and conduct as a reasonable observer would see them, not by private intentions (Storer; RTS v Müller).',
      hints: ['Can a court read minds?', 'Which word best describes a test that looks from the outside?'],
    },
    {
      text: 'Which is NOT one of the reasons given for preferring the objective test?',
      options: ['A subjective approach would create uncertainty.', 'A subjective approach would invite fraud.', 'A subjective approach is forbidden by the Contracts Act.'],
      correct: 2,
      concept: 'why the objective test',
      explanation: 'The reasons are uncertainty, fraud and defeating reliance on promises. There is no statute of that kind, and the note does not mention one.',
      hints: ['Which option names a statute rather than a practical concern?', 'The reasons are about practical consequences of reading minds.'],
    },
    {
      text: 'A buyer orders a £499 TV listed by mistake at £4.99, and knew it was a mistake. What is the position?',
      options: ['The buyer can hold the seller to the price, because the objective listing was an offer.', 'The buyer cannot snap up a mistake that he knew or ought to have known about.', 'The seller is bound, but only for one TV.'],
      correct: 1,
      concept: 'residual subjective element',
      explanation: 'The residual subjective element stops a party who knows or ought to know of the other\'s mistake from taking advantage of it (compare Smith v Hughes; Chwee Kin Keong, persuasive only in England).',
      hints: ['Does the objective test protect a party who knows the truth?', 'What does the phrase "snap up" suggest about fairness?'],
    },
  ],
  qa: [
    { rx: ['subjective'], text: 'The note says agreement is objective, not subjective. A residual subjective element remains: a promisee who knows or ought to know the promisor did not intend the terms cannot snap up the mistake.' },
    { rx: ['storer'], text: `${storer.name}: ${storer.ratio}` },
    { rx: ['chwee', 'digilandmall'], text: `${chwee.name}: ${chwee.ratio}` },
  ],
});

const treitel = { id: 'treitel', name: 'the two-step analysis', nameRx: ['two[- ]step'], factsRx: [], ruleRx: [], ratio: '', whyItMatters: '' };
void treitel;

const hyde = { id: 'hyde', ...CASES.hyde };
const boots = { id: 'boots', ...CASES.boots };
const adams = { id: 'adams', ...CASES.adams };
const byrne = { id: 'byrne', ...CASES.byrne };
const entores = { id: 'entores', ...CASES.entores };

const frameworkBank = buildSubsectionBank({
  intro:
    'Now the framework itself. The previous section told you agreement is judged objectively; this one gives you the method lawyers use to test it, in two steps, and you will apply it to every formation problem in the module. Press Continue.',
  s2: conceptStage({
    prompt: 'Stage 2, plain English. Explain, as if to a friend, how you would work out whether two people have made a contract by exchanging messages. What questions would you ask, in what order?',
    modelAnswer: 'First ask whether one side made an offer and the other gave a matching acceptance, or whether the offer was taken back first. Then ask whether each message was effectively delivered under the relevant rule.',
    hints: [
      'There are two broad steps. One is about what was said; the other is about how it got there.',
      'Think of an offer that is withdrawn in the morning and accepted in the afternoon: which step catches that?',
    ],
    concepts: [
      { id: 'offer', label: 'was there an offer?', any: ['offer'] },
      { id: 'accept', label: 'is there a matching acceptance?', any: ['accept', 'match(ing)?', 'agree'] },
      { id: 'withdrawn', label: 'was the offer withdrawn first?', any: ['withdr', 'revok', 'taken back', 'cancel'] },
      { id: 'comm', label: 'was each message communicated effectively?', any: ['communicat', 'deliver', 'received', 'reach(ed)?', 'arriv'] },
    ],
    solidAt: 0.75, partialAt: 0.5, requiredIds: ['offer', 'accept'],
  }),
  s3: conceptStage({
    prompt: 'Stage 3, precision. (1) Set out the two-step analysis in this section. (2) Give the Treitel definition of a contract as the note records it, and say what distinguishes contractual obligations from tort. (3) Name the main rules that govern step 2 and one case for each: a counter-offer, acceptance by post, revocation.',
    modelAnswer: 'Step 1, identification: is there an offer, a matching acceptance, or was the offer withdrawn first? Step 2, communication: has each communication been effectively delivered under the applicable rule? Treitel: a contract is an agreement giving rise to obligations enforced by the law; contractual obligations rest on the parties\' voluntary agreement, unlike tort, which is imposed by law. Rules: a counter-offer destroys the original offer (Hyde v Wrench); under the postal rule, acceptance by post is complete on posting (Adams v Lindsell); revocation must be communicated to the offeree (Byrne v Van Tienhoven).',
    hints: [
      'Label your answer Step 1 and Step 2. Step 2 is not about what was said, but about whether it arrived.',
      'For the cases, match each one to its rule: which one is about a reply with different terms, which about the letterbox, which about withdrawal?',
    ],
    concepts: [
      { id: 'id', label: 'step 1 is identification: offer, matching acceptance, or withdrawal first', any: ['identif', 'step (1|one)', 'first step'] },
      { id: 'comm', label: 'step 2 is communication under the applicable rule', any: ['communicat', 'step (2|two)', 'second step', 'delivered'] },
      { id: 'treitel', label: 'Treitel: an agreement giving rise to obligations enforced by the law', any: ['treitel', 'agreement giving rise', 'enforced by the law'] },
      { id: 'vol', label: 'contractual obligations are voluntary; tort obligations are imposed by law', any: ['voluntar', 'imposed', 'by law'] },
      caseConcept(hyde, 'counter-offer destroys the original offer (Hyde v Wrench)', ['counter[- ]?offer']),
      caseConcept(adams, 'postal rule: acceptance complete on posting (Adams v Lindsell)', ['postal rule']),
      caseConcept(byrne, 'revocation must be communicated (Byrne v Van Tienhoven)', ['revo(ke|cation)']),
    ],
    solidAt: 0.7, partialAt: 0.4, requiredIds: ['id', 'comm'],
    followUp: (missed) => `Look again at "${missed[0].label}". Say it as a rule in one precise sentence.`,
  }),
  s4: authorityStage({
    prompt: 'Stage 4, authority. Pick one case that illustrates step 2 or a rule within step 1, and explain it as facts, rule, why it matters. Choose from Hyde v Wrench, Adams v Lindsell, Byrne v Van Tienhoven or Entores v Miles Far East.',
    modelAnswer: 'Adams v Lindsell (1818): Lindsell offered wool by letter and asked for a reply by post; the letter reached Adams late, he posted his acceptance at once, and Lindsell sold the wool meanwhile. The court held the contract was formed when the acceptance was posted. It matters as the origin of the postal rule, an exception to the general rule that acceptance must be communicated.',
    hints: [
      'Choose one case and give three labelled parts: facts, legal rule, and why it matters.',
      'Which step of the analysis does your case belong to, and what problem did it solve?',
    ],
    cases: [adams, byrne, hyde, entores],
  }),
  s5: applicationStage({
    prompt: 'Stage 5, application. Client scenario: on Monday Rhea wrote to Omar offering to sell him her van for £6,000, open for a week. On Tuesday she posted a letter withdrawing the offer. On Wednesday, before that letter arrived, Omar posted a letter accepting. The withdrawal reached Omar on Thursday. Advise Omar in IRAC whether there is a contract.',
    modelAnswer: 'Issue: whether a contract was formed given Rhea\'s withdrawal. Rule: step 1, there must be an offer and matching acceptance and no earlier withdrawal; step 2, communication: acceptance by post is complete on posting if post is a reasonable method (Adams v Lindsell); revocation takes effect only when communicated to the offeree, and the postal rule does not apply to it (Byrne v Van Tienhoven). Application: the offer was open on Wednesday because the revocation had not reached Omar, and his acceptance was complete on posting. Conclusion: a contract was formed on Wednesday, so Rhea\'s withdrawal came too late. Omar should keep proof of posting.',
    hints: [
      'Begin with the Issue. Then ask which of the two steps matters most here: what the parties said, or whether it arrived?',
      'For the Rule, find the rule about acceptance by post and the rule about revocation. Do they work the same way?',
    ],
    concepts: [
      { id: 'two', label: 'the offer and a matching acceptance, then communication rules (two-step approach)', any: ['offer', 'matching', 'accept'] },
      caseConcept(adams, 'postal rule: acceptance complete on posting (Adams v Lindsell)', ['postal rule']),
      caseConcept(byrne, 'revocation takes effect only when communicated (Byrne v Van Tienhoven)', ['revo(ke|cation)', 'withdr']),
      { id: 'apply', label: 'applying it: acceptance posted Wednesday, before the withdrawal arrived on Thursday', any: ['wednesday', 'before (the )?(withdrawal|revocation|letter)', 'posted .{0,40}(before|prior)', 'not yet (received|arrived|communicated)'] },
      { id: 'conc', label: 'conclusion: a contract was formed on Wednesday', any: ['(a )?contract (was |has been |is )?(formed|made|concluded)', 'there is a contract', 'binding contract', 'too late'] },
    ],
    requiredIds: ['conc'],
    // Wrong conclusions: no contract, withdrawal effective on posting, acceptance only on receipt.
    wrongRx: [
      'there (is|was) no (binding |valid )?contract',
      'no (binding |valid )?contract (was |has been |is )?(formed|made|concluded|exists)',
      '(rhea\'?s? )?(withdrawal|revocation) (was |is )?(effective|complete|valid|in time) (on|when|upon|as soon as) (it was )?(post|sent|writ)',
      '(rhea\'?s? )?(withdrawal|revocation) (was|is) (effective|in time|valid)',
      'omar\'?s? acceptance (was|is) (too late|ineffective|not effective|invalid)',
      'acceptance (is|was) (only )?(effective|complete) (on|upon|until|when) (receipt|received|it (is|was) received|it arrived)',
      'rhea (is|was) not bound',
      'omar (is|was) not bound',
    ],
    wrongNote: 'Acceptance by post is complete on posting (Adams v Lindsell), whereas a revocation only takes effect when it reaches the offeree (Byrne v Van Tienhoven). Omar posted before the withdrawal arrived.',
    followUp: (missed) => `Trace the dates on a timeline. Your answer is missing: ${missed.map((m) => m.label).join('; ')}.`,
  }),
  mcqs: [
    {
      text: 'What are the two steps of the traditional analysis in this section?',
      options: ['Capacity, then form.', 'Identification (offer, acceptance, withdrawal), then communication under the applicable rule.', 'Consideration, then remedies.'],
      correct: 1,
      concept: 'two-step analysis',
      explanation: 'Step 1 asks whether there is an offer, a matching acceptance, or an earlier withdrawal; step 2 asks whether each communication was effectively delivered under the applicable rule.',
      hints: ['One step is about what was said, the other about what arrived.', 'Neither step is about remedies.'],
    },
    {
      text: 'Acceptance is posted on Monday; the offeror\'s letter of revocation, posted on Sunday, arrives Tuesday. Is there a contract?',
      options: ['Yes: acceptance was complete on posting and the revocation was not yet communicated.', 'No: revocation takes effect when posted.', 'No: acceptance only counts on receipt.'],
      correct: 0,
      concept: 'postal rule v revocation',
      explanation: 'Acceptance by post is complete on posting (Adams v Lindsell), while revocation must reach the offeree (Byrne v Van Tienhoven), so the contract was formed on Monday.',
      hints: ['Which of the two messages is protected by the postal rule?', 'When does a revocation take effect?'],
    },
    {
      text: 'How does the note distinguish contract from tort, following Treitel?',
      options: ['Contract is imposed by law, tort by agreement.', 'Contract is based on the voluntary agreement of the parties; tort obligations are imposed by law.', 'There is no distinction.'],
      correct: 1,
      concept: 'contract v tort',
      explanation: 'Contractual obligations arise from the parties\' voluntary agreement, whereas tort obligations are imposed by law.',
      hints: ['Who chooses the obligation in contract?', 'Which of the two options reverses the answer?'],
    },
  ],
  qa: [
    { rx: ['two.?step', 'steps'], text: 'The note\'s two steps: identification (is there an offer and a matching acceptance, or was the offer withdrawn first?) and communication (was each message effectively delivered under the applicable rule?).' },
    { rx: ['treitel'], text: 'The note quotes Treitel: a contract is an agreement giving rise to obligations enforced by the law; the obligations are voluntary, unlike tort.' },
  ],
});

export const contractAgreementBank = {
  'contract-agreement.objective-approach': objectiveBank,
  'contract-agreement.offer-and-acceptance': frameworkBank,
};
