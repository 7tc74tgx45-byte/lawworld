// Checkpoint MCQs for contract-offer-acceptance (written by me; England & Wales law).
// `correct` is an index into `options`. Only the offline tutor reads it.

export const MCQ_QUESTIONS = [
  {
    text: 'Hyde offers a lower price for Wrench\'s farm, Wrench refuses, and Hyde then says he will pay the original price. Is there a contract?',
    options: [
      'Yes: Hyde accepted the original offer, which stayed open.',
      'No: the counter-offer rejected and destroyed the original offer (Hyde v Wrench).',
      'Yes, but only if Wrench replies in writing.',
    ],
    correct: 1,
    concept: 'counter-offer destroys the original offer',
    explanation: 'A counter-offer is a rejection of the original offer, so the original offer no longer exists to be accepted (Hyde v Wrench (1840)). Compare a mere request for information, which does not reject the offer.',
    hints: ['What happens to an offer once the offeree responds with different terms?', 'Think about whether Wrench was still bound after saying no to the lower price.'],
  },
  {
    text: 'Acceptance of an offer is posted on Monday and arrives on Wednesday. When is the contract formed, if post is a reasonable method of acceptance?',
    options: ['On Monday, when it was posted (postal rule, Adams v Lindsell).', 'On Wednesday, when it arrived.', 'On Tuesday, as soon as the post office accepts it.'],
    correct: 0,
    concept: 'postal rule: acceptance complete on posting',
    explanation: 'Under the postal rule from Adams v Lindsell (1818), acceptance is complete when the letter is posted, where post is a reasonable means. The general rule (receipt, as in Entores for instant communications) does not apply to post.',
    hints: ['This is the famous exception to the rule that acceptance must be received.', 'Which case about wool and a delayed letter set it up?'],
  },
  {
    text: 'A seller posts a letter revoking his offer; before it arrives, the buyer accepts by telegram. Is there a contract?',
    options: [
      'No: revocation is effective as soon as it is posted.',
      'No: the buyer should have checked the post first.',
      'Yes: revocation is only effective when communicated to the offeree (Byrne v Van Tienhoven).',
    ],
    correct: 2,
    concept: 'revocation must be communicated',
    explanation: 'Revocation takes effect only when received by the offeree. The postal rule does not apply to revocation, so in Byrne v Van Tienhoven (1880) the contract was formed when the telegram acceptance was sent.',
    hints: ['Does the postal rule help the person who is revoking?', 'Until the offeree knows the offer is withdrawn, what are they entitled to assume?'],
  },
];
