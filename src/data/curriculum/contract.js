// LAW7054 Contract (Poole; Merkin & Saintier) — Summer. Extracted from vault headings.
import { makeDistrict } from '../../logic/curriculum.js';

const D = (spec) => makeDistrict({ tutor: 'okafor', ...spec });

export const contractDistricts = [
  D({
    id: 'contract-intro', title: 'Ch1: Introduction to Contract', chapter: 'Ch1', sourceFile: 'LAW7054-Poole-Ch1-Introduction-to-Contract.md', after: [], tutor: 'chen',
    subs: [
      ['what-is-contract', 'What Is a Contract?', 'Key points', ['enforceable agreement', 'consideration, intention, form', 'contract v tort', 'good faith in English law'], [], []],
    ],
  }),
  D({
    id: 'contract-agreement', title: 'Ch2: Agreement (Offer & Acceptance)', chapter: 'Ch2', sourceFile: 'LAW7054-Poole-Ch2-Agreement.md', after: ['contract-intro.what-is-contract'],
    subs: [
      ['objective-approach', 'The Objective Approach to Agreement', '2.1 The Objective Approach to Agreement', ['objective test', 'reasonable observer'], ['Storer v Manchester CC', 'Smith v Hughes', 'RTS Flexible Systems v Müller'], []],
      ['offer-and-acceptance', 'Offer and Acceptance: the Framework', '2.2 The Traditional Approach: Offer and Acceptance', ['offer', 'acceptance', 'bilateral v unilateral'], [], []],
      ['offer-vs-itt', 'Offers vs Invitations to Treat', '2.3 Offers vs Invitations to Treat', ['offer v invitation to treat', 'shop displays', 'advertisements', 'auctions', 'subject to contract'], ['Pharmaceutical Society v Boots', 'Partridge v Crittenden', 'Carlill v Carbolic Smoke Ball', 'Barry v Davies', 'Gibson v Manchester CC'], ['Sale of Goods Act 1979']],
      ['acceptance', 'Acceptance', '2.4 Acceptance', ['mirror image', 'counter-offer v request for information', 'battle of forms', 'silence', 'communication of acceptance', 'postal rule'], ['Hyde v Wrench', 'Stevenson v McLean', 'Butler Machine Tool v Ex-Cell-O', 'Felthouse v Bindley', 'Adams v Lindsell', 'Entores v Miles Far East'], []],
      ['termination-of-offers', 'Termination of Offers', '2.5 Termination of Offers', ['revocation', 'lapse', 'rejection', 'revocation of unilateral offers'], ['Byrne v Van Tienhoven', 'Dickinson v Dodds', 'Routledge v Grant', 'Errington v Errington'], []],
      ['unilateral-contracts', 'Unilateral Contracts', '2.7 Unilateral Contracts — Detailed Analysis', ['performance as acceptance', 'no revocation once begun', 'judicial device'], ['Carlill v Carbolic Smoke Ball', 'Great Northern Railway v Witham'], [], { pre: ['acceptance'] }],
    ],
  }),
  D({
    id: 'contract-digital', title: 'Week 1: Instantaneous Communication of Acceptance', chapter: 'W1', sourceFile: 'LAW7054-Contract-W1-Offer-and-Acceptance.md', after: ['contract-agreement.acceptance'],
    subs: [
      ['receipt-rule', 'The Receipt Rule (Entores)', 'The receipt rule baseline', ['receipt rule', 'instantaneous communication'], ['Entores v Miles Far East'], []],
      ['brinkibon', 'Brinkibon and Out-of-Hours Messages', 'Brinkibon Ltd v Stahag Stahl [1983] 2 AC 34 (HL)', ['telex through intermediary', 'where risk lies', 'out-of-hours'], ['Brinkibon v Stahag Stahl', 'Mondial Shipping v Astarte Shipping'], []],
      ['digital-age', 'Critical Angle: Digital Acceptance', 'Critical analysis angle — digital age', ['email and web acceptance', 'receipt rule v postal rule'], [], []],
    ],
  }),
  D({
    id: 'contract-certainty', title: 'Ch2: Certainty', chapter: 'Ch2', sourceFile: 'LAW7054-Poole-Ch2-Certainty.md', after: ['contract-agreement.offer-vs-itt'],
    subs: [
      ['approach', 'The Courts\' Approach to Certainty', '2. The Approach of the Courts (§2.6.1)', ['uphold bargains where possible', 'vagueness v incompleteness'], ['Hillas v Arcos', 'Scammell v Ouston'], []],
      ['vague-terms', 'Essential Terms That Are Vague', '3. Agreements in Which Essential Terms Are Vague (§2.6.2)', ['ambiguity', 'performance as rescue', 'severing meaningless clauses'], ['Raffles v Wichelhaus', 'Baird Textile v Marks & Spencer', 'Wells v Devani', 'Nicolene v Simmonds'], []],
      ['missing-terms', 'Essential Terms That Are Missing', '4. Agreements in Which Essential Terms Are Missing (§2.6.3)', ['agreements to agree', 'good faith negotiation', 'no contract yet'], ['British Steel v Cleveland Bridge', 'May and Butcher v R', 'Walford v Miles'], []],
      ['price-mechanisms', 'Mechanisms for Determining Price', '5. Mechanisms for Determining the Price (§2.6.4)', ['no mechanism', 'failed mechanism', 'reasonable price'], ['Sudbrook Trading v Eggleton', 'Hughes v Pendragon Sabre'], ['Sale of Goods Act 1979']],
      ['failed-contracts', 'Recovery When the Contract Fails', '6. Recovery Where the Anticipated Contract Fails to Materialize (§2.6.5)', ['restitution for work done', 'letters of intent'], ['British Steel v Cleveland Bridge', 'Whittle Movers v Hollywood Express'], []],
    ],
  }),
  D({
    id: 'contract-consideration', title: 'Ch3: Consideration and Promissory Estoppel', chapter: 'Ch3', sourceFile: 'LAW7054-Poole-Ch3-Consideration.md', after: ['contract-agreement.acceptance'],
    subs: [
      ['debate', 'The Debate About Consideration', '§3.1 — The Debate About Consideration', ['why consideration is required', 'reliance-based alternatives'], ['Edmonds v Lawson', 'Antons Trawling v Smith'], []],
      ['definitions', 'Identifying Consideration', '§3.2 — Identifying Consideration: Definitions', ['benefit and detriment', 'executory v executed', 'must move from promisee'], ['Currie v Misa', 'Dunlop v Selfridge', 'Thomas v Thomas'], ['Contracts (Rights of Third Parties) Act 1999']],
      ['sufficiency', 'Sufficient but Need Not Be Adequate', '§3.3 — Sufficient but Need Not Be Adequate', ['sufficiency v adequacy', 'peppercorn', 'motive'], ['Chappell v Nestlé', 'White v Bluett'], []],
      ['past-consideration', 'Past Consideration', '§3.3.3 — Past Consideration', ['past consideration is no consideration', 'previous request device'], ['Roscorla v Thomas', 'Re McArdle', 'Pao On v Lau Yiu Long', 'Lampleigh v Brathwait'], ['Bills of Exchange Act 1882'], { pre: ['sufficiency'] }],
      ['existing-duties', 'Performance of Existing Duties', '§3.4 — Performance of Existing Duties', ['duty imposed by law', 'duty to third party', 'duty to promisor'], ['Collins v Godefroy', 'Glasbrook v Glamorgan CC', 'Scotson v Pegg', 'Stilk v Myrick'], [], { pre: ['sufficiency'] }],
      ['roffey', 'Practical Benefit: Williams v Roffey', '§3.4.4 — Duty Owed to the Promisor (Category c) — The Critical Section', ['practical benefit', 'no duress or fraud', 'limits of Roffey'], ['Williams v Roffey Bros', 'Stilk v Myrick', 'Re Selectmove'], []],
      ['alteration-promises', 'Alteration Promises: Pay More, Accept Less', '§3.5–3.6 — Alteration Promises: Pay More vs Accept Less', ['part payment of a debt', 'Pinnel\'s rule', 'Foakes v Beer', 'MWB v Rock Advertising'], ['Pinnel\'s Case', 'Foakes v Beer', 'MWB v Rock Advertising', 'Re Selectmove'], []],
      ['future-of-consideration', 'The Future of Consideration', '§3.7 — The Future of Consideration', ['reform debate', 'reliance-based enforceability'], ['Antons Trawling v Smith'], [], { pre: ['alteration-promises'] }],
      ['estoppel-origins', 'Promissory Estoppel: Origins and High Trees', '§3.8 — Promissory Estoppel', ['equitable estoppel', 'Hughes v Metropolitan Railway', 'High Trees'], ['Hughes v Metropolitan Railway', 'Central London Property Trust v High Trees', 'Tool Metal v Tungsten Electric'], [], { pre: ['alteration-promises'] }],
      ['estoppel-requirements', 'Requirements for Promissory Estoppel', '§3.8.3 — Requirements for Promissory Estoppel to Operate', ['clear and unequivocal promise', 'reliance', 'inequitable to resile', 'shield not sword'], ['Combe v Combe', 'Woodhouse v Nigerian Produce', 'D & C Builders v Rees'], []],
      ['estoppel-effect', 'Suspending or Extinguishing Rights', '§3.8.5 — Suspending or Extinguishing Rights?', ['suspensory effect', 'giving notice to revive rights'], ['Tool Metal v Tungsten Electric', 'Ogilvy v Hope Davies'], []],
      ['estoppel-future', 'Australian Estoppel and English Law', '§3.8.6 — The Future: Australian Estoppel and English Law', ['sword v shield', 'reform of estoppel'], ['Waltons Stores v Maher', 'Commonwealth of Australia v Verwayen'], []],
    ],
  }),
  D({
    id: 'contract-intention', title: 'Ch4: Intention to Create Legal Relations', chapter: 'Ch4', sourceFile: 'LAW7054-Poole-Ch4-Intention.md', after: ['contract-consideration.estoppel-requirements'],
    subs: [
      ['context', 'Intention to Be Legally Bound', '§4.1 Intention to Be Legally Bound: The Context', ['objective intention', 'presumptions'], [], []],
      ['domestic', 'Social and Domestic Arrangements', '§4.2.1 Social and Domestic Arrangements', ['presumption against intention', 'husband and wife', 'rebutting the presumption'], ['Balfour v Balfour', 'Merritt v Merritt', 'Jones v Padavatton', 'Parker v Clark'], []],
      ['commercial', 'Commercial Agreements', '§4.2.2 Commercial Agreements', ['presumption of intention', 'advertising puffs', 'comfort letters', 'honour clauses'], ['Carlill v Carbolic Smoke Ball', 'Rose & Frank v Crompton', 'Esso v Customs and Excise', 'Kleinwort Benson v Malaysia Mining'], []],
      ['contextual', 'A Contextual Approach', '§4.3 A Contextual Approach', ['context over fixed categories', 'Edmonds v Lawson'], ['Edmonds v Lawson', 'Blue v Ashley'], [], { pre: ['domestic', 'commercial'] }],
      ['formalities', 'Formalities', '§4.4 Formalities (Brief Summary)', ['writing requirements', 'land contracts', 'electronic signatures'], ['Neocleous v Rees'], ['Law of Property (Miscellaneous Provisions) Act 1989', 'Electronic Communications Act 2000'], { pre: ['context'] }],
      ['capacity', 'Contractual Capacity', '§4.5 Contractual Capacity (Brief Summary)', ['minors', 'mental incapacity', 'intoxication'], ['Nash v Inman', 'Imperial Loan v Stone'], ['Minors\' Contracts Act 1987', 'Mental Capacity Act 2005'], { pre: ['context'] }],
    ],
  }),
  D({
    id: 'contract-terms', title: 'Week 4: Terms of Contract', chapter: 'W4', sourceFile: 'LAW7054-Contract-W4-Terms-of-Contract.md', after: ['contract-intention.contextual'],
    subs: [
      ['express-implied', 'Express and Implied Terms', 'Terms of Contract 1: Express and Implied Terms', ['express terms', 'implied terms'], ['Jones v Associated Tunnelling'], []],
      ['terms-vs-representations', 'Terms and Representations', 'Terms and Representations', ['term v mere representation', 'importance, expertise, reliance'], ['Bannerman v White', 'Dick Bentley v Smith (Motors)', 'Oscar Chess v Williams'], [], { pre: ['express-implied'] }],
      ['incorporation', 'Incorporation of Terms', 'Incorporation of Terms', ['signature', 'reasonable notice', 'previous dealing', 'onerous or unusual terms'], ['L\'Estrange v Graucob', 'Parker v South Eastern Railway', 'Olley v Marlborough Court', 'Interfoto v Stiletto', 'McCutcheon v MacBrayne'], [], { pre: ['terms-vs-representations'] }],
      ['classification', 'Classification of Terms', 'Classification of Terms', ['condition', 'warranty', 'innominate term'], ['Poussard v Spiers and Pond', 'Bettini v Gye', 'Hong Kong Fir v Kawasaki', 'Cehave v Bremer (The Hansa Nord)'], [], { pre: ['terms-vs-representations'] }],
      ['implied-terms', 'Implied Terms', 'Implied Terms', ['implied in fact', 'business efficacy', 'implied by law'], ['Hillas v Arcos', 'British Crane Hire v Ipswich Plant Hire'], [], { pre: ['express-implied'] }],
    ],
  }),
  D({
    id: 'contract-mistake', title: 'Ch8: Mistake', chapter: 'Ch8', sourceFile: 'LAW7054-Poole-Ch8-Mistake.md', after: ['contract-terms.incorporation', 'contract-terms.classification'],
    subs: [
      ['classes', 'Classes of Mistake', '§8.1 Classes of Mistake', ['common, mutual, unilateral', 'operative mistake makes contract void'], [], ['Sale of Goods Act 1979']],
      ['mutual', 'Mutual Mistake (Cross-Purposes)', '§8.2 Mutual Mistake (Cross-Purposes)', ['objective test', 'ambiguity'], ['Raffles v Wichelhaus', 'Scriven Bros v Hindley', 'Smith v Hughes'], []],
      ['unilateral', 'Unilateral Mistake', '§8.3 Unilateral Mistake', ['mistake as to a term', 'other party knows', 'identity mistakes'], ['Hartog v Colin & Shields', 'Phillips v Brooks', 'Lewis v Averay', 'Cundy v Lindsay', 'Shogun Finance v Hudson'], []],
      ['common', 'Common Mistake', '§8.4 Common Mistake', ['res extincta', 'res sua', 'mistake as to quality', 'Great Peace test'], ['Bell v Lever Bros', 'Great Peace Shipping v Tsavliris', 'Couturier v Hastie', 'McRae v Commonwealth Disposals'], ['Sale of Goods Act 1979'], { pre: ['classes'] }],
      ['equity', 'The Equitable Jurisdiction (Solle v Butcher)', '§8.5 The Equitable Jurisdiction — Rise and Fall', ['rescission in equity', 'denied by Great Peace'], ['Solle v Butcher', 'Great Peace Shipping v Tsavliris'], [], { pre: ['common'] }],
      ['documents', 'Mistakes in Documents', '§8.6 Mistakes in Documents', ['rectification', 'non est factum', 'correcting by construction'], ['Chartbrook v Persimmon Homes', 'Saunders v Anglia Building Society'], [], { pre: ['classes'] }],
    ],
  }),
];
