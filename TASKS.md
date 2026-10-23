# LawWorld — Build Tasks

The overnight agent works through these **in order**, one per session. It ticks a box only when the task is done and `npm run build` and `npm test` both pass. Edit, reorder or add tasks freely; keep the `- [ ] **Tnn — Title**` format.

Read `docs/VISION.md` before any task. Mechanics come first; art comes later.

## Core mechanics

- [ ] **T01 — Fix foundations and add a test harness**
  - `src/api/claude.js`: add header `anthropic-dangerous-direct-browser-access: true`; default model `claude-sonnet-5-5`; accept `{ system, messages, tools, maxTokens, model }`; return the full response (text blocks joined plus raw content). Key comes from settings (localStorage) first, `.env` only when `import.meta.env.DEV`.
  - `src/api/obsidian.js`: default base `https://127.0.0.1:27124`; settings-first config; add `listFiles()`; encode each path segment; `writeNote` must refuse any filename that does not start with `TUTOR-SESSION-` and must always refuse `LAW7054-Tort-Ch8-Breach-Standard-of-Care.md`.
  - Create `src/settings.js` (get/set settings in localStorage with try/catch).
  - Delete Vite leftovers (`src/counter.js`, unused assets).
  - Add `"test": "node --test"` to package.json, create `tests/` with a first test (the writeNote guard logic, factored into a pure function in `src/logic/`).
  - Create folders `src/logic/` (pure JS, no Phaser, no DOM, no `import.meta.env`) and `src/ui/` (DOM overlays).
  - Done when: build and tests pass; README explains settings and the self-signed cert step.

- [ ] **T02 — Generate the curriculum from the vault**
  - Use `vault_list` and `vault_outline` (headings, case names, statutes) to map every note matching `LAW7053-`, `LAW7054-`, `LAW7055-` (and `Bingham - Rule of Law.md` into Public Law). Use `vault_read` with a `heading` only where you need detail. Skip `TUTOR-SESSION-*`, cheat sheets and index files as districts (cheat sheets/indexes may inform concepts).
  - Write `src/data/curriculum.js`: modules → regions (season) → districts (one per chapter/lecture note, `sourceFile`) → subsections (one per meaningful `##`/`###` heading: `id`, `title`, `sourceFile`, `heading`, `keyConcepts[]`, `keyCases[]`, `statutes[]`, `prerequisites[]`, `suggestedTutor`).
  - Short extracted lists only; do not copy note prose into the repo.
  - Prerequisites follow the legal logic in VISION §2, within and across districts.
  - Tests: ids unique, all prerequisites exist, no cycles, every subsection has `sourceFile` and `heading`, at least one entry subsection per region has no prerequisites.
  - If the vault is unreachable, build from VISION §2 and the file list in it, set `source: "fallback"` on each district, and say so in finish_task.

- [ ] **T03 — Progress, gating and stats logic** (`src/logic/progress.js`)
  - States: `locked | available | explored | consolidated` per subsection, derived from prerequisites; district and region rollups (a district is consolidated only when all its subsections are).
  - Gap log: `{ subsectionId, concept, stage, firstSeen, lastSeen, timesMissed, resolved }`.
  - Stats update from evaluation results (Case Recall from authority stage, Statutory Interpretation from precision on statutes, Application from scenario, IRAC Fluency from IRAC structure score).
  - Tests: Causation stays locked until Duty of Care and Breach are consolidated; explored ≠ unlock; rollups correct; gaps resolve when later answered solidly.

- [ ] **T04 — Save system** (`src/logic/save.js` + a thin browser adapter)
  - Versioned schema (`version: 1`) covering everything in VISION §7; `migrate()`; storage injected so it's testable; debounced autosave; export/import JSON (file input + download link).
  - Tests with an in-memory storage: round-trip, corrupted save falls back to a fresh game without throwing, migration hook runs.

- [ ] **T05 — Encounter engine** (`src/logic/encounter.js`)
  - Provider-agnostic state machine for the stages in VISION §1. API: `createEncounter({subsection, tutor, priorGaps})`, `next()` returns the current prompt object, `submit(answer)`, `hint()`, `notSure()`, `ask(question)`, `leave()`, `result()`.
  - Open answers under 15 characters are rejected with a gentle message (not counted as an exchange). MCQ answers must be one of the options.
  - Follow-ups (max 2 per stage) when the evaluator says `partial`/`missing`. Minimum 8 exchanges before a verdict. Consolidation rule exactly as VISION §1.
  - The engine depends on an injected `tutor` interface: `generate(stage, context) → prompt`, `evaluate(stage, prompt, answer, context) → { verdict: 'solid'|'partial'|'missing', feedback, conceptsHit, conceptsMissed, iracScore?, followUp? }`, `hint(...)`, `answerQuestion(...)`.
  - Tests with a mock tutor: cannot reach a verdict without answering; short answer rejected; hints never reveal the model answer field; consolidation and explored outcomes; gaps produced.

