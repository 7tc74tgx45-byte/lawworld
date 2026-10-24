// Workshop Prep encounter overlay.
// Flow per scenario:
//   1. Show scenario text
//   2. Player writes their IRAC answer in a textarea
//   3. Reveal model answer (side by side on wide, stacked on narrow)
//   4. Self-assess: "I nailed it" / "Missed something" / "Off track"
// Then flash-card round: each card shown, player flips to see the answer.
// On completion a summary banner is shown.

import { openOverlay, el, button } from './dom.js';

const RATINGS = [
  { id: 'good', label: '✅ Nailed it', cls: 'primary' },
  { id: 'partial', label: '🟡 Missed something', cls: '' },
  { id: 'miss', label: '❌ Off track', cls: 'leave' },
];

function scenarioStep(panel, scenario, index, total, onDone) {
  panel.innerHTML = '';
  panel.append(el('p', 'lw-hint-note', `Scenario ${index + 1} of ${total}: ${scenario.name}`));

  const scenarioBox = el('div', 'lw-ws-scenario');
  scenarioBox.textContent = scenario.scenarioText;
  panel.append(scenarioBox);

  panel.append(el('p', null, 'Write your IRAC answer:'));
  const ta = el('textarea', 'lw-ws-textarea');
  ta.rows = 8;
  ta.placeholder = 'Issue → Rule → Application → Conclusion…';
  panel.append(ta);

  const revealBtn = button('Reveal model answer', 'primary', () => {
    revealStep(panel, scenario, index, total, ta.value.trim(), onDone);
  });
  panel.append(revealBtn);
}

function revealStep(panel, scenario, index, total, playerAnswer, onDone) {
  panel.innerHTML = '';
  panel.append(el('p', 'lw-hint-note', `Scenario ${index + 1} of ${total}: ${scenario.name} — Compare`));

  const cols = el('div', 'lw-ws-cols');

  const yourSide = el('div', 'lw-ws-col');
  yourSide.append(el('h3', 'lw-ws-col-head', 'Your answer'));
  const yourText = el('pre', 'lw-ws-answer');
  yourText.textContent = playerAnswer || '(nothing written)';
  yourSide.append(yourText);

  const modelSide = el('div', 'lw-ws-col');
  modelSide.append(el('h3', 'lw-ws-col-head', 'Model answer'));
  const modelText = el('div', 'lw-ws-answer lw-ws-answer--model');
  // Render **bold** as <strong> for readability
  modelText.innerHTML = scenario.modelAnswer
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
  modelSide.append(modelText);

  cols.append(yourSide, modelSide);
  panel.append(cols);

  panel.append(el('p', null, 'How did you do?'));
  const ratingRow = el('div', 'lw-ws-rating');
  for (const r of RATINGS) {
    ratingRow.append(button(r.label, r.cls, () => onDone({ rating: r.id, scenarioName: scenario.name })));
  }
  panel.append(ratingRow);
}

function flashCardRound(panel, flashCards, onFinish) {
  let cardIndex = 0;
  showCard();

  function showCard() {
    panel.innerHTML = '';
    const card = flashCards[cardIndex];
    panel.append(el('p', 'lw-hint-note', `Flash card ${cardIndex + 1} of ${flashCards.length}`));

    const front = el('div', 'lw-ws-flashcard');
    front.textContent = `#${card.index}`;
    panel.append(front);

    const revealBtn = button('Reveal', 'primary', () => {
      front.textContent = card.text;
      revealBtn.remove();
      const nextLabel = cardIndex < flashCards.length - 1 ? 'Next card →' : 'Finish';
      panel.append(button(nextLabel, 'primary', () => {
        cardIndex++;
        if (cardIndex < flashCards.length) showCard();
        else onFinish();
      }));
    });
    panel.append(revealBtn);
    panel.append(button('Skip all flash cards', 'leave', onFinish));
  }
}

/**
 * Open the workshop encounter overlay.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {{ name: string, scenarioText: string, modelAnswer: string }[]} opts.scenarios
 * @param {{ index: number, text: string }[]} opts.flashCards
 * @param {function} opts.onClose  - Called when the encounter is fully done
 */
export function openWorkshopEncounter({ title, scenarios, flashCards, onClose }) {
  const { panel, close: closeOverlay } = openOverlay({
    onEscape: () => { closeOverlay(); onClose?.({ completed: false }); },
  });

  const results = [];
  let scenarioIndex = 0;

  function nextScenario() {
    if (scenarioIndex < scenarios.length) {
      scenarioStep(panel, scenarios[scenarioIndex], scenarioIndex, scenarios.length, (r) => {
        results.push(r);
        scenarioIndex++;
        nextScenario();
      });
    } else if (flashCards && flashCards.length > 0) {
      startFlashCards();
    } else {
      finish();
    }
  }

  function startFlashCards() {
    panel.innerHTML = '';
    panel.append(el('h2', 'lw-h', 'Things to Know Cold'));
    panel.append(el('p', null, `${flashCards.length} flash card${flashCards.length !== 1 ? 's' : ''} from your notes.`));
    flashCardRound(panel, flashCards, finish);
  }

  function finish() {
    panel.innerHTML = '';
    const good = results.filter((r) => r.rating === 'good').length;
    const partial = results.filter((r) => r.rating === 'partial').length;
    const miss = results.filter((r) => r.rating === 'miss').length;
    panel.append(el('h2', 'lw-h', `✅ ${title} — Done`));
    panel.append(el('p', null, `${scenarios.length} scenario${scenarios.length !== 1 ? 's' : ''} completed.`));
    const summary = el('ul');
    if (good) summary.append(el('li', null, `✅ Nailed it: ${good}`));
    if (partial) summary.append(el('li', null, `🟡 Missed something: ${partial}`));
    if (miss) summary.append(el('li', null, `❌ Off track: ${miss}`));
    panel.append(summary);
    panel.append(button('Done', 'primary', () => {
      closeOverlay();
      onClose?.({ completed: true, results });
    }));
  }

  // Show workshop title then start
  panel.append(el('h2', 'lw-h', `📋 ${title}`));
  if (scenarios.length === 0) {
    panel.append(el('p', 'lw-hint-note', 'No scenarios found in this workshop note.'));
    panel.append(button('Close', 'primary', () => { closeOverlay(); onClose?.({ completed: false }); }));
    return { close: closeOverlay };
  }
  panel.append(el('p', null, `${scenarios.length} scenario${scenarios.length !== 1 ? 's' : ''} to work through, then flash cards.`));
  panel.append(button('Begin', 'primary', () => nextScenario()));
  panel.append(button('Not now', 'leave', () => { closeOverlay(); onClose?.({ completed: false }); }));

  return { close: closeOverlay };
}
