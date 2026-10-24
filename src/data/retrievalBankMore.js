// Offline garden retrieval items (T22), part 2: offer-and-acceptance, assault, and the demo subsection.
// Same shape as retrievalBank.js. Written by me from standard England & Wales law, not copied from the vault.
// The vault handout names Thomas v NUM under assault but is silent on its holding, so no item relies on it.

const C = (id, label, ...any) => ({ id, label, any });

export const frameworkItems = [
  {
    kind: 'rule', about: 'offer|acceptance|bilateral|unilateral|withdraw',
    q: 'From memory: what are the two steps of the traditional offer-and-acceptance analysis?',
    model: 'Step 1, identification: is there an offer, a matching acceptance, or was the offer withdrawn first? Step 2, communication: has each communication been effectively delivered under the applicable rule?',
    concepts: [C('id', 'step 1: identify offer, matching acceptance, earlier withdrawal', 'identif', 'step (1|one)', 'offer'), C('comm', 'step 2: communication under the applicable rule', 'communicat', 'deliver', 'step (2|two)', 'received', 'reach')],
    solidAt: 0.99, requiredIds: ['id', 'comm'],
  },
  {
    kind: 'case', about: 'offer|acceptance|bilateral|unilateral|withdraw',
    q: 'Which case is the origin of the postal rule, and which case says a revocation must be communicated? Give the rule from each.',
    model: 'Adams v Lindsell (1818): acceptance by post is complete on posting. Byrne v Van Tienhoven (1880): revocation takes effect only when it reaches the offeree, and the postal rule does not apply to it.',
    concepts: [C('adams', 'Adams v Lindsell', 'adams', 'lindsell'), C('post', 'acceptance complete on posting', 'on posting', 'when (it is |it was )?posted', 'postal rule', 'posted'), C('byrne', 'Byrne v Van Tienhoven', 'byrne', 'tienhoven'), C('rev', 'revocation must be communicated to the offeree', 'revo[a-z]* .{0,40}(communicat|reach|receiv)', '(communicat|reach|receiv).{0,40}revo')],
    solidAt: 0.99, requiredIds: ['post', 'rev'],
  },
  {
    kind: 'apply', about: 'offer|acceptance|bilateral|unilateral|withdraw',
    q: 'Facts: Ines writes to Karl on Monday offering her bike for £300. On Tuesday she posts a letter withdrawing the offer. On Wednesday, before it arrives, Karl posts an acceptance. Is there a contract? Brief IRAC, please.',
    model: 'Yes. Acceptance by post is complete on posting (Adams v Lindsell), and revocation only takes effect when communicated (Byrne v Van Tienhoven). Karl accepted before the withdrawal reached him, so a contract was formed on Wednesday.',
    concepts: [C('post', 'acceptance by post is complete on posting', 'postal rule', 'on posting', 'when (it is |it was )?posted', 'adams'), C('rev', 'revocation only takes effect when communicated', 'revo[a-z]* .{0,40}(communicat|reach|receiv)', 'not (yet )?(communicated|received|arrived|reached)', 'byrne'), C('apply', 'applied: Karl accepted before the withdrawal arrived', 'wednesday', 'before (the )?(withdrawal|revocation|letter)', 'not yet'), C('conc', 'conclusion: a contract was formed', '(a )?contract (was |has been |is )?(formed|made|concluded)', 'there is a contract', 'binding contract', 'too late')],
    solidAt: 0.74, requiredIds: ['post', 'conc'],
    wrongRx: ['there (is|was) no (binding |valid )?contract', '(ines\'?s? )?(withdrawal|revocation) (was |is )?(effective|valid|in time)', 'karl\'?s? acceptance (was|is) (too late|ineffective|invalid)'],
    wrongNote: 'The postal rule protects the acceptance, not the revocation: revocation bites only on receipt.',
  },
];

