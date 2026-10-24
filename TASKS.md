# LawWorld — Build Tasks

The overnight agent works through these **in order**, one per session. It ticks a box only when the task is done and `npm run build` and `npm test` both pass. Edit, reorder or add tasks freely; keep the `- [ ] **Tnn — Title**` format.

Read `docs/VISION.md` before any task. Mechanics come first; art comes later.

## Vertical slice (run this first)

- [x] **T00 — Playable encounter demo (offline, hardcoded)**
  - Goal: prove the study tool works before spending more. One real subsection, offline tutor, full encounter UI. No vault, no Phaser world changes needed beyond a single trigger zone.
  - **Hardcoded subsection** — create `src/data/demoSubsection.js`:
    ```js
    export const demoSubsection = {
      id: 'contract-offer-acceptance',
      title: 'Offer & Acceptance',
      module: 'Contract Law',
      keyConcepts: ['offer','invitation to treat','acceptance','communication of acceptance','postal rule','revocation'],
      keyCases: ['Carlill v Carbolic Smoke Ball Co [1893]','Hyde v Wrench [1840]','Harvey v Facey [1893]','Pharmaceutical Society v Boots [1953]','Fisher v Bell [1961]','Adams v Lindsell [1818]','Byrne v Van Tienhoven [1880]','Entores v Miles Far East [1955]'],
      statutes: ['Sale of Goods Act 1979 s.57'],
      prerequisites: [],
    }
    ```
  - **Offline bank** — create `src/data/offlineBank.js` with a full 7-stage bank for `contract-offer-acceptance`. Each stage entry: `{ prompt, modelAnswer, hints: [string, string], cases: [{name, ratio, whyItMatters}], evaluation(answer) → {verdict, feedback, conceptsHit, conceptsMissed, followUp?} }`. Write real law: ratios, distinctions, IRAC structure. Stage 7 is a scenario: *"A supermarket displays tins of beans priced 50p. Alice picks one up. Bob, the manager, says 'sorry, that's mispriced.' Has a contract formed?"* — answer requires Fisher v Bell, Pharmaceutical Society v Boots, and identifies the offer as Alice taking it to the till.
  - **Encounter engine** — create `src/logic/encounter.js`: provider-agnostic state machine, stages 1–7. `createEncounter(subsection, tutorImpl)` → `{ next(), submit(answer), hint(), notSure(), ask(question), leave(), result() }`. Answers under 15 chars get a gentle rejection (not counted). Min 8 exchanges before any verdict. Follow-ups (max 2 per stage) when `partial`/`missing`. Consolidation: stages 3 and 5 both solid + checkpoint ≥ 2/3.
  - **Offline tutor** — create `src/api/offlineTutor.js`: implements the tutor interface using the bank. Evaluation is keyword+concept overlap; feedback quotes the relevant case ratio when a case is missed.
  - **Encounter UI** — create `src/ui/encounter.js` (DOM overlay, not Phaser): dark panel over the canvas, tutor name ("Professor Hale") + colour swatch, scrolling transcript div, multi-line textarea (Enter = submit, Shift+Enter = newline), buttons Submit / Hint / I'm not sure / Ask a question / Leave, stage pip row (●○○○○○○), offline badge. While open: disable Phaser keyboard captures so WASD and Space can be typed. On close: re-enable.
  - **Trigger** — in `GameScene.js`: place a single grey rectangle labelled "Contract Law" near the player start. On overlap + E key: open the encounter with `demoSubsection` and the offline tutor.
  - **Tests** — `tests/encounter.test.js`: cannot consolidate without answering; short answer rejected; hint does not leak model answer; leave mid-session returns `explored`; full solid run returns `consolidated`.
  - **Settings stub** — create `src/settings.js` (get/set localStorage, try/catch) so later tasks can import it.
  - Add `"test": "node --test"` to package.json.
  - Done when: `npm run build` and `npm test` pass; `npm run dev` shows the green world; walking into the grey rectangle and pressing E opens a working encounter you can play to completion in offline mode.

## Core mechanics

