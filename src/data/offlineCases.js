// Short case notes for the offline bank, written by me (not copied from the vault).
// Each entry: citation, plain facts, ratio, why it matters, and regexes used to
// spot the case and its facts/rule in a typed answer. England & Wales law.

export const CASES = {
  carlill: {
    name: 'Carlill v Carbolic Smoke Ball Co [1893] 1 QB 256 (CA)',
    nameRx: ['carlill', 'smoke ?ball', 'carbolic'],
    factsRx: ['smoke ?ball', '\\bflu\\b', 'influenza', '£ ?100', 'advert', '£ ?1,?000'],
    ruleRx: [
      'unilateral', 'world at large', 'whole world', 'performance', 'conduct',
      'need not (be )?communicat', 'no need to communicat', 'waive', 'puff', 'serious',
      'alliance bank', 'intention to be bound',
    ],
    facts: 'The company advertised £100 to anyone who caught influenza after using its smoke ball as directed, and said £1,000 was deposited at the Alliance Bank. Mrs Carlill used it and caught flu.',
    ratio: 'An advertisement can be a unilateral offer to the world at large, accepted by performing the conditions; the offeror can waive the need to communicate acceptance, and the bank deposit showed a serious intention to be bound, so it was not a mere puff.',
    whyItMatters: 'It is the classic authority that an advert can be an offer (not always an invitation to treat) and that acceptance by conduct needs no notice in a unilateral contract.',
  },
  hyde: {
    name: 'Hyde v Wrench (1840) 3 Beav 334',
    nameRx: ['hyde', 'wrench'],
    factsRx: ['farm', '£ ?1,?000', '£ ?950', '£ ?1,?200'],
    ruleRx: ['counter[- ]?offer', 'destroy', 'terminat', 'rejection', 'reject'],
    facts: 'Wrench offered to sell his farm for a stated price; Hyde offered a lower sum, which Wrench refused; Hyde then tried to accept the original price.',
    ratio: 'A counter-offer is a rejection of the original offer and destroys it, so it cannot later be accepted.',
    whyItMatters: 'It shows acceptance must be unqualified, and separates a counter-offer from a mere request for information (compare Stevenson v McLean, which is not in your demo notes).',
  },
  harvey: {
    name: 'Harvey v Facey [1893] AC 552 (PC)',
    nameRx: ['harvey', 'facey'],
    factsRx: ['bumper hall', 'telegram', 'lowest price', '£ ?900'],
    ruleRx: ['request for information', 'not an offer', 'invitation', 'information', 'supply'],
    facts: 'Harvey telegraphed asking whether Facey would sell Bumper Hall Pen and for his lowest price; Facey replied only with a price, and Harvey then purported to accept.',
    ratio: 'Stating a price in answer to a request for information is not an offer to sell; the seller never indicated willingness to be bound.',
    whyItMatters: 'It separates an offer from a supply of information, and shows the objective test: would a reasonable person think the speaker was willing to be bound on acceptance?',
  },
  boots: {
    name: 'Pharmaceutical Society of Great Britain v Boots Cash Chemists (Southern) Ltd [1953] 1 QB 401 (CA)',
    nameRx: ['boots', 'pharmaceutical'],
    factsRx: ['self[- ]service', 'shelf', 'shelves', 'pharmacist', 'cash desk', 'till', 'poisons', 'pharmacy'],
    ruleRx: ['invitation to treat', 'customer (makes|is) the offer', 'offer.{0,30}(till|cash desk)', 'accept.{0,30}(till|cash|cashier)', 'display'],
    facts: 'Boots ran a self-service shop; customers put medicines in a basket and paid at a cash desk where a pharmacist supervised. The Society said the sale happened at the shelf, without a pharmacist, in breach of the Pharmacy and Poisons Act 1933.',
    ratio: 'Goods on a self-service display are an invitation to treat. The customer makes the offer when presenting them at the till, and the sale is made when the cashier accepts; the pharmacist supervised at that point, so there was no breach.',
    whyItMatters: 'It tells you who is offeror in a shop and when a shopkeeper is free to refuse (for example, a wrongly priced item).',
  },
  fisher: {
    name: 'Fisher v Bell [1961] 1 QB 394 (DC)',
    nameRx: ['fisher', '\\bbell\\b'],
    factsRx: ['flick ?knife', 'knife', 'shop window', 'window', 'offensive weapons', 'prosecut'],
    ruleRx: ['invitation to treat', 'not an offer', 'display', 'offer for sale', 'contract law'],
    facts: 'A shopkeeper displayed a flick knife with a price in his window and was prosecuted under the Restriction of Offensive Weapons Act 1959 for offering it for sale.',
    ratio: 'Displaying goods with a price in a shop window is an invitation to treat, not an offer for sale; applying the ordinary contract meaning of "offer", the shopkeeper was not guilty.',
    whyItMatters: 'It shows the contract rule on invitations to treat applied even in a criminal statute, and that goods on display do not bind the shopkeeper to sell.',
  },
  adams: {
    name: 'Adams v Lindsell (1818) 1 B & Ald 681',
    nameRx: ['adams', 'lindsell'],
    factsRx: ['wool', 'letter', 'post', 'delay', 'misdirect', 'sold the wool'],
    ruleRx: ['postal rule', 'posted', 'posting', 'when (the letter is )?post', 'on posting', 'not (on )?receipt'],
    facts: 'Lindsell offered wool by letter requiring a reply by post; the letter reached Adams late, who posted acceptance at once, but Lindsell had sold the wool in the meantime.',
    ratio: 'Where post is a reasonable means of acceptance, acceptance is complete when the letter is posted, not when it arrives, even if it is delayed or lost.',
    whyItMatters: 'It is the origin of the postal rule, an exception to the general rule that acceptance must be communicated.',
  },
  byrne: {
    name: 'Byrne & Co v Van Tienhoven & Co (1880) 5 CPD 344',
    nameRx: ['byrne', 'tienhoven'],
    factsRx: ['cardiff', 'new york', 'telegram', 'telegraph', 'tin plate', 'revoc', 'withdr'],
    ruleRx: ['revocation', 'revoke', 'communicat', 'received', 'postal rule.{0,40}(not|does not|doesn)', 'must be communicated'],
    facts: 'The defendants posted an offer, later posted a revocation, and the claimants accepted by telegram before the revocation arrived.',
    ratio: 'Revocation of an offer takes effect only when it is communicated to (received by) the offeree; the postal rule does not apply to revocation, so the contract had already been formed.',
    whyItMatters: 'It limits the postal rule and protects an offeree who has relied on an offer that is still open.',
  },
  entores: {
    name: 'Entores Ltd v Miles Far East Corp [1955] 2 QB 327 (CA)',
    nameRx: ['entores', 'miles far east'],
    factsRx: ['telex', 'london', 'amsterdam', 'copper'],
    ruleRx: ['instantaneous', 'received', 'receipt', 'telephone', 'communicat', 'where (it is )?received'],
    facts: 'Entores in London accepted an offer by telex sent from Amsterdam; the question was where and when the contract was made.',
    ratio: 'For instantaneous communications, the general rule applies: acceptance is effective when it is received, so the contract is made where the acceptance is received.',
    whyItMatters: 'It marks the limit of the postal rule: for telephone, telex and similar instant methods, acceptance must actually reach the offeror.',
  },
};

export const CASE_LIST = Object.values(CASES);

/** Short citation names for display, e.g. "Carlill". */
export const SHORT = {
  carlill: 'Carlill v Carbolic Smoke Ball Co',
  hyde: 'Hyde v Wrench',
  harvey: 'Harvey v Facey',
  boots: 'Pharmaceutical Society v Boots',
  fisher: 'Fisher v Bell',
  adams: 'Adams v Lindsell',
  byrne: 'Byrne v Van Tienhoven',
  entores: 'Entores v Miles Far East',
};
