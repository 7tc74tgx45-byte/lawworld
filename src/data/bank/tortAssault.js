// Offline bank: tort-trespass.assault (note: LAW7054-Tort-Lecture1-Trespass-to-Person-Handout.md, "ASSAULT").
// The vault handout gives the definition and five case names only. The case summaries below are written by me
// from standard England & Wales tort law, kept short. Thomas v NUM is named in the note but NOT summarised here:
// the vault is silent on its holding and I will not guess.

import { buildSubsectionBank, conceptStage, authorityStage, applicationStage, caseConcept } from './helpers.js';

const stephens = {
  id: 'stephens',
  name: 'Stephens v Myers (1840) 4 C&P 349',
  nameRx: ['stephens', 'myers'],
  factsRx: ['parish', 'meeting', 'chair', 'churchwarden', 'clenched fist', 'fist', 'table', 'vote', 'seat'],
  ruleRx: ['striking distance', 'within (reach|range)', 'would have (struck|hit)', 'present ability', 'prevented', 'stopped', 'apprehension'],
  ratio: 'Advancing with a clenched fist towards the claimant at a meeting, close enough to strike, was an assault even though a bystander stopped the blow: the claimant reasonably feared immediate force.',
  whyItMatters: 'It shows assault is about reasonable apprehension of immediate violence, not about contact, and that the threat can be real even if it is intercepted.',
};
const tuberville = {
  id: 'tuberville',
  name: 'Tuberville v Savage (1669) 1 Mod 3',
  nameRx: ['tuberville', 'savage'],
  factsRx: ['sword', 'assize', 'hand on (his|the) sword', 'put his hand', 'language'],
  ruleRx: ['words (can )?negat', 'negat(e|ed|es) (the )?(threat|assault)', 'conditional', 'not an assault', 'no assault', 'if it were not assize'],
  ratio: 'The defendant putting his hand on his sword while saying "if it were not assize-time I would not take such language from you" was not an assault: the words showed no intention to strike then and there.',
  whyItMatters: 'It is the classic case that words can negate what would otherwise be a threatening act, so a conditional threat that shows no immediate intention to strike is not an assault.',
};
const read = {
  id: 'read',
  name: 'Read v Coker (1853) 13 CB 850',
  nameRx: ['read v coker', 'coker'],
  factsRx: ['workmen', 'rolled up (their|his) sleeves', 'sleeves', 'surrounded', 'break (his )?neck', 'premises', 'turn(ed)? out'],
  ruleRx: ['not (negat|merely)', 'conditional', 'threat(s)? (to|of)', 'ability', 'apprehension', 'assault'],
  ratio: 'Where the defendant and his workmen surrounded the claimant, rolled up their sleeves and threatened to break his neck unless he left, that was an assault: the threat, backed by the means to carry it out, put him in reasonable fear of immediate force.',
  whyItMatters: 'It shows a conditional threat can still be an assault where the circumstances show a real and present ability and willingness to use force.',
};
const ireland = {
  id: 'ireland',
  name: 'R v Ireland [1997] 3 WLR 534 (HL)',
  nameRx: ['ireland'],
  factsRx: ['silent', 'telephone', 'phone', 'calls', 'women', 'psychiatric', 'harassment', 'stalk'],
  ruleRx: ['words (can|may)', 'silence', 'silent calls', 'assault', 'immediate', 'apprehension', 'psychiatric'],
  ratio: 'Repeated silent telephone calls were capable of being an assault: words, or even silence, can cause reasonable apprehension of immediate violence, and "immediate" is satisfied if the caller\'s presence or threat makes the victim fear force may follow at any moment.',
  whyItMatters: 'It shows that assault is not limited to gestures: communications at a distance can be assault where they cause apprehension of imminent force.',
};