- [x] **T01 — Fix foundations and add a test harness**
  - `src/api/claude.js`: add header `anthropic-dangerous-direct-browser-access: true`; default model `claude-sonnet-5-5`; accept `{ system, messages, tools, maxTokens, model }`; return the full response (text blocks joined plus raw content). Key comes from settings (localStorage) first, `.env` only when `import.meta.env.DEV`.
  - `src/api/obsidian.js`: default base `https://127.0.0.1:27124`; settings-first config; add `listFiles()`; encode each path segment; `writeNote` must refuse any filename that does not start with `TUTOR-SESSION-` and must always refuse `LAW7054-Tort-Ch8-Breach-Standard-of-Care.md`.
  - Create `src/settings.js` (get/set settings in localStorage with try/catch).
  - Delete Vite leftovers (`src/counter.js`, unused assets).
  - Add `"test": "node --test"` to package.json, create `tests/` with a first test (the writeNote guard logic, factored into a pure function in `src/logic/`).
  - Create folders `src/logic/` (pure JS, no Phaser, no DOM, no `import.meta.env`) and `src/ui/` (DOM overlays).
  - Done when: build and tests pass; README explains settings and the self-signed cert step.

- [x] **T02 — Generate the curriculum from the vault**
  - Use `vault_list` and `vault_outline` (headings, case names, statutes) to map every note matching `LAW7053-`, `LAW7054-`, `LAW7055-` (and `Bingham - Rule of Law.md` into Public Law). Use `vault_read` with a `heading` only where you need detail. Skip `TUTOR-SESSION-*`, cheat sheets and index files as districts (cheat sheets/indexes may inform concepts).
  - Write `src/data/curriculum.js`: modules → regions (season) → districts (one per chapter/lecture note, `sourceFile`) → subsections (one per meaningful `##`/`###` heading: `id`, `title`, `sourceFile`, `heading`, `keyConcepts[]`, `keyCases[]`, `statutes[]`, `prerequisites[]`, `suggestedTutor`).
  - Short extracted lists only; do not copy note prose into the repo.
  - Prerequisites follow the legal logic in VISION §2, within and across districts.
  - Tests: ids unique, all prerequisites exist, no cycles, every subsection has `sourceFile` and `heading`, at least one entry subsection per region has no prerequisites.
  - If the vault is unreachable, build from VISION §2 and the file list in it, set `source: "fallback"` on each district, and say so in finish_task.

- [x] **T03 — Progress, gating and stats logic** (`src/logic/progress.js`)
  - States: `locked | available | explored | consolidated` per subsection, derived from prerequisites; district and region rollups (a district is consolidated only when all its subsections are).
  - Gap log: `{ subsectionId, concept, stage, firstSeen, lastSeen, timesMissed, resolved }`.
  - Stats update from evaluation results (Case Recall from authority stage, Statutory Interpretation from precision on statutes, Application from scenario, IRAC Fluency from IRAC structure score).
  - Tests: Causation stays locked until Duty of Care and Breach are consolidated; explored ≠ unlock; rollups correct; gaps resolve when later answered solidly.

- [x] **T04 — Save system** (`src/logic/save.js` + a thin browser adapter)
  - Versioned schema (`version: 1`) covering everything in VISION §7; `migrate()`; storage injected so it's testable; debounced autosave; export/import JSON (file input + download link).
  - Tests with an in-memory storage: round-trip, corrupted save falls back to a fresh game without throwing, migration hook runs.

- [x] **T05 — Encounter engine** (`src/logic/encounter.js`)
  - Provider-agnostic state machine for the stages in VISION §1. API: `createEncounter({subsection, tutor, priorGaps})`, `next()` returns the current prompt object, `submit(answer)`, `hint()`, `notSure()`, `ask(question)`, `leave()`, `result()`.
  - Open answers under 15 characters are rejected with a gentle message (not counted as an exchange). MCQ answers must be one of the options.
  - Follow-ups (max 2 per stage) when the evaluator says `partial`/`missing`. Minimum 8 exchanges before a verdict. Consolidation rule exactly as VISION §1.
  - The engine depends on an injected `tutor` interface: `generate(stage, context) → prompt`, `evaluate(stage, prompt, answer, context) → { verdict: 'solid'|'partial'|'missing', feedback, conceptsHit, conceptsMissed, iracScore?, followUp? }`, `hint(...)`, `answerQuestion(...)`.
  - Tests with a mock tutor: cannot reach a verdict without answering; short answer rejected; hints never reveal the model answer field; consolidation and explored outcomes; gaps produced.

