// Journal overlay (Tab): stats bars, per-module tree of districts/subsections, "Things to revisit", last 10 sessions.
// All data comes from the pure view model in src/logic/journal.js; this file only draws it.
//   openJournal({ curriculum, save, onClosed }) -> { close }

import { openOverlay, el, button } from './dom.js';
import { buildJournal } from '../logic/journal.js';
import { STATE_LABEL } from '../game/palette.js';

const STATE_ICON = { locked: '🔒', available: '○', explored: '◐', consolidated: '●' };
const STAT_COLOURS = { caseRecall: '#6cc3d5', statutoryInterpretation: '#c79bff', application: '#ffd166', iracFluency: '#7ecb8a' };

const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function section(title, hint) {
  const wrap = el('section', 'lw-jsec');
  wrap.append(el('h3', 'lw-jh', title));
  if (hint) wrap.append(el('div', 'lw-jhint', hint));
  return wrap;
}

function statsSection(stats) {
  const s = section('Stats', 'They rise from answers the tutor has evaluated, never from clicking.');
  for (const b of stats) {
    const row = el('div', 'lw-stat');
    row.append(el('span', 'lw-stat-name', b.label), el('span', 'lw-stat-lvl', `Lv ${b.level}`));
    const bar = el('div', 'lw-bar');
    const fill = el('div', 'lw-bar-fill');
    fill.style.width = `${Math.round(b.fraction * 100)}%`;
    fill.style.background = STAT_COLOURS[b.key] ?? '#8fa0ff';
    bar.append(fill);
    row.append(bar, el('span', 'lw-stat-pts', `${b.intoLevel}/${b.needed}`));
    s.append(row);
  }
  return s;
}

function materialsSection(materials, served, seeds = 0, plants = 0) {
  const s = section('Materials', `Earned by advising clients (${served} served). Each region pays in its own material. Seeds come from solid answers and are planted in the hub garden. Materials buy extra hints inside an encounter (once the free hints are used) and light a district's brazier early at its door.`);
  const row = el('div', 'lw-mats');
  const seedChip = el('span', 'lw-mat' + (seeds ? '' : ' none'));
  seedChip.append(el('b', null, String(seeds)), document.createTextNode(` Seeds (${plants} planted)`));
  row.append(seedChip);
  for (const m of materials) {
    const chip = el('span', 'lw-mat' + (m.count ? '' : ' none'));
    chip.append(el('b', null, String(m.count)), document.createTextNode(` ${m.label}`));
    row.append(chip);
  }
  s.append(row);
  return s;
}

function revisitSection(revisit) {
  const s = section('Things to revisit', 'Concepts you missed or only half had. Click one to see where it lives.');
  if (!revisit.length) {
    s.append(el('div', 'lw-empty', 'No open gaps. Gaps appear when an answer misses a concept, or you say "I\'m not sure".'));
    return s;
  }
  const list = el('div', 'lw-gaplist');
  const detail = el('div', 'lw-gapdetail', 'Select a concept.');
  let selected = null;
  revisit.forEach((g) => {
    const b = el('button', 'lw-gap');
    b.type = 'button';
    b.append(el('span', 'lw-gap-c', g.concept), el('span', 'lw-gap-n', `missed ×${g.timesMissed}`));
    b.onclick = () => {
      selected?.classList.remove('sel');
      selected = b;
      b.classList.add('sel');
      detail.replaceChildren();
      detail.append(el('div', 'lw-gd-title', g.concept));
      if (g.known) {
        detail.append(el('div', null, `Building: ${g.building}`));
        detail.append(el('div', 'lw-jhint', `${g.module} › ${g.district}`));
        if (g.heading) detail.append(el('div', 'lw-jhint', `Note: ${g.sourceFile} › ${g.heading}`));
      } else {
        detail.append(el('div', null, 'This building is no longer in the curriculum.'));
      }
      detail.append(el('div', 'lw-jhint', `Missed ${g.timesMissed} time${g.timesMissed === 1 ? '' : 's'}${g.stageLabel ? `, first at the ${g.stageLabel} stage` : ''}. Last seen ${fmtDate(g.lastSeen)}.`));
      detail.append(el('div', 'lw-jhint', 'Walk to that building and press E. A solid answer on this concept clears the gap.'));
    };
    list.append(b);
  });
  s.append(list, detail);
  return s;
}