export const assaultBank = buildSubsectionBank({
  intro:
    'Welcome to Tort, and to its first and oldest corner: trespass to the person. Assault is the gentlest of the group, because nobody needs to be touched at all, yet it is actionable. That makes it a good place to learn how tort protects dignity and safety, and it leads straight into battery and false imprisonment. Press Continue.',
  s2: conceptStage({
    prompt: 'Stage 2, plain English. A friend says "if he never touched me, how can it be a legal wrong?" In your own words, explain what assault is in tort and why it is different from battery.',
    modelAnswer: 'Assault is when someone makes you reasonably afraid that they are about to hit you. The wrong is the fear of imminent force, not the contact. Battery is the contact itself.',
    hints: [
      'Think about someone swinging a fist and stopping an inch from your face. What has been done to you, even without contact?',
      'What word in the everyday meaning of "threat" matters here: is it about what happens, or what you expect to happen?',
    ],
    concepts: [
      { id: 'fear', label: 'assault is making the claimant reasonably expect force', any: ['apprehen', 'fear', 'afraid', 'expect(s|ed)? (to be )?(hit|struck|attack)', 'think(s)? (they|he|she)\'?(ll| will| are going to| is going to) (hit|be hit)'] },
      { id: 'imm', label: 'the force must be about to happen (immediate)', any: ['immediate', 'imminent', 'about to', 'right now', 'there and then', 'straight away'] },
      { id: 'nocontact', label: 'no contact is needed', any: ['no contact', 'without (any )?(contact|touch)', 'not (need|require)[a-z ]{0,10}(contact|touch)', 'never touched', 'doesn\'t (need|have)[a-z ]{0,10}(touch|contact)', 'don\'t need to be touched'] },
      { id: 'battery', label: 'battery is the contact itself', any: ['battery', 'actual (contact|force)', 'physical contact', 'actually (hit|touch)'] },
    ],
    requiredIds: ['fear', 'imm'],
  }),
  s3: conceptStage({
    prompt: 'Stage 3, precision. (1) State the definition of assault from the handout, broken into its elements. (2) Who must the apprehension be reasonable for, and of what? (3) What is the role of words: can they make an act an assault, or take it out of assault? (4) How does assault differ from battery?',
    modelAnswer: 'Assault is an act of the defendant that causes the claimant reasonable apprehension of the infliction of a battery on them by the defendant. Elements: an act by the defendant; reasonable apprehension in the claimant; of a battery (force); by the defendant. The apprehension must be of immediate force. Words can constitute assault (R v Ireland, silent calls) and can also negate an apparent threat (Tuberville v Savage). Battery is the intentional and direct application of force; assault is the apprehension of it.',
    hints: [
      'Use the definition as a checklist: act, apprehension, reasonable, of a battery, by the defendant. Which word does the most work in "reasonable apprehension"?',
      'For words, think about two different cases: one where words create a threat, and one where words cancel it.',
    ],
    concepts: [
      { id: 'act', label: 'an act of the defendant', any: ['act of the defendant', 'defendant (does|did) (an )?act', 'an act', 'defendant\'?s act'] },
      { id: 'appr', label: 'reasonable apprehension in the claimant', any: ['reasonable apprehension', 'apprehension', 'reasonably (fear|apprehend|expect)'] },
      { id: 'batt', label: 'apprehension of a battery, i.e. unlawful force', any: ['of (a )?battery', 'infliction of (a )?battery', 'force', 'being hit', 'touched'] },
      { id: 'imm', label: 'the apprehended force must be immediate', any: ['immediate', 'imminent'] },
      { id: 'words', label: 'words can make or negate an assault', any: ['words', 'silent', 'silence', 'verbal', 'conditional'] },
      { id: 'diff', label: 'battery is the intentional, direct application of force; assault is apprehension of it', any: ['intentional and direct', 'direct application', 'application of force', 'battery is'] },
    ],
    solidAt: 0.7, partialAt: 0.4, requiredIds: ['appr', 'imm'],
    followUp: (missed) => `Look again at "${missed[0].label}". State it in one precise sentence, as the handout would define it.`,
  }),
  s4: authorityStage({
    prompt: 'Stage 4, authority. Pick one case and explain it as facts, rule, why it matters. The handout lists Stephens v Myers, Thomas v NUM, Read v Coker, R v Ireland and Tuberville v Savage. Your notes only list the names, so give me what you know of one; Stephens v Myers or Tuberville v Savage are good choices.',
    modelAnswer: 'Tuberville v Savage (1669): after an insulting remark, the defendant put his hand on his sword and said that if it were not assize-time he would not take such language from the claimant. The court held there was no assault, because the words showed he did not intend to strike then. It matters because it shows words can negate a threatening act, so a conditional threat showing no immediate intention to strike is not an assault.',
    hints: [
      'Choose one case and use three labelled parts: what happened, what the court decided, why it is cited.',
      'Think about what each case does for the definition: some show the threat is real, some show it is cancelled, one shows it can be made without gestures.',
    ],
    cases: [stephens, tuberville, read, ireland],
    noCaseHelp: `Thomas v NUM is named in your handout but your vault gives no detail of it, so I will not summarise it here. For example, ${stephens.name}: ${stephens.ratio}`,
  }),
  s5: applicationStage({
    prompt: 'Stage 5, application. Client scenario: Jo, a bar worker, was closing up when a customer, Dev, shouted "I\'ll smash your face in" and ran at her with a raised bottle. A doorman grabbed Dev two metres from Jo. Jo was terrified but was not touched. Separately, Dev later left Jo repeated silent voicemails at 3 a.m. Advise Jo in IRAC whether she has a claim in assault for either event.',
    modelAnswer: 'Issue: whether Dev\'s conduct was an assault. Rule: assault is an act causing the claimant reasonable apprehension of the infliction of a battery by the defendant (handout); the apprehension must be of immediate force, and no contact is needed (Stephens v Myers, intercepted blow still assault); words can found assault (R v Ireland, silent calls) though words may negate a threat (Tuberville v Savage). Application, bottle: running at Jo with a raised bottle and a threat made her reasonably fear immediate force; the doorman stopping him does not undo that, as in Stephens. Application, voicemails: following Ireland they could amount to assault if they caused fear of immediate violence, but this depends on whether the circumstances (3 a.m., history) made Jo reasonably fear force at any moment; this is weaker and fact-dependent. Conclusion: strong claim for the bottle incident; arguable for the voicemails.',
    hints: [
      'Begin with the Issue: for which of the two events is the claim strongest, and why? Then check each element of the definition against the bottle incident.',
      'On the voicemails, ask what makes the apprehension "immediate" when the caller is not present, and which case dealt with calls.',
    ],
    concepts: [
      { id: 'def', label: 'the definition: reasonable apprehension of a battery by the defendant', any: ['reasonable apprehension', 'apprehen', 'reasonably (fear|expect)'] },
      { id: 'imm', label: 'the apprehension must be of immediate force', any: ['immediate', 'imminent'] },
      caseConcept(stephens, 'Stephens v Myers (intercepted blow is still assault)'),
      caseConcept(ireland, 'R v Ireland (silent calls can be assault)'),
      { id: 'nocontact', label: 'no contact is needed, and being stopped does not defeat assault', any: ['no contact', 'not touched', 'without (contact|touch)', 'stopped', 'doorman', 'intercept'] },
      { id: 'conc', label: 'conclusion: strong claim for the bottle incident, arguable for the voicemails', any: ['strong', 'likely (to )?(succeed|be)', 'good claim', 'assault (is|was) (made out|established)', 'arguable', 'weaker', 'fact[- ]dependent'] },
    ],
    solidAt: 0.75, requiredIds: ['def', 'imm'],
    // Wrong conclusions about the bottle incident: no assault because she was stopped or untouched, or contact needed.
    wrongRx: [
      'jo has no (claim|case|action)',
      'no assault (because|as|since|where|when|if) (the )?(doorman|dev (was|got) (stopped|grabbed)|she was not touched|jo was not touched|no (contact|touching))',
      '(doorman|stopped|grabbed|not touched|no contact).{0,40}(so|therefore|thus|hence).{0,20}no assault',
      '(bottle|raised bottle|dev\'?s? (conduct|actions?|behaviour)).{0,40}(was|is) not (an )?assault',
      'assault (requires|needs|involves) (actual |physical )?(contact|touching|force|injury)',
      '(contact|touching|an injury|injury) (is|was) (required|needed|essential) (for|in) (an )?assault',
      'it (was|is|became) (a )?battery (not|rather than) (an )?assault',
    ],
    wrongNote: 'Assault needs reasonable apprehension of immediate force, not contact; being stopped by the doorman does not undo it (Stephens v Myers).',
    followUp: (missed) => `Take the bottle incident first. Your answer is missing: ${missed.map((m) => m.label).join('; ')}.`,
  }),
  mcqs: [
    {
      text: 'Which element is essential to assault but NOT to battery?',
      options: ['Reasonable apprehension of the infliction of a battery.', 'Physical contact with the claimant.', 'An injury requiring treatment.'],
      correct: 0,
      concept: 'assault v battery',
      explanation: 'Assault is the reasonable apprehension of a battery; battery is the intentional and direct application of force. Contact and injury are not needed for assault.',
      hints: ['Which option is about what the claimant expects rather than what actually happens?', 'Does assault need anyone to be touched?'],
    },
    {
      text: 'In Tuberville v Savage, the defendant put his hand on his sword but said that if it were not assize-time he would not take such language. What was held?',
      options: ['An assault: the hand on the sword was threatening.', 'No assault: his words showed he did not intend to strike then.', 'A battery, because he touched the sword.'],
      correct: 1,
      concept: 'words negating a threat (Tuberville v Savage)',
      explanation: 'The words negated what would otherwise have been a threatening act, so there was no reasonable apprehension of immediate force. The classic reading is that words can negate an assault.',
      hints: ['What did the words say about whether he would strike at that moment?', 'Can words cancel a gesture?'],
    },
    {
      text: 'Which authority shows that silent telephone calls can be capable of amounting to assault?',
      options: ['R v Ireland [1997]', 'Read v Coker (1853)', 'Stephens v Myers (1840)'],
      correct: 0,
      concept: 'assault by silent calls (R v Ireland)',
      explanation: 'R v Ireland [1997] 3 WLR 534 (HL) held that silent calls can be assault where they cause apprehension of immediate violence. Read v Coker and Stephens v Myers concern threats made in person.',
      hints: ['Which case is the modern one, from the House of Lords?', 'Which two cases involve a person being present?'],
    },
  ],
  qa: [
    { rx: ['definition', 'what is assault', 'elements'], text: 'The handout defines assault as an act of the defendant that causes the claimant reasonable apprehension of the infliction of a battery on them by the defendant.' },
    { rx: ['battery'], text: 'The handout defines battery as the intentional and direct application of force to another person. Assault is the apprehension of that force, not the force itself.' },
    { rx: ['thomas', 'national union'], text: 'Thomas v National Union of Mineworkers (South Wales Area) [1986] 1 Ch 20 is listed in your handout, but the vault gives no detail of its holding and the offline bank will not guess. Check the case report.' },
    { rx: ['words', 'silent', 'phone'], text: 'Your handout lists R v Ireland [1997] 3 WLR 534 and Tuberville v Savage (1669) 1 Mod 3 under assault. The offline bank\'s summaries: Ireland (silent calls can be assault), Tuberville (words can negate a threat).' },
  ],
});

export const tortBank = { 'tort-trespass.assault': assaultBank };