- [ ] **T06 — Claude tutor provider and offline fallback**
  - `src/data/tutors.js`: the three personas (VISION §3) as system-prompt fragments with voice examples.
  - `src/api/tutor.js`: implements the tutor interface with Claude. Context = the note section for the subsection (fetched live via Obsidian, section extracted by a pure function `extractSection(markdown, heading)` in `src/logic/notes.js`), prior TUTOR-SESSION notes for that subsection, and open gaps. Ask for strict JSON; parse defensively (strip code fences, retry once with a repair prompt). `answerQuestion` uses the web_search server tool only when the note lacks the answer and marks it external.
  - `src/api/offlineTutor.js`: same interface, built-in bank (`src/data/offlineBank.js`) plus keyword-overlap evaluation against `keyConcepts`. Write a full 7-stage bank for at least the first 3 Contract subsections and the first Tort subsection, grounded in the vault notes (use `vault_read`).
  - Tests: `extractSection`, JSON parsing/repair, offline evaluator verdicts.

- [ ] **T07 — Encounter UI and Settings**
  - DOM overlay (`src/ui/encounter.js`, CSS in `src/style.css`) over the canvas: tutor name and portrait swatch, scrolling transcript, multi-line answer box (Enter submits, Shift+Enter new line), buttons **Submit**, **Hint**, **I'm not sure**, **Ask a question**, **Leave**; MCQ options as buttons; stage pips 1–7; offline-mode badge; loading state while Claude thinks; readable error if a call fails (with "retry" and "continue offline").
  - While any overlay is open, Phaser keyboard input is disabled and key captures released (otherwise W/A/S/D and Space can't be typed); re-enable on close.
  - Settings overlay (Esc menu): Claude API key, model, Obsidian URL and token, **Test connection** buttons with clear success/failure text and the instruction to open `https://127.0.0.1:27124` once and accept the certificate.
  - Encounter end writes the result into progress + save.
  - Done when a full encounter can be played start to finish in offline mode.

- [ ] **T08 — Session write-back and memory**
  - On encounter end, write `TUTOR-SESSION-YYYY-MM-DD-HHMM-<subsectionId>.md` via the guarded `writeNote` (frontmatter: date, module, district, subsection, tutor, outcome; sections: Covered, Landed, Gaps, Next time).
  - On encounter start, find prior session notes for that subsection (`listFiles` + filter) and include their Gaps/Next time in tutor context; the intro should reference them ("Last time the postal rule exceptions didn't land…").
  - Tests for the note formatter and filename builder.

## World

- [ ] **T09 — World map generated from the curriculum**
  - Replace the single green grid with a tilemap built from `curriculum.js`: hub town (spring) in the centre, paths to Contract (summer), Tort (autumn), Public Law (winter). Each district is a cluster of buildings around a signpost and an unlit brazier; each subsection is a building with a door. Layout is computed (deterministic) so new vault notes add buildings without hand-editing.
  - Collision with buildings, trees, water, fences. Camera bounded to the world. Region name banner on entering a region.
  - Walk to a door and press **E**: available → choose tutor → encounter; locked → padlock tooltip listing prerequisites.
  - Building colours show state (locked / available / explored / consolidated).
  - Keep world generation logic pure and tested (`src/logic/layout.js`: no overlapping buildings, every door reachable from the hub).

- [ ] **T10 — Seasons, sprites and the cat**
  - Generated-texture pixel art: grass/flower/sand/snow tiles per season, trees per season, buildings with roofs and doors.
  - Weather particles per region (petals, sun motes, falling leaves, snow) that switch when the player crosses a region border.
  - Player: law student with messenger bag, 4 directions × 2-frame walk.
  - Cat companion: follows with a short delay along the player's path, idles (sit, tail flick), sits next to the player during encounters.

- [ ] **T11 — Journal and stats screen (Tab)**
  - Stats bars; per-module tree of districts/subsections with states; "Things to revisit" gap list (click to see the concept and which building it's in); last 10 sessions.

- [ ] **T12 — Client NPCs**
  - Wandering client NPCs per region. Each brings a short problem built (by Claude, or the offline bank) from subsections the player has explored or consolidated, biased toward open gaps. Player types advice; the tutor evaluates using IRAC; client reacts; reward = region material and stat gains. Uses the encounter engine in a `client` mode (scenario → evaluation → one follow-up → verdict).

- [ ] **T13 — Knowledge garden and braziers**
  - Seeds from solid answers. Garden plots in the hub: plant (E), water by answering a quick retrieval question chosen by spaced repetition (open gaps first, then consolidated topics not seen recently). Growth stages; withered if not watered for 3 in-game days. Braziers light when a district is fully consolidated and stay lit (glow effect).

- [ ] **T14 — QA pass against the vision**
  - Read the whole codebase against VISION.md. Write `QA_REPORT.md`: what works, what violates the learning rules, bugs, missing pieces, ranked. Fix the top issues that fit this session; add the rest as new tasks below.

## Agent-proposed