- [x] **T06 — Claude tutor provider and offline fallback**
  - `src/data/tutors.js`: the three personas (VISION §3) as system-prompt fragments with voice examples.
  - `src/api/tutor.js`: implements the tutor interface with Claude. Context = the note section for the subsection (fetched live via Obsidian, section extracted by a pure function `extractSection(markdown, heading)` in `src/logic/notes.js`), prior TUTOR-SESSION notes for that subsection, and open gaps. Ask for strict JSON; parse defensively (strip code fences, retry once with a repair prompt). `answerQuestion` uses the web_search server tool only when the note lacks the answer and marks it external.
  - `src/api/offlineTutor.js`: same interface, built-in bank (`src/data/offlineBank.js`) plus keyword-overlap evaluation against `keyConcepts`. Write a full 7-stage bank for at least the first 3 Contract subsections and the first Tort subsection, grounded in the vault notes (use `vault_read`).
  - Tests: `extractSection`, JSON parsing/repair, offline evaluator verdicts.

- [x] **T07 — Encounter UI and Settings**
  - DOM overlay (`src/ui/encounter.js`, CSS in `src/style.css`) over the canvas: tutor name and portrait swatch, scrolling transcript, multi-line answer box (Enter submits, Shift+Enter new line), buttons **Submit**, **Hint**, **I'm not sure**, **Ask a question**, **Leave**; MCQ options as buttons; stage pips 1–7; offline-mode badge; loading state while Claude thinks; readable error if a call fails (with "retry" and "continue offline").
  - While any overlay is open, Phaser keyboard input is disabled and key captures released (otherwise W/A/S/D and Space can't be typed); re-enable on close.
  - Settings overlay (Esc menu): Claude API key, model, Obsidian URL and token, **Test connection** buttons with clear success/failure text and the instruction to open `https://127.0.0.1:27124` once and accept the certificate.
  - Encounter end writes the result into progress + save.
  - Done when a full encounter can be played start to finish in offline mode.

- [x] **T08 — Session write-back and memory**
  - On encounter end, write `TUTOR-SESSION-YYYY-MM-DD-HHMM-<subsectionId>.md` via the guarded `writeNote` (frontmatter: date, module, district, subsection, tutor, outcome; sections: Covered, Landed, Gaps, Next time).
  - On encounter start, find prior session notes for that subsection (`listFiles` + filter) and include their Gaps/Next time in tutor context; the intro should reference them ("Last time the postal rule exceptions didn't land…").
  - Tests for the note formatter and filename builder.

## World

- [x] **T09 — World map generated from the curriculum**
  - Replace the single green grid with a tilemap built from `curriculum.js`: hub town (spring) in the centre, paths to Contract (summer), Tort (autumn), Public Law (winter). Each district is a cluster of buildings around a signpost and an unlit brazier; each subsection is a building with a door. Layout is computed (deterministic) so new vault notes add buildings without hand-editing.
  - Collision with buildings, trees, water, fences. Camera bounded to the world. Region name banner on entering a region.
  - Walk to a door and press **E**: available → choose tutor → encounter; locked → padlock tooltip listing prerequisites.
  - Building colours show state (locked / available / explored / consolidated).
  - Keep world generation logic pure and tested (`src/logic/layout.js`: no overlapping buildings, every door reachable from the hub).

- [x] **T10 — Seasons, sprites and the cat**
  - Generated-texture pixel art: grass/flower/sand/snow tiles per season, trees per season, buildings with roofs and doors.
  - Weather particles per region (petals, sun motes, falling leaves, snow) that switch when the player crosses a region border.
  - Player: law student with messenger bag, 4 directions × 2-frame walk.
  - Cat companion: follows with a short delay along the player's path, idles (sit, tail flick), sits next to the player during encounters.

- [x] **T11 — Journal and stats screen (Tab)**
  - Stats bars; per-module tree of districts/subsections with states; "Things to revisit" gap list (click to see the concept and which building it's in); last 10 sessions.

- [x] **T12 — Client NPCs**
  - Wandering client NPCs per region. Each brings a short problem built (by Claude, or the offline bank) from subsections the player has explored or consolidated, biased toward open gaps. Player types advice; the tutor evaluates using IRAC; client reacts; reward = region material and stat gains. Uses the encounter engine in a `client` mode (scenario → evaluation → one follow-up → verdict).

- [ ] **T13 — Knowledge garden and braziers**
  - Seeds from solid answers. Garden plots in the hub: plant (E), water by answering a quick retrieval question chosen by spaced repetition (open gaps first, then consolidated topics not seen recently). Growth stages; withered if not watered for 3 in-game days. Braziers light when a district is fully consolidated and stay lit (glow effect).

- [ ] **T14 — QA pass against the vision**
  - Read the whole codebase against VISION.md. Write `QA_REPORT.md`: what works, what violates the learning rules, bugs, missing pieces, ranked. Fix the top issues that fit this session; add the rest as new tasks below.

- [x] **T15 — Atmospheric music (procedural)**
  - Create `src/audio/music.js`: Web Audio API ambient engine, no downloads needed.
  - Four region themes generated in code: Contract (summer) = bright plucked strings (triangle + sawtooth oscillators, 120 BPM arpeggio in C major); Tort (autumn) = minor-key drone (detuned sawtooth pair, slow LFO on gain, Am); Public Law (winter) = sparse open fifths (sine waves, long attack, slow decay); Hub (spring) = warm pad (sine + triangle mix, gentle vibrato).
  - Encounter track: low drone with rising tension (sawtooth, filter cutoff sweeping up slowly, diminished chord).
  - Each theme loops seamlessly (schedule next buffer before current ends).
  - Crossfade on region/encounter transition: 2-second linear gain ramp out → in.
  - `MusicManager`: `playRegion(regionId)`, `playEncounter()`, `stop()`, `setVolume(0–1)`, `mute(bool)`.
  - Wire into `GameScene.js` region overlap events and the encounter open/close hooks.
  - Settings overlay: volume slider and mute toggle (persist to settings.js).
  - No external files, no network requests.
  - Done when music plays in browser and changes on region cross and encounter open.

- [x] **T16 — Dialogue portraits (canvas-generated)**
  - Create `src/ui/portraits.js`: draw pixel-art tutor portraits on an `OffscreenCanvas` (64×64px), return as `ImageBitmap`.
  - Professor Hale: silver hair, round glasses, dark green robes, warm skin tone — Contract Law.
  - Dr Okafor: close-cropped hair, sharp jaw, deep purple robes — Tort Law.
  - Ms Patel: long dark braid, red and gold robes, reading glasses — Public Law.
  - Each portrait: 8px grid, ~20 distinct colours, drawn with `ctx.fillRect` calls only (no images loaded).
  - Display in encounter UI (`src/ui/encounter.js`): 64×64 `<canvas>` beside tutor name; swap on tutor change.
  - Export `getPortrait(tutorId)` → `HTMLCanvasElement`.
  - Done when each tutor's portrait appears in the encounter panel.

- [x] **T17 — Region transitions**
  - Create `src/ui/transitions.js`: DOM overlay div (full-screen, `position:fixed`, `z-index:1000`, `pointer-events:none`).
  - Fade transition: opacity 0→1→0 over 600ms total, colour matches region season (green/amber/grey/white).
  - Region name banner: centred text with season colour, appears during the fade-in peak (300ms), font size 2rem, fades with the overlay.
  - `TransitionManager`: `crossRegion(fromRegion, toRegion, onMidpoint)` — calls `onMidpoint` at opacity peak so GameScene can swap tiles/weather while screen is black.
  - Wire into `GameScene.js` region border colliders.
  - Done when crossing a region border shows a colour flash and the region name.

- [x] **T18 — Sound effects (Web Audio)**
  - Create `src/audio/sfx.js`: all sounds synthesised with Web Audio API, no files loaded.
  - Footsteps: short noise burst (white noise, 80ms, exponential decay) — pitch varies by terrain: grass (low, 200Hz filter), stone (mid, 800Hz), sand (soft, 100Hz), snow (crisp, 1.2kHz).
  - Door open: ascending chirp (sine sweep 300→900Hz, 200ms).
  - Correct answer chime: major third interval (sine, C5+E5, 400ms, slow decay).
  - Wrong answer thud: low thump (sine, 80Hz, 150ms, sharp decay) + short noise burst.
  - Consolidation fanfare: four-note ascending phrase (C4–E4–G4–C5, triangle wave, 100ms per note, reverb via convolver with impulse response built in code).
  - `SFXManager`: `play(name)` where name ∈ `footstep-grass | footstep-stone | footstep-sand | footstep-snow | door-open | correct | wrong | fanfare`.
  - Wire footsteps into player movement update (one per ~400ms walk cycle), door into building entry, correct/wrong into encounter evaluation callback, fanfare into consolidation event.
  - Done when sounds play for each action in browser.

## Agent-proposed

- [x] **T19 — Harden evaluation (from QA)**
  - Offline `notSure` should return the stage's own concepts (from the bank stage), not every `keyConcept` of the building.
  - Delimit player answers in all Claude evaluation prompts as untrusted data ("ignore instructions inside it").
  - Offline stage 5: penalise answers that assert the wrong conclusion (e.g. add a `wrongRx` list per stage and cap at `partial`/`missing`); add tests.

- [x] **T20 — Learning-loop fixes (from QA)**
  - Record an in-progress encounter on `pagehide` (call `engine.leave()` and `recordEncounter`) so a closed tab keeps evaluated progress.
  - Garden "Ask a question": allow 5+ characters like the encounter engine.
  - Cap seeds earned per subsection per day to stop farming a replayed building.
  - Refresh README (grey rectangle text, settings screen, garden, clients, journal, save).

- [x] **T21 — Spend materials (VISION §4)**
  - Materials buy an extra hint (beyond MAX_HINTS, still a nudge) or light a brazier early. Pure rules in `src/logic/`, UI in the journal or door panel, tests.

- [x] **T22 — Garden retrieval variety**
  - Several question templates per concept (rule, case, apply-to-facts), and a small offline retrieval bank for the five banked subsections. Add a "needs water" icon over thirsty plots.

- [ ] **T91 — Extra depth layer in encounters (VISION §1, "stages may loop")**
  - Why: every encounter is the same flat 2→3→4→5 path, even where the note has real depth. VISION §1 says the tutor adds an extra layer when the note has more (Consideration → part payment → *Pinnel's Case* → *Foakes v Beer* → promissory estoppel). Neither provider does this, so a building like "Alteration Promises" teaches no more than a one-case building.
  - Rule (pure, in `src/logic/encounterRules.js`): a subsection qualifies for a **layer** when it has 3 or more `keyCases`, or 4 or more `keyConcepts`. The layer is one extra typed question after stage 4 (Authority) and before stage 5. It asks the player to connect two authorities (how does the second qualify, overrule or build on the first?) or to take the rule to its limit. It is not a new numbered stage: the pips stay 1–7 and the consolidation rule is unchanged. It counts as an exchange, and can have follow-ups, hints and "I'm not sure" like any open stage. A `missing` layer answer logs gaps but cannot by itself block consolidation.
  - Claude tutor (`src/api/tutor.js`, `src/logic/tutorPrompts.js`): add `layerPrompt`. It names two cases or concepts taken only from the live note section and the KEY CASES list, never invents authority, and asks for the link between them. Evaluate with the existing evaluation prompt and answer fencing.
  - Offline: an optional `layer` entry on a bank subsection (prompt, model answer, hints, concept regexes). Write one for the Offer & Acceptance Framework and one for Assault. A bank without a `layer` skips it.
  - Session note: `Covered` lists the layer line and its gaps appear under `Gaps`.
  - Tests: a qualifying subsection gets exactly one layer question and a non-qualifying one gets none; a layer cannot be skipped; a `missing` layer answer cannot consolidate by itself but does not block consolidation when stages 3 and 5 are solid; hints do not leak the model answer; layer gaps reach the session note.
  - Done when: `npm run build` and `npm test` pass; an offline encounter on a layered building shows one extra "going deeper" question between Authority and Application; Claude mode asks a layer question that cites only cases named in the note.
  - Related, not in this task: VISION §1.3 wants old gaps to resurface at the start of the next encounter. Today the intro only mentions them. A later task could open with one typed recall question on the top open gap.

- [ ] **T92 — Keep the map in step with the vault (live heading check and new-note districts)**
  - Why: the curriculum is a static snapshot. VISION §2/§5 say new notes add new buildings and the game reads notes live. Today a renamed heading silently makes the tutor receive the whole note. Several vault notes have no district at all (for example `LAW7054-Contract-Week3-Consideration-Estoppel.md`, `LAW7054-Tort-W2-Duty-of-Care-Psychiatric-Injury.md`, `LAW7055-Parliamentary-Sovereignty-Notes.md`), so they are invisible to the player.
  - Pure logic in `src/logic/vaultSync.js`: `parseHeadings(markdown)` returns `##` and `###` headings (ignoring `#` lines inside code fences). `diffAgainstCurriculum(curriculum, vaultFiles, headingsByFile)` returns `{ missingFiles, missingHeadings, unmappedNotes }`. `districtFromNote(file, headings)` builds a district with `makeDistrict`. Region comes from the `LAW7053/7054/7055` prefix and `Tort`/`Contract` in the name. Subsections are parallel entries (`pre: []`) and the district is marked `source: 'vault-live'`. Cheat sheets, indexes, `TUTOR-SESSION-*` and already-mapped notes are excluded. Notes whose region can't be guessed are reported, not placed.
  - Browser glue in `src/api/vaultSync.js`: only if an Obsidian token is set, `listFiles()` plus `readNote` of each mapped note (batched, failures ignored) produces the diff at most once a day, cached in settings (never in the save). Offline or unreachable means the static map is used and nothing breaks.
  - Surface it: Settings gets a "Check vault against the map" button with a readable report (headings that moved, notes with no building). The door panel says "this note's heading changed: the tutor is using the whole note" instead of failing silently. New-note districts are merged into the curriculum when the scene is created, so `buildWorld` places them.
  - Hard rules: read-only on the vault; no note prose in the repo or cache (headings and filenames only); no study-note writes.
  - Tests: heading parsing (code fences, trailing hashes), the diff, region guessing, exclusion rules, the merged curriculum keeps unique ids, valid prerequisites and no cycles, and `buildWorld` stays collision-free and reachable with generated districts.
  - Done when: `npm run build` and `npm test` pass; with a stubbed vault listing containing one extra `LAW7054-` note, a new building appears in the Contract region; renaming a mapped heading in the stub gives a clear warning rather than silent whole-note context.

- [ ] **T93 — Make consolidation feel like an event (result card and brazier moment)**
  - Why: the verdict is a block of plain transcript text and the world barely reacts, so earning "consolidated" doesn't feel like it changed anything. This is feel and visual work, below T91 and T92. The Phaser parts have not been seen in a browser, so check them by eye in a dev run.
  - Result card: when the verdict arrives, show a card in the encounter panel. It has one chip per stage (Plain English, Precision, Authority, Application, Checkpoint) coloured solid, partial or missing, the IRAC score 0–4 under Application, the seeds earned and stat gains, and the gaps as a "revisit" list. It is built by a pure `resultCardModel(result, rewards)` in `src/logic/encounterView.js`. The DOM only renders it. It is a display of the verdict, not a click-through that replaces any question.
  - World reaction: after a `consolidated` close, the camera eases to the building, the door recolours with a short pulse, and if that completes the district the brazier lights with the existing glow plus the fanfare. Then the camera returns to the player. Input stays locked only for that short pan (under 2 s), and the overlay lock must not leak.
  - Explored outcome gets a gentler version: explored tint, no fanfare, and the card says plainly what must come out solid to consolidate.
  - Tests: `resultCardModel` for consolidated, explored and left-early results (no stage reported as answered that wasn't); reward lines match the real rewards; the card never shows a verdict the engine did not give.
  - Done when: `npm run build` and `npm test` pass; finishing an encounter in a dev run shows the chips and rewards, and a consolidated building visibly pulses and lights its brazier (if the district is complete) on return to the world.
