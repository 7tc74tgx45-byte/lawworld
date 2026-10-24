// LAW7055 Public Law (Stanton & Prescott; Bingham) — Winter. Extracted from vault headings.
// Chain per VISION §2: Constitution → Separation of Powers → Rule of Law → Sovereignty → JR → HRA.
// The vault has no dedicated judicial review note; JR content is only inside the Rule of Law
// chapter (§3.6.1), so the JR subsection points there. No invented JR cases are added.
import { makeDistrict } from '../../logic/curriculum.js';

const D = (spec) => makeDistrict({ tutor: 'hale', ...spec });

export const publicLawDistricts = [
  D({
    id: 'pl-constitution', title: 'Ch1: The UK Constitution', chapter: 'Ch1', sourceFile: 'LAW7055-Stanton-Prescott-Ch1-UK-Constitution.md', after: [], tutor: 'chen',
    subs: [
      ['framework', 'Public Law: The Framework', '1.1 Public Law — The Framework', ['public v private law', 'state and individual'], [], []],
      ['constitutions', 'Constitutions: Definitions and Origins', '1.2 Constitutions: Definitions and Origins', ['what a constitution does', 'written v unwritten'], [], []],
      ['nature', 'The Nature of the UK Constitution', '1.3 The Nature of the UK Constitution', ['uncodified', 'legal v political constitution', 'structure'], [], ['Constitutional Reform Act 2005']],
      ['history', 'Historical Development and Sources', '1.4 Historical Development and Sources', ['allocation of sovereign power', 'devolution', 'protection of rights'], ['Jackson v Attorney General', 'Malone v Metropolitan Police Commissioner'], ['Human Rights Act 1998', 'Scotland Act 1998', 'European Communities Act 1972']],
      ['conventions', 'Constitutional Conventions', '1.5 Constitutional Conventions', ['conventions v law', 'Sewel-type conventions', 'enforcement'], ['R (Miller) v Secretary of State'], []],
      ['does-uk-have', 'Does the UK Have a Constitution?', '1.6 Does the UK Have a Constitution?', ['uncodified but real'], [], []],
    ],
  }),
  D({
    id: 'pl-separation', title: 'Ch2: Institutions and Separation of Powers', chapter: 'Ch2', sourceFile: 'LAW7055-Stanton-Prescott-Ch2-Separation-of-Powers.md', after: ['pl-constitution.nature'],
    subs: [
      ['three-principles', 'The Three Constitutional Principles', '2.1 The Three Constitutional Principles', ['separation of powers', 'rule of law', 'parliamentary sovereignty'], [], []],
      ['institutions', 'Legislature, Executive and Judiciary', '2.2 Legislature', ['Parliament', 'government', 'courts'], [], ['Cities and Local Government Devolution Act 2016']],
      ['separation-theory', 'The Separation of Powers: Theory', '2.5 The Separation of Powers', ['definitions', 'justifications', 'pure v partial'], ['R (Evans) v Attorney-General'], []],
      ['leg-exec', 'Legislature and Executive', '2.6.1 Legislature ↔ Executive', ['ministers sit in Parliament', 'delegated powers'], [], ['House of Commons Disqualification Act 1975']],
      ['leg-jud', 'Legislature and Judiciary', '2.6.2 Legislature ↔ Judiciary', ['interpretation under HRA', 'ouster clauses', 'Parliament Acts'], ['Ghaidan v Godin-Mendoza', 'Anisminic v Foreign Compensation Commission', 'Burmah Oil v Lord Advocate'], ['Constitutional Reform Act 2005', 'Hunting Act 2004']],
      ['exec-jud', 'Executive and Judiciary', '2.6.3 Executive ↔ Judiciary', ['judicial review of executive', 'injunctions against ministers'], ['Entick v Carrington', 'Re M', 'R (Miller) v Prime Minister', 'McGonnell v United Kingdom'], ['Crime and Courts Act 2013']],
      ['partial-sep', 'A Partial Separation in the UK', '2.7 A Partial Separation of Powers in the UK', ['overall assessment', 'checks and balances'], ['Council of Civil Service Unions v Minister for the Civil Service'], [], { pre: ['leg-exec', 'leg-jud', 'exec-jud'] }],
    ],
  }),
  D({
    id: 'pl-rule-of-law', title: 'Ch3: The Rule of Law', chapter: 'Ch3', sourceFile: 'LAW7055-Stanton-Prescott-Ch3-Rule-of-Law.md', after: ['pl-separation.separation-theory'],
    subs: [
      ['defining', 'Defining the Rule of Law', '§3.2 Defining the Rule of Law', ['origins', 'global reach'], [], []],
      ['formal-substantive', 'Formal and Substantive Conceptions', '§3.3 Conceptualising the Rule of Law', ['Raz', 'Hayek', 'Bingham', 'Allan', 'Dworkin'], [], []],
      ['in-the-uk', 'The Rule of Law in the UK', '§3.4 The Rule of Law in the UK', ['Dicey\'s three elements', 'criticism of Dicey'], [], ['Constitutional Reform Act 2005']],
      ['government-by-law', 'Government According to Law', '§3.5.1 The \'Basic Expression\' of the Rule of Law in the UK', ['executive needs lawful authority', 'equal application of law'], ['Entick v Carrington', 'IRC v Rossminster', 'A v Secretary of State for the Home Department', 'M v Home Office'], ['Crown Proceedings Act 1947']],
      ['formal-uk', 'The Formal Conception in the UK', '§3.5.2 The Formal Conception in the UK', ['clarity and accessibility', 'access to justice'], ['R (Anufrijeva) v SSHD', 'R (Reilly (No 2)) v SSWP', 'R (Unison) v Lord Chancellor'], []],
      ['substantive-uk', 'The Substantive Conception in the UK', '§3.5.3 The Substantive Conception in the UK', ['constitutional rights at common law', 'access to courts'], ['R v Lord Chancellor, ex parte Witham', 'R (Bourgass) v SSJ'], []],
      ['rol-and-executive', 'Rule of Law, Executive Power and Judicial Review', '§3.6.1 Rule of Law, Executive Power and Judicial Review', ['judicial review overview', 'limits on executive power', 'national security'], ['Wheeler v Leicester CC', 'ex parte Pierson', 'Liversidge v Anderson'], []],
      ['rol-and-legislature', 'The Rule of Law and the Legislative Function', '§3.6.2 The Rule of Law and the Legislative Function', ['Dicey: sovereignty and rule of law', 'can Parliament legislate contrary to rule of law', 'retrospective legislation'], ['Burmah Oil v Lord Advocate', 'R (Evans) v Attorney-General', 'Anisminic v FCC'], ['War Damages Act 1965'], { pre: ['formal-uk', 'substantive-uk'] }],
      ['rol-human-rights', 'The Role of Human Rights', '§3.6.3 The Role of Human Rights', ['civil liberties to positive rights', 'Malone to Belmarsh'], ['Malone v Metropolitan Police Commissioner', 'A v Secretary of State for the Home Department'], ['Human Rights Act 1998']],
    ],
  }),
  D({
    id: 'pl-bingham', title: 'Bingham: The Rule of Law', chapter: 'Bingham', sourceFile: 'Bingham - Rule of Law.md', after: ['pl-rule-of-law.formal-substantive'],
    subs: [
      ['importance', 'Ch1 — The Importance of the Rule of Law', '# Chapter 1 — The Importance of the Rule of Law', ['Dicey\'s three meanings', 'is the concept meaningless'], [], ['Constitutional Reform Act 2005']],
      ['history', 'Ch2 — Some History', '# Chapter 2 — Some History', ['Magna Carta', 'habeas corpus', 'Bill of Rights 1689'], [], ['Habeas Corpus Amendment Act 1679']],
      ['accessibility', 'Ch3 — The Accessibility of Law', '# Chapter 3 — The Accessibility of Law', ['intelligible and predictable', 'statute and judge-made law'], [], []],
      ['law-not-discretion', 'Ch4 — Law Not Discretion', '# Chapter 4 — Law Not Discretion', ['limits on discretionary power'], [], []],
      ['equality', 'Ch5 — Equality Before the Law', '# Chapter 5 — Equality Before the Law', ['laws apply equally', 'discrimination against non-nationals'], [], ['Crime and Security Act 2001']],
      ['exercise-of-power', 'Ch6 — The Exercise of Power', '# Chapter 6 — The Exercise of Power', ['judicial review', 'good faith and reasonableness'], [], []],
      ['human-rights', 'Ch7 — Human Rights', '# Chapter 7 — Human Rights', ['Raz\'s challenge', 'ECHR Articles via HRA'], [], ['Human Rights Act 1998']],
      ['dispute-resolution', 'Ch8 — Dispute Resolution', '# Chapter 8 — Dispute Resolution', ['access to courts', 'legal aid'], [], ['Legal Aid and Advice Act 1949']],
      ['fair-trial', 'Ch9 — A Fair Trial', '# Chapter 9 — A Fair Trial', ['equality of arms', 'judicial independence', 'special advocates'], [], ['Constitutional Reform Act 2005']],
      ['international', 'Ch10 — The International Legal Order', '# Chapter 10 — The Rule of Law in the International Legal Order', ['international law compliance', 'war and the rule of law'], [], []],
      ['terrorism', 'Ch11 — Terrorism and the Rule of Law', '# Chapter 11 (Part 3) — Terrorism and the Rule of Law', ['detention without trial', 'UK/US divergence'], [], ['Crime and Security Act 2001']],
    ].map((t, i) => {
      // Chapters are read in book order, but several only need Ch1 first.
      const pre = { fair_trial: ['law-not-discretion'], international: ['human-rights'], terrorism: ['equality'] };
      const extra = { 'fair-trial': pre.fair_trial, international: pre.international, terrorism: pre.terrorism }[t[0]];
      return i === 0 ? t : [...t, { pre: extra || ['importance'] }];
    }),
  }),
  D({
    id: 'pl-w5-rol-sop', title: 'Week 5: Rule of Law and Separation of Powers (lecture)', chapter: 'W5', sourceFile: 'LAW7055-W5-Lecture-Rule-of-Law-Separation-of-Powers.md', after: ['pl-rule-of-law.formal-substantive', 'pl-separation.separation-theory'],
    subs: [
      ['definition', 'Formal vs Substantive; Dicey', 'Part 1: The Rule of Law', ['formal v substantive', 'Dicey\'s three parts'], [], []],
      ['bingham-rules', 'Bingham\'s Eight Rules', 'Bingham\'s Eight Rules (substantive conception)', ['eight sub-rules', 'cases by rule'], ['A v Secretary of State for the Home Department', 'R (Unison) v Lord Chancellor', 'R (Evans) v Attorney General'], ['Courts and Enforcement Act 2007']],
      ['ouster-clauses', 'Ouster Clauses', 'Ouster Clauses (Rules 3 & 5 — access to courts / judicial oversight)', ['ouster clauses', 'access to courts'], ['Anisminic v FCC', 'R (Privacy International) v IPT'], ['Foreign Compensation Act 1950']],
      ['rol-and-sovereignty', 'Rule of Law and Parliamentary Supremacy', 'Rule of Law and Parliamentary Supremacy', ['tension between the two'], ['R (Unison) v Lord Chancellor', 'Jackson v AG'], [], { pre: ['bingham-rules', 'pl-sovereignty.limbs'] }],
      ['sop', 'Separation of Powers: Pure vs Partial', 'Part 2: Separation of Powers', ['ministers and Parliament', 'legislative and judicial powers of ministers', 'scrutiny'], ['R (Anderson) v SSHD'], ['House of Commons Disqualification Act 1975'], { pre: ['definition'] }],
      ['judicial-independence', 'Judicial Independence and CRA 2005', 'Judicial Independence', ['Parliament and the judges', 'CRA 2005'], ['Jackson v AG'], ['Constitutional Reform Act 2005'], { pre: ['sop'] }],
    ],
  }),
  D({
    id: 'pl-sovereignty', title: 'Ch4: Parliamentary Sovereignty', chapter: 'Ch4', sourceFile: 'LAW7055-Stanton-Prescott-Ch4-Parliamentary-Sovereignty.md', after: ['pl-rule-of-law.rol-and-legislature'],
    subs: [
      ['introduction', 'Introduction to Sovereignty', '4.1 Introduction', ['Dicey\'s orthodox theory'], [], []],
      ['constitutional-supremacy', 'Constitutional Supremacy (Contrast)', '4.2 Constitutional Supremacy', ['written constitution', 'judicial review of statutes'], ['Marbury v Madison'], []],
      ['why-sovereign', 'Why Is Parliament Sovereign?', '4.3 Why Is Parliament Sovereign?', ['historical development', 'Wade', 'Jennings', 'Goldsworthy'], [], []],
      ['limbs', 'The Positive and Negative Limbs', '4.4 Parliamentary Sovereignty Explored', ['can make any law', 'no body can question an Act', 'enrolled bill rule'], ['R (Jackson) v Attorney-General', 'Pickin v British Railways Board', 'Edinburgh and Dalkeith Railway v Wauchope', 'Madzimbamuto v Lardner-Burke'], ['Human Rights Act 1998']],
      ['implied-repeal', 'No Binding Successors: Implied Repeal', '4.4.3 No Parliament Is Bound by Its Predecessors or Can Bind Its Successors', ['implied repeal', 'continuing v self-embracing sovereignty'], ['Vauxhall Estates v Liverpool Corporation', 'Ellen Street Estates v Minister of Health'], []],
      ['courts-today', 'The Courts and Sovereignty Today', '4.5 The Courts and Parliamentary Sovereignty Today', ['Jackson', 'HS2', 'Miller 2', 'common law constitutionalism'], ['R (Jackson) v Attorney-General', 'R (HS2 Action Alliance) v SSfT', 'R (Miller) v Prime Minister'], ['Parliament Act 1949', 'Hunting Act 2004'], { pre: ['implied-repeal'] }],
    ],
  }),
  D({
    id: 'pl-entrenchment', title: 'Entrenchment and Manner and Form', chapter: 'Extra', sourceFile: 'LAW7055-Entrenchment-and-Manner-and-Form.md', after: ['pl-sovereignty.implied-repeal'],
    subs: [
      ['orthodox', 'The Orthodox Position: No Entrenchment', '1. The orthodox position: entrenchment is impossible', ['implied repeal', 'no binding successors'], ['Vauxhall Estates v Liverpool Corporation', 'Ellen Street Estates v Minister of Health', 'British Coal Corporation v The King'], ['Acquisition of Land Act 1919']],
      ['self-embracing', 'Self-Embracing Sovereignty', '2. The challenge: self-embracing sovereignty', ['Jennings', 'Parliament can redefine itself'], [], []],
      ['manner-form', 'The Manner and Form Authorities', '3. The manner and form authorities', ['redefining the legislature', 'colonial limitation'], ['AG of New South Wales v Trethowan', 'Harris v Minister for the Interior', 'Bribery Commissioner v Ranasinghe'], ['Colonial Laws Validity Act 1865']],
      ['jackson', 'Jackson v Attorney-General: the Westminster Crack', '4. *Jackson v Attorney-General* [2005] UKHL 56 — the Westminster crack', ['Parliament Act 1911 as delegated power', 'obiter remarks on limits'], ['Jackson v Attorney General', 'AXA General Insurance v Lord Advocate'], ['Parliament Act 1911']],
      ['current-position', 'The Current UK Position on Entrenchment', '5. The current UK position on entrenchment', ['constitutional statutes', 'no true entrenchment'], ['Thoburn v Sunderland City Council', 'R (HS2 Action Alliance) v SSfT', 'MacCormick v Lord Advocate'], ['Scotland Act 1998']],
    ],
  }),
  D({
    id: 'pl-government', title: 'Ch7: Central Government', chapter: 'Ch7', sourceFile: 'LAW7055-Stanton-Prescott-Ch7-Central-Government.md', after: ['pl-separation.leg-exec'],
    subs: [
      ['pm', 'The Prime Minister', '7.1 The Prime Minister', ['role of PM', 'prerogative powers'], ['R (Miller) v PM'], []],
      ['ministers', 'Appointment and Dismissal of Ministers', '7.2 Appointment and Dismissal of Ministers', ['ministerial appointment', 'salaries'], [], ['Ministerial and Other Salaries Act 1975']],
      ['cabinet', 'Cabinet', '7.3 Cabinet', ['cabinet government', 'cabinet secrecy'], [], ['Freedom of Information Act 2000']],
      ['departments', 'Government Departments', '7.4 Government Departments', ['departments and Carltona principle'], ['Carltona v Commissioners of Works'], []],
      ['accountability', 'Political Accountability to Parliament', '7.5 Political Accountability to Parliament', ['accountability mechanisms'], ['R (Miller) v PM'], []],
      ['collective', 'Collective Responsibility', '7.6 Collective Responsibility', ['cabinet unity', 'confidence'], [], []],
      ['imr', 'Individual Ministerial Responsibility', '7.7 Individual Ministerial Responsibility (IMR)', ['resignation convention', 'answerability'], ['Mitchell v News Group Newspapers'], []],
      ['civil-service', 'Special Advisers and the Civil Service', '7.9 Civil Service', ['impartiality', 'special advisers'], [], ['Constitutional Reform and Governance Act 2010']],
      ['public-bodies', 'Public Bodies', '7.10 Public Bodies', ['arm\'s-length bodies'], [], []],
    ],
  }),
  D({
    id: 'pl-parliament', title: 'Ch8: Parliament', chapter: 'Ch8', sourceFile: 'LAW7055-Stanton-Prescott-Ch8-Parliament.md', after: ['pl-sovereignty.limbs'],
    subs: [
      ['functions', 'Functions of Parliament', '8.1 Functions of Parliament', ['legislate, scrutinise, represent'], [], []],
      ['life', 'Life of a Parliament', '8.2 Life of a Parliament', ['dissolution', 'fixed terms'], ['R (Miller) v PM'], ['Dissolution and Calling of Parliament Act 2022', 'Fixed-term Parliaments Act 2011']],
      ['commons', 'House of Commons', '8.3 House of Commons', ['elections', 'disqualification', 'recall'], ['Hirst v UK (No 2)'], ['Representation of the People Act 1983', 'Recall of MPs Act 2015']],
      ['lords', 'House of Lords', '8.5 House of Lords', ['composition', 'reform'], [], ['House of Lords Act 1999', 'Life Peerages Act 1958']],
      ['primary-legislation', 'Primary Legislation', '8.6 Primary Legislation', ['bill stages', 'Royal Assent'], [], ['Royal Assent Act 1967']],
      ['lords-powers', 'Powers of the Lords and Conventions', '8.7 Powers of the Lords and Conventions', ['Parliament Acts', 'Salisbury convention'], ['R (Jackson) v Attorney-General'], ['Parliament Act 1911', 'Parliament Act 1949']],
      ['delegated', 'Secondary (Delegated) Legislation', '8.8 Secondary (Delegated) Legislation', ['affirmative and negative procedure', 'Henry VIII powers'], [], ['Statutory Instruments Act 1946']],
      ['scrutiny', 'Scrutiny of Government', '8.9 Scrutiny of Government', ['questions', 'select committees'], [], [], { pre: ['functions'] }],
    ],
  }),
  D({
    id: 'pl-hra', title: 'Parliamentary Supremacy and the Human Rights Act 1998', chapter: 'W2/W3', sourceFile: 'LAW7055-W2-Parliamentary-Supremacy-HRA-Pt2.md', after: ['pl-sovereignty.limbs', 'pl-rule-of-law.rol-human-rights', 'pl-rule-of-law.rol-and-executive'],
    subs: [
      ['background', 'Background to the HRA 1998', 'Background to HRA 1998', ['why the HRA was enacted', 'ECHR rights at home'], [], ['Human Rights Act 1998']],
      ['s19', 's.19 — Statement of Compatibility', 's.19 — Statement of Compatibility', ['ministerial statement', 'bills that cannot be certified'], [], ['Human Rights Act 1998']],
      ['s3', 's.3 — Interpreting Legislation', 's.3 — Interpreting Legislation', ['read and give effect so far as possible', 'limits of s.3'], ['Fitzpatrick v Sterling Housing Association', 'Ghaidan v Godin-Mendoza', 'Bellinger v Bellinger', 'R (Anderson) v SSHD'], ['Human Rights Act 1998']],
      ['s4', 's.4 — Declarations of Incompatibility', 's.4 — Declarations of Incompatibility', ['declaration does not strike down statute', 'parliament decides response'], ['A and Others v SSHD', 'R (Nicklinson) v Ministry of Justice', 'Sheldrake v DPP'], ['Human Rights Act 1998']],
      ['s10', 's.10 — Remedial Orders', 's.10 — Remedial Orders', ['fast-track amendment', 'examples'], ['Hirst v UK (No 2)', 'Smith v Scott', 'R (Chester) v SSJ'], ['Human Rights Act 1998']],
      ['hra-and-sovereignty', 'How the HRA Squares with Sovereignty', 'HRA 1998 and Parliamentary Supremacy — Summary', ['sovereignty preserved', 'reform of HRA'], [], ['Human Rights Act 1998'], { pre: ['s3', 's4', 's10'] }],
    ],
  }),
  D({
    id: 'pl-workshops-w1', title: 'Workshop W1: Human Rights & Public Law', chapter: 'WS', sourceFile: 'LAW7055-PublicLaw-W1-Workshop-Prep.md', after: [],
    subs: [
      ['w1', 'Workshop W1: Human Rights & Public Law', 'Workshop Prep — W1', ['ECHR', 'HRA 1998', 'public bodies', 'qualified rights'], [], [], { pre: [], type: 'workshop', workshopFile: 'LAW7055-PublicLaw-W1-Workshop-Prep.md' }],
    ],
  }),
  D({
    id: 'pl-workshops-w2', title: 'Workshop W2: Executive & Parliament', chapter: 'WS', sourceFile: 'LAW7055-PublicLaw-W2-Workshop-Prep.md', after: [],
    subs: [
      ['w2', 'Workshop W2: Executive & Parliament', 'Workshop Prep — W2', ['prerogative powers', 'parliamentary supremacy', 'executive accountability'], [], [], { pre: [], type: 'workshop', workshopFile: 'LAW7055-PublicLaw-W2-Workshop-Prep.md' }],
    ],
  }),
];
