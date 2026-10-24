// LAW7054 Tort (Brennan) — Autumn. Extracted from vault headings.
// Note: the vault's occupiers' liability material is not a standalone note, so no
// Occupiers' Liability district is generated (the 1957 and 1984 Acts are not covered here).
import { makeDistrict } from '../../logic/curriculum.js';

const D = (spec) => makeDistrict({ tutor: 'okafor', ...spec });

export const tortDistricts = [
  D({
    id: 'tort-trespass', title: 'Lecture 1: Trespass to the Person', chapter: 'L1', sourceFile: 'LAW7054-Tort-Lecture1-Trespass-to-Person-Handout.md', after: [],
    subs: [
      ['assault', 'Assault', 'ASSAULT', ['apprehension of immediate violence', 'words and conditional threats'], ['Stephens v Myers', 'Tuberville v Savage', 'Read v Coker'], []],
      ['battery', 'Battery', 'BATTERY', ['direct application of force', 'hostility and everyday contact'], ['Collins v Wilcock', 'Cole v Turner', 'Wilson v Pringle'], []],
      ['false-imprisonment', 'False Imprisonment', 'FALSE IMPRISONMENT', ['total restraint', 'knowledge of confinement', 'reasonable means of escape'], ['Bird v Jones', 'Meering v Grahame-White Aviation', 'Herd v Weardale Steel'], []],
      ['police-prison', 'Police and Prison Cases', 'POLICE AND PRISON CASES', ['lawful arrest', 'kettling', 'prisoners and residual liberty'], ['Austin v Metropolitan Police Commissioner', 'R (Lumba) v Home Secretary', 'Hague v Deputy Governor of Parkhurst Prison'], ['Police and Criminal Evidence Act 1984'], { pre: ['false-imprisonment'] }],
    ],
  }),
  D({
    id: 'tort-duty', title: 'Ch2: Duty of Care', chapter: 'Ch2', sourceFile: 'LAW7054-Tort-Ch2-Duty-of-Care.md', after: [],
    subs: [
      ['introduction', 'Introduction to Duty of Care', '1. Introduction', ['negligence elements', 'duty, breach, damage'], [], []],
      ['neighbour', 'The Neighbour Principle', '2. The Neighbour Principle', ['reasonable foreseeability', 'proximity'], ['Donoghue v Stevenson'], []],
      ['anns', 'The Anns Two-Stage Test', '3. The Anns Two-Stage Test', ['prima facie duty', 'policy limits', 'retreat from Anns'], ['Anns v Merton LBC', 'Murphy v Brentwood DC'], []],
      ['caparo', 'The Caparo Three-Part Test', '4. The Caparo Three-Part Test', ['foreseeability', 'proximity', 'fair, just and reasonable'], ['Caparo Industries v Dickman'], []],
      ['incremental', 'The Incremental Approach', '5. The Incremental Approach', ['established categories', 'analogy', 'Robinson restores ordinary principles'], ['Robinson v Chief Constable of West Yorkshire Police'], []],
      ['public-bodies', 'Public Bodies', '6. Public Bodies', ['statutory powers v duties', 'omissions by public bodies'], ['Stovin v Wise', 'Gorringe v Calderdale MBC', 'Poole BC v GN', 'Phelps v Hillingdon LBC'], []],
      ['omissions', 'Omissions', '7. Omissions', ['no duty to rescue', 'assumption of responsibility', 'creation of danger', 'control of a third party'], ['Smith v Littlewoods', 'Kent v Griffiths', 'Stansbie v Troman', 'Goldman v Hargrave'], [], { pre: ['caparo'] }],
      ['police', 'Police Liability', '8. Police Liability', ['operational acts', 'Hill principle', 'HRA duties'], ['Hill v Chief Constable of West Yorkshire', 'Osman v United Kingdom', 'Michael v Chief Constable of South Wales'], ['Human Rights Act 1998'], { pre: ['public-bodies', 'omissions'] }],
      ['this-claimant', 'Duty to This Claimant', '9. Duty to This Claimant', ['foreseeable claimant', 'unforeseeable victims', 'wrongful birth'], ['Bourhill v Young', 'Haley v London Electricity Board', 'McFarlane v Tayside Health Board'], [], { pre: ['caparo'] }],
    ],
  }),
  D({
    id: 'tort-psychiatric', title: 'Ch5: Psychiatric Harm, Economic Loss and Misstatement', chapter: 'Ch5', sourceFile: 'LAW7054-Tort-Ch5-Psychiatric-Harm.md', after: ['tort-duty.caparo'],
    subs: [
      ['why-special', 'Why Psychiatric Harm Is Special', '1. Introduction — Why Psychiatric Harm Is a "Special" Problem', ['control mechanisms', 'policy concerns'], ['Donoghue v Stevenson', 'Caparo Industries v Dickman'], []],
      ['recognised-illness', 'What Counts as Psychiatric Harm', '2. What Counts as Psychiatric Harm', ['recognised psychiatric illness', 'grief is not enough'], ['Hicks v Chief Constable of South Yorkshire'], []],
      ['exclusionary-rule', 'The General Exclusionary Rule', '3. The General Exclusionary Rule and Its Justifications', ['Lord Steyn\'s justifications', 'Law Commission critique'], ['White v Chief Constable of South Yorkshire'], []],
      ['primary-secondary', 'Primary vs Secondary Victims', '4. Primary vs Secondary Victims — The Distinction', ['physical danger', 'zone of danger', 'bystanders'], ['Page v Smith'], []],
      ['primary-victims', 'Primary Victims in Detail', '5. Primary Victims in Detail', ['foreseeable physical injury suffices', 'rescuers after White'], ['Page v Smith', 'Rothwell v Chemical & Insulating', 'Dooley v Cammell Laird', 'Chadwick v British Railways Board'], []],
      ['secondary-victims', 'Secondary Victims in Detail', '6. Secondary Victims in Detail', ['Bourhill to Alcock', 'control mechanisms'], ['Bourhill v Young', 'McLoughlin v O\'Brian', 'Alcock v Chief Constable of South Yorkshire'], []],
      ['alcock-criteria', 'The Three Alcock Criteria', '7. The Three Alcock Criteria — Explained and Applied', ['close tie of love and affection', 'presence at accident or aftermath', 'direct perception by own unaided senses'], ['Alcock v Chief Constable of South Yorkshire'], []],
      ['critical-perspectives', 'Critical Perspectives', '8. Critical Perspectives', ['arbitrariness of Alcock', 'medical negligence cases'], ['Liverpool Women\'s NHS FT v Ronayne', 'Paul v Royal Wolverhampton NHS Trust'], [], { pre: ['alcock-criteria'] }],
      ['economic-loss', 'Pure Economic Loss', '10. Pure Economic Loss (§5.2)', ['exclusionary rule', 'consequential v pure loss', 'defective buildings'], ['Spartan Steel v Martin', 'Cattle v Stockton Waterworks', 'Murphy v Brentwood DC'], ['Defective Premises Act 1972'], { pre: ['why-special'] }],
      ['misstatement', 'Negligent Misstatement', '11. Negligent Misstatement and Assumption of Responsibility (§5.3)', ['assumption of responsibility', 'reliance', 'disclaimers'], ['Hedley Byrne v Heller', 'Henderson v Merrett', 'White v Jones', 'Smith v Eric S Bush'], ['Unfair Contract Terms Act 1977'], { pre: ['economic-loss'] }],
    ],
  }),
  D({
    id: 'tort-breach', title: 'Ch8: Breach of Duty — Standard of Care', chapter: 'Ch8', sourceFile: 'LAW7054-Tort-Ch8-Breach-Standard-of-Care.md', after: ['tort-duty.caparo'],
    subs: [
      ['reasonable-person', 'The Objective Reasonable Person Test', '2. The Objective Reasonable Person Test', ['objective standard', 'foreseeability threshold', 'no concession for incapacity'], ['Blyth v Birmingham Waterworks', 'Glasgow Corporation v Muir', 'Nettleship v Weston', 'Roe v Minister of Health'], []],
      ['conditions', 'Medical and Physical Conditions', '3. Medical and Physical Conditions Affecting Capacity', ['sudden incapacity', 'learner drivers'], ['Roberts v Ramsbottom', 'Mansfield v Weetabix', 'Dunnage v Randall', 'Hill v Baxter'], []],
      ['children', 'Children as Defendants', '4. Children as Defendants', ['age-adjusted standard', 'child of that age'], ['Mullin v Richards', 'Orchard v Lee', 'McHale v Watson'], []],
      ['sport', 'Sport', '5. Sport', ['reckless disregard', 'context of the game'], ['Condon v Basi', 'Wooldridge v Sumner', 'Smoldon v Whitworth', 'Blake v Galloway'], []],
      ['professionals', 'Professionals: Bolam and Bolitho', '6. Professionals — The Bolam Test', ['ordinary skilled professional', 'responsible body of opinion', 'logical analysis', 'informed consent'], ['Bolam v Friern Hospital Management Committee', 'Bolitho v City & Hackney HA', 'Wilsher v Essex AHA', 'Montgomery v Lanarkshire Health Board'], []],
      ['calculus', 'The Calculus of Negligence', '7. Factors Relevant to Breach — The Calculus of Negligence', ['probability and magnitude', 'utility', 'emergencies', 'cost of precautions'], ['Bolton v Stone', 'Paris v Stepney BC', 'Daborn v Bath Tramways', 'Watt v Hertfordshire CC', 'Latimer v AEC'], ['Compensation Act 2006'], { pre: ['reasonable-person'] }],
      ['res-ipsa', 'Res Ipsa Loquitur', '8. Res Ipsa Loquitur', ['thing speaks for itself', 'defendant control', 'effect on burden'], ['Scott v London & St Katherine Docks', 'Byrne v Boadle', 'Ng Chun Pui v Lee Chuen Tat'], [], { pre: ['reasonable-person'] }],
      ['critical', 'Critical Perspectives on Breach', '9. Critical Perspectives', ['is objectivity fair', 'tension with Montgomery'], ['Bolton v Stone', 'Watt v Hertfordshire'], [], { pre: ['calculus', 'professionals'] }],
    ],
  }),
  D({
    id: 'tort-breach-lecture', title: 'Brennan Ch3: Breach of Duty (workshop)', chapter: 'Ch3', sourceFile: 'LAW7054-Tort-W4-Breach-of-Duty-Brennan-Ch3.md', after: ['tort-duty.caparo'],
    subs: [
      ['two-questions', 'The Two Questions', 'The Two Questions', ['standard of care', 'whether it was breached'], [], []],
      ['standard', 'Setting the Standard of Care', '3.1 Setting the Standard of Care', ['reasonable man', 'knowledge', 'skill', 'risk balancing'], ['Blyth v Birmingham Waterworks', 'Roe v Ministry of Health', 'Bolton v Stone', 'Wells v Cooper'], ['Compensation Act 2006']],
      ['proving-breach', 'Proving Breach: Res Ipsa Loquitur', '3.2 Proving Breach — *Res Ipsa Loquitur*', ['inference of negligence', 'control'], ['Scott v London and St Katherine\'s Dock', 'Ward v Tesco Stores'], []],
    ],
  }),
  D({
    id: 'tort-causation', title: 'Brennan Ch4: Causation and Remoteness', chapter: 'Ch4', sourceFile: 'LAW7054-Tort-Brennan-Ch4-Causation.md', after: ['tort-breach.calculus', 'tort-breach.res-ipsa'],
    subs: [
      ['but-for', 'Causation in Fact: The But For Test', '4.1 Causation in Fact', ['but for test', 'balance of probabilities'], ['Barnett v Chelsea and Kensington Hospital', 'Pickford v ICI'], []],
      ['deficiencies', 'Deficiencies in the But For Test', '4.1.1 Deficiencies in the \'But For\' Test', ['unjust results', 'impossible to answer'], ['Cook v Lewis'], ['Civil Liability (Contribution) Act 1978']],
      ['hypothetical', 'Hypothetical Causation', 'Hypothetical Causation', ['what the claimant would have done', 'loss of a chance'], ['McWilliams v Sir William Arrol', 'Perry v Raleys Solicitors', 'Allied Maples v Simmons & Simmons'], []],
      ['material-contribution', 'Material Contribution to Injury', '4.1.3 Material Contribution to Injury', ['cumulative causes', 'divisible harm'], ['Bonnington Castings v Wardlaw', 'Bailey v Ministry of Defence'], []],
      ['material-risk', 'Material Contribution to Risk', '4.1.4 Material Contribution to Risk of Injury', ['McGhee exception', 'Wilsher limits'], ['McGhee v National Coal Board', 'Wilsher v Essex AHA'], []],
      ['asbestos', 'Asbestos: Fairchild and After', '4.1.5 Current Issues in Causation: Asbestos', ['Fairchild exception', 'proportionate liability', 'Compensation Act 2006'], ['Fairchild v Glenhaven Funeral Services', 'Barker v Corus', 'Sienkiewicz v Greif'], ['Compensation Act 2006']],
      ['supervening', 'Supervening Causes', '4.1.7 Supervening Causes', ['later event reduces loss', 'tortious v non-tortious supervening event'], ['Baker v Willoughby', 'Jobling v Associated Dairies', 'Performance Cars v Abraham'], []],
      ['remoteness', 'Causation in Law: Remoteness', '4.2 Causation in Law (Remoteness)', ['reasonable foreseeability of type of damage', 'Polemis rejected'], ['Re Polemis', 'The Wagon Mound (No 1)', 'Hughes v Lord Advocate', 'Jolley v Sutton LBC'], [], { pre: ['but-for'] }],
      ['thin-skull', 'The Thin Skull Rule', '4.2.1 The \'Thin Skull\' Rule', ['take the victim as found', 'pre-existing vulnerability'], ['Smith v Leech Brain', 'Robinson v Post Office', 'Lagden v O\'Connor'], []],
      ['nai', 'Intervening Events (Novus Actus Interveniens)', '4.2.2 Intervening Events (Novus Actus Interveniens)', ['acts of claimant', 'natural events', 'acts of third parties', 'chain of causation'], ['McKew v Holland & Hannen & Cubitts', 'Reeves v Commissioner of Police', 'The Oropesa', 'Knightley v Johns', 'Wright v Lodge'], [], { pre: ['remoteness'] }],
    ],
  }),
  D({
    id: 'tort-employers', title: 'Ch8: Employers\' Liability', chapter: 'Ch8 (EL)', sourceFile: 'LAW7054-Tort-Ch8-Employers-Liability.md', after: ['tort-breach.reasonable-person'],
    subs: [
      ['non-delegable', 'The Non-Delegable Duty', '2. The Non-Delegable Duty', ['personal duty of employer', 'cannot delegate'], ['Woodland v Swimming Teachers\' Association'], []],
      ['wilsons-clyde', 'The Four Common Law Elements', '3. The Four Common Law Elements — Wilsons & Clyde Coal', ['competent staff', 'safe plant', 'safe place of work', 'safe system'], ['Wilsons & Clyde Coal v English', 'Hudson v Ridge Manufacturing', 'Coltman v Bibby Tankers', 'Speed v Thomas Swift'], ['Employers\' Liability (Defective Equipment) Act 1969']],
      ['occupational-stress', 'Occupational Stress', '4. Occupational Stress', ['foreseeability of psychiatric harm at work', 'Hatton principles'], ['Walker v Northumberland CC', 'Hatton v Sutherland', 'Barber v Somerset CC'], [], { pre: ['wilsons-clyde'] }],
      ['bsd', 'Breach of Statutory Duty', '5. Breach of Statutory Duty', ['four requirements', 'Parliament\'s intention'], ['Groves v Lord Wimborne', 'Gorris v Scott', 'X (minors) v Bedfordshire CC'], ['Health and Safety at Work etc Act 1974'], { pre: ['wilsons-clyde'] }],
      ['defences', 'Defences: Volenti and Contributory Negligence', '7. Defences', ['volenti non fit injuria', 'contributory negligence'], ['Smith v Baker & Sons'], ['Law Reform (Contributory Negligence) Act 1945'], { pre: ['wilsons-clyde', 'tort-causation.nai'] }],
    ],
  }),
];
