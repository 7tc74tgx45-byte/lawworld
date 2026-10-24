// Door overlays: the padlock tooltip for a locked building, and the tutor picker for an open one.
//   openDoorPanel(info, { onChoose(tutorId) })  -> { close }
// Typing is not needed here, but the shared overlay lock still stops the game from walking while it is open.

import { openOverlay, el, button } from './dom.js';
import { TUTOR_LIST } from '../data/tutors.js';
import { STATE_LABEL } from '../game/palette.js';

export function openDoorPanel(info, { onChoose } = {}) {
  const { panel, close } = openOverlay({ panelClass: 'small', onEscape: () => close() });

  if (info.kind === 'locked') {
    panel.append(el('h2', 'lw-h', `🔒 ${info.title}`));
    panel.append(el('p', null, 'This building is locked. To open it, consolidate:'));
    const ul = el('ul');
    for (const u of info.unmet) ul.append(el('li', null, u.title));
    panel.append(ul);
    panel.append(el('p', 'lw-hint-note', 'Exploring a building is not enough: the tutor has to judge it consolidated (stages 3 and 5 solid, checkpoint 2/3).'));
    panel.append(button('Close', 'primary', close));
    return { close };
  }

  panel.append(el('h2', 'lw-h', info.title));
  panel.append(el('p', 'lw-hint-note', `${info.module}${info.district ? ' / ' + info.district : ''}. Status: ${STATE_LABEL[info.state] ?? info.state}.`));
  panel.append(el('p', null, info.note));
  if (!info.canPlay) {
    panel.append(button('Close', 'primary', close));
    return { close };
  }
  panel.append(el('p', null, 'Choose your tutor:'));
  const list = el('div', 'lw-menu-list');
  for (const t of TUTOR_LIST) {
    const b = button(`${t.name} (${t.role})${t.id === info.defaultTutor ? ' ★' : ''}`, t.id === info.defaultTutor ? 'primary' : '', () => {
      close();
      onChoose?.(t.id);
    });
    b.title = `Best for: ${t.bestFor}`;
    b.style.borderLeft = `6px solid ${t.colour}`;
    list.append(b);
  }
  panel.append(list);
  panel.append(button('Not now', 'leave', close));
  return { close };
}
