// LAW7053 Legal Foundations (Rutherford) — Spring. Extracted from vault headings.
import { makeDistrict } from '../../logic/curriculum.js';

const D = (spec) => makeDistrict({ tutor: 'chen', ...spec });

export const foundationsDistricts = [
  D({
    id: 'found-sources', title: 'Week 0: Sources of Law', chapter: 'Week 0', sourceFile: 'LAW7053-Week0-Lecture-Sources-of-Law.md', after: [],
    subs: [
      ['separation-of-powers', 'Separation of Powers', 'Separation of Powers', ['legislature, executive, judiciary', 'overlap of functions'], [], ['Constitutional Reform Act 2005'], { tutor: 'hale' }],
      ['parl-sovereignty', 'Parliamentary Sovereignty', 'Parliamentary Sovereignty', ['Parliament makes or unmakes any law', 'courts cannot question Acts'], ['British Railways Board v Pickin'], [], { tutor: 'hale' }],
      ['conventions', 'Conventions', 'Conventions', ['non-legal constitutional rules', 'political not judicial sanction'], [], [], { tutor: 'hale' }],
      ['statutory-law', 'Sources of Law: Statutory Law', 'Sources of Law Part 1: Statutory Law', ['where legislation comes from', 'bill to Act', 'commencement'], [], ['Interpretation Act 1978', 'Equality Act 2010']],
      ['reading-statutes', 'Reading and Interpreting a Statute', 'Reading and Interpreting a Statute', ['structure of a statute', 'aids to interpretation'], [], []],
      ['common-law', 'Common Law', 'Common Law', ['judge-made law', 'statute vs common law'], [], [], { pre: ['statutory-law'] }],
    ],
  }),
  D({
    id: 'found-what-is-law', title: 'Ch2: What Is Law?', chapter: 'Ch2', sourceFile: 'LAW7053-Rutherford-Ch2-What-Is-Law.md', after: [],
    subs: [
      ['what-is-law', 'What is Law?', '2.1 What is Law?', ['law vs rules', 'jurisdiction', 'commencement of Acts'], [], ['War Crimes Act 1991']],
      ['common-law-meanings', 'Common Law: Three Meanings', '2.1.1 Common Law — Three Meanings', ['common law v civil law', 'common law v equity', 'common law as case law'], [], []],
      ['crime-and-civil', 'Criminal Offences and Civil Wrongs', '2.1.4 Criminal Offences and Civil Wrongs', ['crime v civil wrong', 'state v private party'], [], []],
      ['common-law-equity', 'Common Law and Equity', '2.2 Common Law and Equity', ['case law', 'equity as gloss', 'discretionary remedies'], ['Broome v Cassell', 'Hughes v Metropolitan Railways'], []],
      ['legislative-supremacy', 'Parliamentary / Legislative Supremacy', '2.3 Parliamentary/Legislative Supremacy', ['supremacy', 'enrolled bill rule', 'Parliament Acts'], ['British Railways Board v Pickin', 'Jackson v Attorney General'], ['Human Rights Act 1998', 'Hunting Act 2004'], { tutor: 'hale' }],
      ['uk-eu-echr', 'UK Law, EU Law and the ECHR', '2.3.2 Relationship between UK law and the ECHR', ['section 3 HRA interpretation', 'declaration of incompatibility'], ['Mendoza v Ghaidan', 'Bellinger v Bellinger'], ['Human Rights Act 1998', 'European Communities Act 1972']],
      ['criminal-civil-terms', 'Criminal and Civil Law: Terminology', '2.4 Criminal Law and Civil Law: Terminology, Differences, and Themes', ['burden and standard of proof', 'parties and terminology'], [], [], { pre: ['crime-and-civil'] }],
      ['courts', 'Classification of the Courts', '2.5 Classification of the Courts', ['court structure', 'first instance v appeal', 'criminal v civil courts'], [], ['Senior Courts Act 1981', 'Constitutional Reform Act 2005'], { pre: ['criminal-civil-terms'] }],
      ['legal-bodies', 'Legal Personnel and Bodies', '2.6 Legal Personnel and Bodies', ['Lord Chancellor', 'Attorney General', 'DPP and CPS', 'Law Commission'], [], ['Constitutional Reform Act 2005', 'Prosecution of Offences Act 1985'], { pre: ['courts'] }],
    ],
  }),
  D({
    id: 'found-precedent', title: 'Ch5: Judicial Precedent', chapter: 'Ch5', sourceFile: 'LAW7053-Rutherford-Ch5-Judicial-Precedent.md', after: ['found-what-is-law.common-law-meanings'],
    subs: [
      ['law-reporting', 'Judicial Precedent and Law Reporting', '5.1 Judicial Precedent and Law Reporting', ['stare decisis', 'law reports'], [], []],
      ['judge-made-law', 'The Nature of Judge-Made Law', '5.2 The Nature of Judge-Made Law', ['declaratory theory', 'judicial law-making limits'], ['Kleinwort Benson v Lincoln CC', 'Knuller v DPP', 'R (Nicklinson) v MoJ'], []],
      ['ratio', 'Ratio Decidendi', '5.3 Ratio Decidendi', ['ratio v obiter', 'finding the ratio', 'later cases shape ratio'], ['Donoghue v Stevenson', 'Entores v Miles Far East', 'Brinkibon v Stahag Stahl'], ['Theft Act 1968']],
      ['obiter', 'Obiter Dicta', '5.4 Obiter Dicta', ['persuasive not binding', 'dissents'], ['Partridge v Crittenden', 'Hedley Byrne v Heller'], []],
      ['hierarchy', 'Stare Decisis and the Hierarchy', '5.5 Stare Decisis and the Hierarchy', ['vertical precedent', 'horizontal precedent', 'Practice Statement 1966'], ['London Tramways v LCC', 'Young v Bristol Aeroplane', 'Davis v Johnson'], ['Human Rights Act 1998']],
      ['avoiding', 'Methods of Avoiding Precedents', '5.6 Methods of Avoiding Precedents', ['overruling', 'reversing', 'distinguishing'], ['Anns v Merton', 'Murphy v Brentwood', 'Balfour v Balfour', 'Merritt v Merritt'], []],
      ['case-analysis', 'Case Analysis Template', '5.8 Case Analysis — Template', ['facts, issue, ratio, obiter', 'reasoning from authority'], [], []],
    ],
  }),
  D({
    id: 'found-legislation', title: 'Ch3: Legislation and Law-Making', chapter: 'Ch3', sourceFile: 'LAW7053-Rutherford-Ch3-Legislation-and-Law-Making.md', after: ['found-what-is-law.legislative-supremacy'],
    subs: [
      ['parliament', 'Parliament', '3.1 Parliament', ['Commons', 'Lords', 'Crown in Parliament'], [], ['House of Lords Act 1999', 'Life Peerages Act 1958']],
      ['primary-legislation', 'Primary Legislation', '3.2 Primary Legislation', ['public and private Acts', 'constitutional v ordinary statutes'], ['Thoburn v Sunderland CC'], []],
      ['passage', 'Passage of Legislation', '3.3 The Passage of Legislation Through Parliament', ['five stages', 'scrutiny limits', 'EVEL'], [], ['Coroners and Justice Act 2009']],
      ['parliament-acts', 'Parliament Act Procedure', '3.4 Parliament Act Procedure', ['money bills', 'one-year delay', 'Lords veto'], ['Jackson v Attorney General'], ['Parliament Act 1911', 'Parliament Act 1949']],
      ['delegated', 'Secondary / Delegated Legislation', '3.5 Secondary/Delegated Legislation', ['forms', 'necessity', 'dangers', 'controls'], ['R (H) v Mental Health Review Tribunal'], ['Statutory Instruments Act 1946', 'Legislative and Regulatory Reform Act 2006']],
    ],
  }),
  D({
    id: 'found-interpretation', title: 'Ch4: Statutory Interpretation', chapter: 'Ch4', sourceFile: 'LAW7053-Rutherford-Ch4-Statutory-Interpretation.md', after: ['found-precedent.ratio', 'found-legislation.primary-legislation'],
    subs: [
      ['language', 'Problems of Language', '4.1 Problems of Language', ['ambiguity and vagueness', 'unforeseen developments'], ['Fisher v Bell', 'Royal College of Nursing v DHSS'], ['Abortion Act 1967']],
      ['preliminary', 'Preliminary Issues', '4.2 Preliminary Issues', ['courts and parliamentary purpose', 'material beyond the statute'], ['Maunsell v Olins', 'Jones v DPP'], []],
      ['literal', 'The Literal Rule', '4.3.1 The Literal Rule', ['ordinary meaning', 'absurdity risk'], ['Fisher v Bell', 'Duport Steels v Sirs'], []],
      ['golden', 'The Golden Rule', '4.3.2 The Golden Rule', ['narrow v wide golden rule', 'avoid absurdity'], ['Adler v George', 'Grey v Pearson'], []],
      ['mischief', 'The Mischief Rule', '4.3.3 The Mischief Rule', ['four Heydon questions', 'remedy the mischief'], ["Heydon's Case", 'Smith v Hughes'], ['Street Offences Act 1959']],
      ['purposive', 'Contextual and Purposive Approach', '4.3.5 The Contextual and Purposive Approach', ['purpose of the Act', 'reading words in and out'], ['Maunsell v Olins', 'R (Quintavalle) v SSH', 'Isle of Wight v Platt'], []],
      ['aids', 'Aids to Construction', '4.4 Aids to Construction', ['intrinsic aids', 'extrinsic aids', 'Hansard'], ['Pepper v Hart', 'Davis v Johnson'], ['Interpretation Act 1978']],
      ['language-rules', 'Rules of Language', '4.5 Rules of Language', ['expressio unius', 'ejusdem generis', 'noscitur a sociis'], ['Powell v Kempton Park', 'Pengelley v Bell Punch'], []],
      ['presumptions', 'Presumptions of Statutory Intent', '4.6 Presumptions of Statutory Intent', ['mens rea presumption', 'no retrospectivity', 'ousters of jurisdiction'], ['Sweet v Parsley', 'Anisminic v FCC'], []],
      ['hra-eu', 'Interpretation, the EU and the HRA', '4.8 Interpretation and the Human Rights Act 1998', ['section 3 HRA', 'Brexit position'], ['Ghaidan v Godin-Mendoza'], ['Human Rights Act 1998']],
    ],
  }),
  D({
    id: 'found-judiciary', title: 'Ch8: The Judiciary', chapter: 'Ch8', sourceFile: 'LAW7053-Rutherford-Ch8-The-Judiciary.md', after: ['found-what-is-law.courts', 'found-precedent.hierarchy'],
    subs: [
      ['hierarchy', 'The Judicial Hierarchy', '8.1 The Judicial Hierarchy', ['judicial offices', 'eligibility'], [], ['Senior Courts Act 1981', 'Courts Act 1971']],
      ['appointment', 'Appointment of Judges', '8.2 The Appointment of Judges', ['Judicial Appointments Commission', 'diversity'], [], ['Constitutional Reform Act 2005', 'Crime and Courts Act 2013']],
      ['removal', 'Removal and Retirement', '8.3 Removal and Retirement', ['security of tenure', 'retirement age'], [], ['Senior Courts Act 1981']],
      ['independence', 'Judicial Independence', '8.4 Judicial Independence', ['five protections', 'immunity', 'bias'], ['Sirros v Moore', 'Dimes v Grand Junction Canal'], ['Constitutional Reform Act 2005'], { tutor: 'hale' }],
      ['governance', 'Governance of the Judiciary', '8.5 Governance of the Judiciary', ['training', 'judicial conduct'], [], []],
    ],
  }),
  D({
    id: 'found-personnel', title: 'Ch9: Legal Personnel', chapter: 'Ch9', sourceFile: 'LAW7053-Rutherford-Ch9-Legal-Personnel.md', after: ['found-judiciary.hierarchy'],
    subs: [
      ['two-branches', 'The Two Branches', '9.1 The Two Branches', ['solicitor v barrister', 'split profession'], [], ['Legal Services Act 2007']],
      ['solicitors', 'Solicitors', '9.2 Solicitors', ['reserved legal activities', 'SQE route', 'SRA regulation', 'liability'], ['White v Jones'], ['Legal Services Act 2007']],
      ['barristers', 'Barristers', '9.3 Barristers', ['cab rank rule', 'pupillage', 'advocates immunity'], ['Rondel v Worsley', 'Arthur JS Hall v Simons'], []],
      ['clementi', 'Clementi Review and the Legal Services Act 2007', '9.4 The Clementi Review and the Legal Services Act 2007', ['Legal Services Board', 'Legal Ombudsman', 'alternative business structures'], [], ['Legal Services Act 2007'], { pre: ['solicitors', 'barristers'] }],
      ['fusion', 'The Fusion Debate', '9.5 The Fusion Debate', ['arguments for and against fusion'], [], []],
      ['additional', 'Additional Legal Professionals', '9.6 Additional Legal Professionals', ['CILEx', 'licensed conveyancers', 'paralegals'], [], [], { pre: ['two-branches'] }],
    ],
  }),
];