function treeSection(tree) {
  const s = section('Your map', '● consolidated  ◐ explored  ○ available  🔒 locked');
  for (const m of tree) {
    const done = m.counts.consolidated;
    const mod = el('details', 'lw-mod');
    const sum = el('summary', null);
    sum.append(el('span', 'lw-mod-t', m.title), el('span', 'lw-mod-n', `${done}/${m.total} consolidated`));
    const bar = el('div', 'lw-bar thin');
    const fill = el('div', 'lw-bar-fill');
    fill.style.width = `${Math.round(m.fraction * 100)}%`;
    bar.append(fill);
    mod.append(sum, bar);
    for (const d of m.districts) {
      const dd = el('details', 'lw-dist');
      const ds = el('summary', null);
      ds.append(el('span', null, `${d.lit ? '🔥 ' : ''}${d.title}`), el('span', 'lw-mod-n', `${d.counts.consolidated}/${d.total}`));
      dd.append(ds);
      for (const sub of d.subsections) {
        const row = el('div', `lw-sub ${sub.state}`);
        row.append(el('span', 'lw-sub-i', STATE_ICON[sub.state]), el('span', 'lw-sub-t', sub.title));
        if (sub.gaps) row.append(el('span', 'lw-sub-g', `${sub.gaps} gap${sub.gaps > 1 ? 's' : ''}`));
        row.append(el('span', 'lw-sub-s', STATE_LABEL[sub.state]));
        if (sub.needs.length) row.title = `Unlocks after: ${sub.needs.join(', ')}`;
        dd.append(row);
      }
      mod.append(dd);
    }
    s.append(mod);
  }
  return s;
}

function sessionsSection(sessions) {
  const s = section('Last sessions', 'Your ten most recent encounters.');
  if (!sessions.length) {
    s.append(el('div', 'lw-empty', 'No sessions yet. Walk to a building and press E.'));
    return s;
  }
  for (const x of sessions) {
    const row = el('div', 'lw-sess');
    row.append(el('span', `lw-tag ${x.outcome}`, x.outcome === 'consolidated' ? 'Consolidated' : 'Explored'));
    row.append(el('span', 'lw-sess-t', x.title));
    const bits = [fmtDate(x.date), x.tutor, `${x.exchanges} exchanges`, x.finished ? null : 'left early', x.gaps ? `${x.gaps} gap${x.gaps > 1 ? 's' : ''}` : null].filter(Boolean);
    row.append(el('span', 'lw-jhint', bits.join(' · ')));
    if (x.gapConcepts.length) row.title = `Gaps: ${x.gapConcepts.join('; ')}`;
    s.append(row);
  }
  return s;
}

export function openJournal({ curriculum, save, onClosed } = {}) {
  const { overlay, panel, close } = openOverlay({ panelClass: 'tall lw-journal', onEscape: () => close(), onClosed });
  // Tab closes the journal again (the overlay swallows the key so it also never moves browser focus).
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      close();
    }
  });
  const j = buildJournal(curriculum, save);
  const head = el('div', 'lw-jhead');
  head.append(el('h2', 'lw-h', 'Journal'), button('Close (Tab)', 'primary', close));
  const body = el('div', 'lw-jbody');
  body.append(statsSection(j.stats), materialsSection(j.materials, j.clientsServed, j.seeds, j.plants), revisitSection(j.revisit), treeSection(j.tree), sessionsSection(j.sessions));
  panel.append(head, body);
  overlay.focus();
  return { close };
}
