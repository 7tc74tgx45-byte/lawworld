// Case Library — browse every case in the curriculum, search by name, and test
// yourself with case-based MCQs.
//
// Data source: curriculum.modules → regions → districts → subsections → keyCases + keyConcepts.
// All pure reads — this panel never touches the vault or writes anything.
//
// Panel states:
//   BROWSE  — scrollable list of all cases with search, grouped by module
//   DETAIL  — single case: which topics it appears in, key concepts from those topics
//   QUIZ    — MCQ: "What principle does X establish?" (4 options from sibling concepts)

import { openOverlay, el, button } from './dom.js';
import { allDistricts } from '../logic/curriculum.js';

// ─── Build case index from curriculum ─────────────────────────────────────────

/**
 * Returns an array of CaseEntry objects:
 *   { name, appearances: [{ subsectionId, subsectionTitle, districtId, districtTitle,
 *                           moduleId, moduleTitle, keyConcepts, statutes }] }
 * Merges duplicate appearances of the same case across the curriculum.
 */
function buildCaseIndex(curriculum) {
  const map = new Map(); // case name (lowercase) → CaseEntry

  for (const mod of curriculum.modules ?? []) {
    for (const region of mod.regions ?? []) {
      for (const district of region.districts ?? []) {
        for (const sub of district.subsections ?? []) {
          for (const rawName of sub.keyCases ?? []) {
            const name = rawName.trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (!map.has(key)) map.set(key, { name, appearances: [] });
            map.get(key).appearances.push({
              subsectionId: sub.id,
              subsectionTitle: sub.title,
              districtId: district.id,
              districtTitle: district.title,
              moduleId: mod.id,
              moduleTitle: mod.title,
              keyConcepts: sub.keyConcepts ?? [],
              statutes: sub.statutes ?? [],
            });
          }
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Collect all keyConcepts across the entire curriculum (for MCQ distractor pool). */
function allConcepts(curriculum) {
  const concepts = new Set();
  for (const mod of curriculum.modules ?? []) {
    for (const region of mod.regions ?? []) {
      for (const district of region.districts ?? []) {
        for (const sub of district.subsections ?? []) {
          for (const c of sub.keyConcepts ?? []) concepts.add(c.trim());
        }
      }
    }
  }
  return [...concepts];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
/* ── Case Library panel ── */
.lw-panel.case-lib {
  background: #0e1520 !important;
  border-color: #2a4070 !important;
  color: #c8d8f0;
  width: min(660px, 96vw);
  max-height: 92vh;
  overflow-y: auto;
  font-family: 'Georgia', 'Times New Roman', serif;
}
.lw-panel.case-lib .lw-h {
  color: #88b8f0;
  border-bottom: 1px solid #2a4070;
  padding-bottom: 8px;
  letter-spacing: 0.02em;
}
.cl-search {
  width: 100%;
  box-sizing: border-box;
  background: #080e18;
  border: 1px solid #2a4070;
  color: #c8d8f0;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  margin: 0 0 14px;
  outline: none;
}
.cl-search:focus { border-color: #4080c0; }
.cl-stats {
  font-size: 12px;
  color: #5080a0;
  font-style: italic;
  margin-bottom: 10px;
}
.cl-group-heading {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #4080c0;
  margin: 14px 0 6px;
  padding-bottom: 3px;
  border-bottom: 1px solid #1a2a40;
}
.cl-case-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background: #101820;
  border: 1px solid #1a2a40;
  border-radius: 5px;
  margin-bottom: 5px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.cl-case-row:hover { border-color: #4080c0; background: #14202e; }
.cl-case-name { flex: 1; font-size: 13px; color: #b0d0f0; }
.cl-case-badge {
  font-size: 11px;
  color: #4080c0;
  background: #0e1828;
  border: 1px solid #2a4070;
  border-radius: 3px;
  padding: 1px 6px;
  white-space: nowrap;
}
/* Detail view */
.cl-detail-case { font-size: 17px; font-weight: bold; color: #88b8f0; margin-bottom: 4px; }
.cl-detail-sub { font-size: 12px; color: #4080c0; margin-bottom: 14px; font-style: italic; }
.cl-appearance {
  background: #0c1622;
  border: 1px solid #1a2a40;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.cl-app-topic { font-size: 13px; color: #88b8f0; font-weight: bold; margin-bottom: 4px; }
.cl-app-district { font-size: 11px; color: #5080a0; margin-bottom: 6px; }
.cl-concept-pill {
  display: inline-block;
  background: #0e2040;
  border: 1px solid #2a4070;
  border-radius: 3px;
  color: #88b0d8;
  font-size: 11px;
  padding: 2px 7px;
  margin: 2px 3px 2px 0;
}
.cl-statute-pill {
  display: inline-block;
  background: #1a1020;
  border: 1px solid #403060;
  border-radius: 3px;
  color: #a888d0;
  font-size: 11px;
  padding: 2px 7px;
  margin: 2px 3px 2px 0;
}
/* MCQ */
.cl-mcq-question {
  font-size: 15px;
  color: #c8d8f0;
  background: #0c1622;
  border-left: 3px solid #4080c0;
  padding: 12px 14px;
  border-radius: 4px;
  margin-bottom: 14px;
  line-height: 1.5;
}
.cl-mcq-option {
  display: block;
  width: 100%;
  text-align: left;
  background: #0e1820;
  border: 1px solid #1a2a40;
  border-radius: 5px;
  color: #c8d8f0;
  font-family: Georgia, serif;
  font-size: 13px;
  padding: 9px 13px;
  margin-bottom: 7px;
  cursor: pointer;
  transition: border-color 0.1s, background 0.1s;
}
.cl-mcq-option:hover:not(:disabled) { border-color: #4080c0; background: #14202e; }
.cl-mcq-option.correct { border-color: #50c060 !important; background: #0e2018 !important; color: #80e890 !important; }
.cl-mcq-option.wrong   { border-color: #c04040 !important; background: #200e0e !important; color: #e06060 !important; }
.cl-mcq-feedback {
  font-size: 13px;
  color: #a0b8d0;
  padding: 10px 12px;
  background: #0c1622;
  border-radius: 5px;
  margin-top: 8px;
  line-height: 1.5;
}
.cl-mcq-score {
  font-size: 13px;
  color: #5080a0;
  text-align: right;
  margin-bottom: 10px;
}
/* Shared nav buttons */
.cl-nav-btn {
  background: #0e1828 !important;
  border: 1px solid #2a4070 !important;
  color: #88b8f0 !important;
  font-family: Georgia, serif;
  font-size: 13px;
  padding: 5px 14px;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 8px;
  margin-bottom: 10px;
}
.cl-nav-btn:hover { background: #14202e !important; }
.cl-nav-btn.primary { background: #1a3060 !important; border-color: #4080c0 !important; }
.cl-nav-btn.primary:hover { background: #203870 !important; }
`;
  document.head.append(s);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick N unique items from arr that are not in the exclude set. */
function pickDistractors(pool, exclude, n) {
  const filtered = pool.filter((c) => !exclude.has(c));
  return shuffle(filtered).slice(0, n);
}

// ─── Views ────────────────────────────────────────────────────────────────────

/** BROWSE — list all cases with search. */
function renderBrowse(panel, { cases, allConceptsPool, onSelectCase, onStartQuiz, onClose }) {
  panel.innerHTML = '';
  panel.append(el('h2', 'lw-h', '📚 Case Library'));

  const statsEl = el('p', 'cl-stats', `${cases.length} cases across all modules`);
  panel.append(statsEl);

  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'cl-search';
  search.placeholder = 'Search cases by name…';
  panel.append(search);

  // Quiz + Leave row
  const navRow = el('div', null, '');
  navRow.style.marginBottom = '4px';
  const quizBtn = document.createElement('button');
  quizBtn.className = 'cl-nav-btn primary';
  quizBtn.textContent = '🎯 Case Quiz';
  quizBtn.addEventListener('click', () => onStartQuiz());
  const leaveBtn = document.createElement('button');
  leaveBtn.className = 'cl-nav-btn';
  leaveBtn.textContent = 'Leave Library';
  leaveBtn.addEventListener('click', onClose);
  navRow.append(quizBtn, leaveBtn);
  panel.append(navRow);

  const listEl = el('div', null, '');
  panel.append(listEl);

  function renderList(query) {
    listEl.innerHTML = '';
    const q = query.toLowerCase().trim();
    const filtered = q ? cases.filter((c) => c.name.toLowerCase().includes(q)) : cases;

    if (filtered.length === 0) {
      listEl.append(el('p', 'cl-stats', 'No cases match your search.'));
      return;
    }

    if (q) {
      // Flat list when searching
      statsEl.textContent = `${filtered.length} of ${cases.length} cases`;
      for (const c of filtered) {
        const row = el('div', 'cl-case-row');
        row.append(el('span', 'cl-case-name', c.name));
        const mods = [...new Set(c.appearances.map((a) => a.moduleTitle))];
        row.append(el('span', 'cl-case-badge', mods[0] ?? ''));
        row.addEventListener('click', () => onSelectCase(c));
        listEl.append(row);
      }
    } else {
      // Group by module
      statsEl.textContent = `${cases.length} cases across all modules`;
      const byModule = new Map();
      for (const c of cases) {
        const mod = c.appearances[0]?.moduleTitle ?? 'Other';
        if (!byModule.has(mod)) byModule.set(mod, []);
        byModule.get(mod).push(c);
      }
      for (const [mod, group] of byModule) {
        listEl.append(el('p', 'cl-group-heading', mod));
        for (const c of group) {
          const row = el('div', 'cl-case-row');
          row.append(el('span', 'cl-case-name', c.name));
          if (c.appearances.length > 1) {
            row.append(el('span', 'cl-case-badge', `×${c.appearances.length} topics`));
          }
          row.addEventListener('click', () => onSelectCase(c));
          listEl.append(row);
        }
      }
    }
  }

  renderList('');
  search.addEventListener('input', () => renderList(search.value));
  search.focus();
}

/** DETAIL — a single case's appearances and key concepts. */
function renderDetail(panel, { caseEntry, onBack, onQuizThis }) {
  panel.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.className = 'cl-nav-btn';
  backBtn.textContent = '← Back to cases';
  backBtn.addEventListener('click', onBack);
  panel.append(backBtn);

  panel.append(el('p', 'cl-detail-case', caseEntry.name));
  const uniqueMods = [...new Set(caseEntry.appearances.map((a) => a.moduleTitle))];
  panel.append(el('p', 'cl-detail-sub', `Appears in: ${uniqueMods.join(' · ')}`));

  // Quiz button for this specific case
  const quizBtn = document.createElement('button');
  quizBtn.className = 'cl-nav-btn primary';
  quizBtn.textContent = '🎯 Quiz me on this case';
  quizBtn.addEventListener('click', () => onQuizThis(caseEntry));
  panel.append(quizBtn);

  for (const a of caseEntry.appearances) {
    const card = el('div', 'cl-appearance');
    card.append(el('p', 'cl-app-topic', a.subsectionTitle));
    card.append(el('p', 'cl-app-district', `${a.moduleTitle} → ${a.districtTitle}`));

    if (a.keyConcepts.length) {
      const conceptsEl = el('div', null, '');
      for (const c of a.keyConcepts) {
        conceptsEl.append(el('span', 'cl-concept-pill', c));
      }
      card.append(conceptsEl);
    }
    if (a.statutes.length) {
      const statutesEl = el('div', null, '');
      statutesEl.style.marginTop = '5px';
      for (const s of a.statutes) {
        statutesEl.append(el('span', 'cl-statute-pill', s));
      }
      card.append(statutesEl);
    }

    panel.append(card);
  }
}

/** QUIZ — multiple-choice questions: case → principle. */
function renderQuiz(panel, { cases, allConceptsPool, pinCase, onBack }) {
  panel.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.className = 'cl-nav-btn';
  backBtn.textContent = '← Back to cases';
  backBtn.addEventListener('click', onBack);
  panel.append(backBtn);

  panel.append(el('h3', 'lw-h', '🎯 Case Quiz'));

  // Build question bank: for each case that has concepts in its appearances
  const qBank = [];
  const useCases = pinCase ? [pinCase] : cases;
  for (const c of useCases) {
    for (const a of c.appearances) {
      if (a.keyConcepts.length >= 1) {
        const correct = a.keyConcepts[Math.floor(Math.random() * a.keyConcepts.length)];
        qBank.push({ caseName: c.name, correctConcept: correct, appearance: a });
      }
    }
  }

  if (qBank.length === 0) {
    panel.append(el('p', 'cl-stats', 'No concepts found — cannot build quiz questions.'));
    return;
  }

  const questions = shuffle(qBank).slice(0, pinCase ? Math.min(5, qBank.length) : 10);
  let qi = 0;
  let score = 0;

  const scoreEl = el('p', 'cl-mcq-score', `Score: 0 / 0`);
  panel.append(scoreEl);

  const qArea = el('div', null, '');
  panel.append(qArea);

  function showQuestion(idx) {
    if (idx >= questions.length) {
      showFinale();
      return;
    }
    const q = questions[idx];
    qArea.innerHTML = '';

    const qEl = el('div', 'cl-mcq-question',
      `${idx + 1} of ${questions.length} — What is a key principle established by:\n\n"${q.caseName}"\n\nin the context of ${q.appearance.subsectionTitle}?`
    );
    qEl.style.whiteSpace = 'pre-line';
    qArea.append(qEl);

    // 4 options: 1 correct + 3 distractors
    const conceptsInTopic = new Set(q.appearance.keyConcepts);
    const distractors = pickDistractors(allConceptsPool, conceptsInTopic, 3);
    const options = shuffle([q.correctConcept, ...distractors]);

    let answered = false;
    const optionBtns = [];
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'cl-mcq-option';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const correct = opt === q.correctConcept;
        if (correct) score++;
        btn.classList.add(correct ? 'correct' : 'wrong');
        // Highlight the correct answer if wrong was chosen
        if (!correct) {
          optionBtns.forEach((b) => { if (b.textContent === q.correctConcept) b.classList.add('correct'); });
        }
        optionBtns.forEach((b) => { b.disabled = true; });
        scoreEl.textContent = `Score: ${score} / ${idx + 1}`;

        const feedback = el('div', 'cl-mcq-feedback', '');
        feedback.textContent = correct
          ? `✓ Correct! "${q.correctConcept}" is a key concept from ${q.caseName}.`
          : `✗ The concept was: "${q.correctConcept}" — from ${q.caseName} (${q.appearance.subsectionTitle}).`;
        qArea.append(feedback);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'cl-nav-btn primary';
        nextBtn.style.marginTop = '10px';
        nextBtn.textContent = idx + 1 < questions.length ? 'Next →' : 'See results';
        nextBtn.addEventListener('click', () => showQuestion(idx + 1));
        qArea.append(nextBtn);
      });
      optionBtns.push(btn);
      qArea.append(btn);
    }
  }

  function showFinale() {
    qArea.innerHTML = '';
    const pct = Math.round((score / questions.length) * 100);
    const grade = pct >= 80 ? '🏆 Excellent!' : pct >= 60 ? '✅ Good work.' : '📖 Keep reviewing.';
    qArea.append(el('p', 'cl-detail-case', `${grade} ${score} / ${questions.length} (${pct}%)`));
    qArea.append(el('p', 'cl-detail-sub', 'Case recognition is a core exam skill.'));

    const retryBtn = document.createElement('button');
    retryBtn.className = 'cl-nav-btn primary';
    retryBtn.textContent = 'Try another quiz';
    retryBtn.addEventListener('click', () => renderQuiz(panel, { cases, allConceptsPool, pinCase: null, onBack }));
    qArea.append(retryBtn);
  }

  showQuestion(0);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function openCaseLibraryPanel({ curriculum }) {
  injectStyles();

  const { panel, close } = openOverlay({ panelClass: 'case-lib', onEscape: () => close() });

  const cases = buildCaseIndex(curriculum);
  const conceptsPool = allConcepts(curriculum);

  function showBrowse() {
    renderBrowse(panel, {
      cases,
      allConceptsPool: conceptsPool,
      onSelectCase: (c) => showDetail(c),
      onStartQuiz: () => showQuiz(null),
      onClose: close,
    });
  }

  function showDetail(caseEntry) {
    renderDetail(panel, {
      caseEntry,
      onBack: showBrowse,
      onQuizThis: (c) => showQuiz(c),
    });
  }

  function showQuiz(pinCase) {
    renderQuiz(panel, {
      cases,
      allConceptsPool: conceptsPool,
      pinCase,
      onBack: showBrowse,
    });
  }

  if (cases.length === 0) {
    panel.append(el('h2', 'lw-h', '📚 Case Library'));
    panel.append(el('p', 'cl-stats', 'No cases found in the curriculum. Add keyCases to your districts to populate the library.'));
    panel.append(button('Leave', 'leave', close));
    return { close };
  }

  showBrowse();
  return { close };
}
