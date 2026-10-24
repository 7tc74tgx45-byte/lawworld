// Which controls the encounter overlay shows, as a pure function of the current prompt. No DOM.
// kind: 'info' | 'open' | 'mcq' | 'verdict'; mode: 'answer' | 'ask'.

export const ANSWER_PLACEHOLDER = 'Type your answer here. Enter to submit, Shift+Enter for a new line.';
export const ASK_PLACEHOLDER = 'Ask the tutor anything about this topic...';

export function viewState({ kind = 'info', mode = 'answer', finished = false } = {}) {
  if (finished) {
    return {
      showInput: false, showSubmit: false, submitLabel: 'Submit', showOptions: false,
      showHint: false, showNotSure: false, showAsk: false, askLabel: 'Ask a question',
      leaveLabel: 'Close', placeholder: ANSWER_PLACEHOLDER,
    };
  }
  const asking = mode === 'ask';
  const isMcq = kind === 'mcq';
  const isInfo = kind === 'info';
  return {
    // The text box shows for open answers and whenever the player is typing a question to the tutor.
    showInput: asking || (!isMcq && !isInfo),
    // MCQ is answered with the option buttons; the intro has "Continue" (it is not a question).
    showSubmit: asking || !isMcq,
    submitLabel: asking ? 'Send question' : isInfo ? 'Continue' : 'Submit',
    showOptions: isMcq,
    showHint: !isInfo,
    showNotSure: !isInfo,
    showAsk: true,
    askLabel: asking ? 'Cancel question' : 'Ask a question',
    leaveLabel: 'Leave',
    placeholder: asking ? ASK_PLACEHOLDER : ANSWER_PLACEHOLDER,
  };
}

/** CSS classes and label for one transcript message from the engine. */
export function messageView(m, tutorName = 'Tutor') {
  const cls = ['lw-msg', m.role === 'tutor' ? 'tutor' : m.role === 'player' ? 'player' : 'system'];
  if (m.kind === 'hint') cls.push('hint');
  if (m.kind === 'answer') cls.push('answer');
  if (m.external) cls.push('external');
  if (m.kind === 'verdict') cls.push('verdict');
  if (m.correct === true) cls.push('correct');
  if (m.correct === false) cls.push('wrong');
  let label = '';
  if (m.role === 'tutor') {
    label = m.kind === 'hint' ? 'Hint'
      : m.kind === 'answer' ? (m.external ? 'External, not from your notes' : 'Answer to your question')
      : m.kind === 'verdict' ? `${tutorName}: verdict`
      : tutorName;
  }
  return { className: cls.join(' '), label };
}

/** Pip states for the 7 stage pips: 'done' | 'now' | 'todo'. */
export function pipStates(stage, finished) {
  return [1, 2, 3, 4, 5, 6, 7].map((n) => (finished || n < stage ? 'done' : n === stage ? 'now' : 'todo'));
}