export const assaultItems = [
  {
    kind: 'rule', about: 'apprehension|immediate|violence|words|threat|assault',
    q: 'From memory: define assault in tort, element by element, and say what the claimant must apprehend.',
    model: 'Assault is an act of the defendant that causes the claimant reasonable apprehension of the infliction of a battery on them by the defendant. The apprehension is of immediate force; no contact is needed.',
    concepts: [C('act', 'an act of the defendant', 'act', 'defendant'), C('appr', 'reasonable apprehension in the claimant', 'apprehen', 'reasonabl[ey] (fear|expect)', 'fear'), C('batt', 'of a battery (force) by the defendant', 'battery', 'force', 'being (hit|struck|touched)'), C('imm', 'the force must be immediate', 'immediate', 'imminent')],
    solidAt: 0.74, requiredIds: ['appr', 'imm'],
  },
  {
    kind: 'case', about: 'apprehension|immediate|violence|words|threat|assault',
    q: 'Choose Stephens v Myers, Tuberville v Savage, Read v Coker or R v Ireland. Give the facts, the rule, and why it matters.',
    model: 'Tuberville v Savage (1669): the defendant put his hand on his sword and said that were it not assize-time he would not take such language; held not an assault because the words showed no intention to strike then and there. It shows words can negate a threat.',
    concepts: [C('name', 'naming the case', 'stephens', 'myers', 'tuberville', 'savage', 'read v coker', 'coker', 'ireland'), C('facts', 'the key facts', 'sword', 'assize', 'fist', 'chair', 'parish', 'sleeves', 'workmen', 'silent', 'telephone', 'phone'), C('rule', 'the rule: apprehension of immediate force / words can negate or make a threat', 'apprehen', 'immediate', 'words', 'negat', 'striking distance', 'silen')],
    solidAt: 0.99, requiredIds: ['name', 'rule'],
  },
  {
    kind: 'apply', about: 'apprehension|immediate|violence|words|threat|assault',
    q: 'Facts: Lena is in her car at a red light. A man at the pavement edge swings a bat towards her windscreen, stopping just short. She is terrified but unhurt. Has she a claim in assault? Brief IRAC, please.',
    model: 'Yes, probably. Assault needs an act causing reasonable apprehension of immediate battery. Swinging a bat close to her, within striking distance, would make a reasonable person fear immediate force, and no contact is needed (compare Stephens v Myers, where the blow was intercepted).',
    concepts: [C('rule', 'the rule: reasonable apprehension of immediate force, no contact needed', 'apprehen', 'immediate', 'imminent', 'no contact', 'without contact'), C('apply', 'applied: bat swung close, she feared being hit', 'bat', 'swing', 'swung', 'close', 'terrified', 'fear', 'within reach', 'striking distance'), C('conc', 'conclusion: probably an assault', '(an? )?assault', 'likely (to )?succeed', 'has a claim', 'can claim', 'liable')],
    solidAt: 0.74, requiredIds: ['rule', 'conc'],
    wrongRx: ['(she|lena) (has|have) no (claim|case)', 'no assault', 'not (an )?assault(?!ive)', 'contact (is|was) (required|needed|necessary)'],
    wrongNote: 'Assault is the apprehension of immediate force; contact is the separate wrong of battery.',
  },
];

export const demoItems = [
  {
    kind: 'rule', about: 'offer|invitation|acceptance|postal|revocation|communication',
    q: 'From memory: what is the difference between an offer and an invitation to treat, and what is the effect of a counter-offer?',
    model: 'An offer shows willingness to be bound on acceptance; an invitation to treat only invites offers. A counter-offer rejects and destroys the original offer (Hyde v Wrench).',
    concepts: [C('offer', 'an offer shows willingness to be bound on acceptance', 'bound', 'willing', 'offer'), C('itt', 'an invitation to treat only invites offers', 'invit', 'not (an )?offer'), C('counter', 'a counter-offer destroys the original offer', 'counter[- ]?offer', 'hyde', 'destroy', 'reject')],
    solidAt: 0.99, requiredIds: ['itt', 'counter'],
  },
  {
    kind: 'case', about: 'offer|invitation|acceptance|postal|revocation|communication',
    q: 'Which case treats self-service shelf goods, and what did it decide? Give facts, rule, and why it matters.',
    model: 'Pharmaceutical Society v Boots [1953]: in a self-service pharmacy the shelf display is an invitation to treat; the customer makes the offer at the till, where the pharmacist can accept or refuse.',
    concepts: [C('name', 'naming the case', 'boots', 'pharmaceutical'), C('facts', 'self-service pharmacy, goods on shelves, till', 'self[- ]service', 'shelf', 'shelves', 'till', 'cash desk', 'pharmac'), C('rule', 'display is an invitation to treat; the offer is made at the till', 'invitation to treat', 'offer.{0,30}till', 'till.{0,40}offer')],
    solidAt: 0.99, requiredIds: ['name', 'rule'],
  },
  {
    kind: 'apply', about: 'offer|invitation|acceptance|postal|revocation|communication',
    q: 'Facts: a bookshop window shows a first edition marked £20; it was meant to be £200. A customer walks in demanding it at £20. Is the shop bound? Brief IRAC, please.',
    model: 'Probably not. A window display is an invitation to treat (Fisher v Bell), so the customer\'s request is the offer, which the shop is free to refuse; no contract exists until it accepts.',
    concepts: [C('itt', 'a display is an invitation to treat', 'invitation to treat', 'invites offers', 'fisher', 'not (an )?offer'), C('offer', 'the customer makes the offer, which the shop may refuse', 'customer.{0,30}offer', 'offer.{0,40}(customer|buyer)', 'free to (refuse|accept)', 'may (refuse|decline)'), C('conc', 'conclusion: the shop is probably not bound', 'not bound', 'no contract', 'can refuse', 'free to refuse', 'unlikely')],
    solidAt: 0.74, requiredIds: ['itt', 'conc'],
    wrongRx: ['(the )?(shop|bookshop|seller) (is|was|will be) (legally |contractually )?(bound|obliged|liable)', 'a contract (was |has been |is )?(formed|made|concluded) at £?20\\b', '(the )?display (is|was) (an )?offer'],
    wrongNote: 'Displays invite offers (Fisher v Bell; Boots); the shop accepts or refuses.',
  },
];

export const moreRetrievalItems = {
  'contract-agreement.offer-and-acceptance': frameworkItems,
  'tort-trespass.assault': assaultItems,
  'contract-offer-acceptance': demoItems,
};
