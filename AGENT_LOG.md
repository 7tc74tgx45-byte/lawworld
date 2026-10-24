# LawWorld — Overnight agent log

Newest entries at the bottom.

## T00 — done — 2026-10-24 00:50:25
Cost $1.85 · 20 min · attempt 1

**What changed:** The offline encounter demo is built end to end. `npm run build` and `npm test` both pass (13 tests). I have not opened it in a browser, so the Phaser trigger zone and the DOM overlay are untested by eye.

- **Demo subsection:** `src/data/demoSubsection.js` is exactly as specified.
- **Offline bank:** `src/data/offlineBank.js` holds all 7 stages for Offer & Acceptance, using case notes in `offlineCases.js` and checkpoint questions in `offlineMcq.js`.
  - Every case has facts, ratio and why it matters, written by me and not copied from the vault.
  - Stage 5 is the beans scenario. It needs Fisher v Bell, Pharmaceutical Society v Boots, and the offer identified as Alice taking the tin to the till. It also scores IRAC structure.
  - The checkpoint is 3 MCQs, each with a hint and an explanation.
- **Offline tutor:** `src/api/offlineTutor.js` scores answers on keyword and concept overlap (`src/logic/keywordEval.js`). When a case is missed, the feedback quotes that case's ratio.
  - Hints are two Socratic nudges per stage and never contain the model answer.
  - "I'm not sure" logs gaps and teaches the idea. It also asks the player to restate it, and that restatement can only score partial.
  - "Ask a question" answers from the bank. If the bank has nothing, it says so and does not search the web.
- **Encounter engine:** `src/logic/encounter.js` follows the spec: stages 1–7, answers under 15 characters rejected without counting, up to 2 follow-ups per stage, and consolidation only when stages 3 and 5 are solid and the checkpoint is 2/3 or better.
  - Gaps are collected from missing or partial concepts.
  - `result()` and `leave()` return the outcome, stage verdicts, checkpoint score, gaps and transcript. Leaving early always gives `explored`.
- **UI:** `src/ui/encounter.js` and `encounter.css` build the dark DOM overlay as specified, with these additions:
  - MCQ options appear as buttons. A short or rejected answer stays in the textarea so it can be extended.
  - Hint and "I'm not sure" are hidden on the intro and verdict screens.
- **World trigger:** a grey "Contract Law" rectangle sits near the player start. Walking onto it shows "Press E to study", and E opens the encounter. While the overlay is open, Phaser keyboard input and key captures are off, so WASD and Space can be typed. They come back on close, and a banner then shows the outcome.
- **Settings stub:** `src/settings.js` reads and writes localStorage inside try/catch.
- **package.json:** `"test": "node --test"` is added.

The tests in `tests/encounter.test.js` cover:
- no consolidation without answering;
- short answers rejected and not counted;
- hints not leaking the model answer;
- leaving mid-session giving `explored`;
- a full solid run giving `consolidated`.

They also cover follow-up caps, MCQ validation, a weak stage 5 blocking consolidation, and the 8-exchange minimum.

**Try it:** Run `npm run dev` and open the page. The player is the white square in the centre of the green world. Walk right and up to the grey "Contract Law" rectangle, then press E.

Play the encounter as follows:
1. Click Continue on the intro.
2. Type answers for stages 2–5 (Enter submits, Shift+Enter is a new line).
3. Try a short answer, Hint, "I'm not sure" and "Ask a question" (for example "what is the postal rule?") along the way.
4. Answer the 3 MCQs and read the verdict.

For a quick consolidated run, give answers that name the concepts and cases (Hyde v Wrench, Adams v Lindsell, Byrne v Van Tienhoven, Entores, s.57). Give stage 5 as Issue / Rule / Application / Conclusion citing Fisher v Bell and Boots, then pick the correct MCQ options. Press Leave at any point to get an `explored` banner back in the world.

**Design notes:** - **8-exchange minimum:** the 4 open answers plus 3 MCQs make only 7 exchanges, so a clean run would hit the minimum short. The tutor then asks one short reflection question before the verdict ("which part feels least sure?"). That is an 8th typed answer, so the rule holds without padding the bank. Follow-ups and "not sure" restatements also count toward the minimum.
- **Follow-ups and "not sure":** a follow-up that is answered solidly replaces the earlier thin verdict for that stage. Saying "I'm not sure" at a stage caps it at partial after the restatement.
- **Stage 1:** it is shown as an intro with a Continue button. It has no question, so it is not an exchange and does not skip anything.
- **Offline marking:** it is regex keyword matching, so it is generous to answers that name the right ideas and blunt on unusual wording. It is clearly labelled OFFLINE MODE. Fynn should try a few paraphrases and tell me where it marks wrongly.
- **Law accuracy:** the s.57 Sale of Goods Act 1979 summary (auction, hammer, bid retraction) is standard England & Wales law, but I did not check it against the vault. The vault tools weren't needed for this task.
- **Bank scope:** the offline bank only covers `contract-offer-acceptance`. Other subsections throw a clear "No offline bank" error until T06.
- **T05 still to do:** `src/logic/encounter.js` is already a first version of the T05 engine. T05 needs to add `priorGaps`, the `{subsection, tutor, priorGaps}` signature and mock-tutor tests.

**Next:** T01: tidy `claude.js` and `obsidian.js`, add the `writeNote` guard and delete the Vite leftovers (`src/counter.js`, unused assets).

T05: promote `src/logic/encounter.js` with `priorGaps` and mock-tutor tests.

T07: reuse `src/ui/encounter.js` and add the Settings overlay and a loading/error state for Claude calls.

## T01 — done — 2026-10-24 00:52:03
Cost $0.27 · 2 min · attempt 1

**What changed:** T01 is finished. `npm run build` passes and `npm test` passes all 20 tests (13 existing, 7 new).

**Claude client (`src/api/claude.js`)**
- `callClaude({ system, messages, tools, maxTokens, model })` sends the `anthropic-dangerous-direct-browser-access: true` header.
- The default model is `claude-sonnet-5-5`, overridable in Settings or per call.
- It returns `{ text, content, raw }`: the text blocks joined, the raw content blocks, and the whole response body.
- The key comes from Settings (localStorage) first. `VITE_CLAUDE_API_KEY` is read only when `import.meta.env.DEV` is true.
- I kept `askClaude(prompt)` as a small wrapper that returns just the text.

**Obsidian client (`src/api/obsidian.js`)**
- The default base is `https://127.0.0.1:27124`, with URL and token read from Settings first and `.env` only in dev.
- I added `listFiles()`, and each path segment is now encoded separately.
- `writeNote` runs the guard before any config or network access.
- I also added `testConnection()` for the Settings screen in T07.
- `searchNotes` now uses POST, which is what the plugin's simple-search endpoint expects. The old GET would not have worked.

**Write guard (`src/logic/noteGuard.js`, pure)**
- A write is allowed only for a plain `TUTOR-SESSION-*.md` file in the vault root.
- It always refuses `LAW7054-Tort-Ch8-Breach-Standard-of-Care.md`, including in upper case, inside a folder, or percent-encoded.
- It also refuses folders, `..`, encoded traversal, non-strings and wrong extensions.
- The same file holds `encodeVaultPath` and `normaliseBaseUrl`.
- `tests/noteGuard.test.js` covers all of this.

**Settings (`src/settings.js`)**
- It already existed from T00. I added `getStoredSetting`, which returns only what Fynn saved and ignores defaults, so "Settings first, then `.env`" works.

**Cleanup**
- I deleted `src/counter.js`, `src/assets/*`, `src/style.css` and `public/icons.svg`. None of them were imported.
- I removed the `/obsidian` dev proxy from `vite.config.js`, since the game now calls Obsidian directly.
- I rewrote `.env.example` with the new `https://127.0.0.1:27124` default. I did not touch your local `.env`.
- I linked `favicon.svg` in `index.html`.

**README**
- It now explains the settings, their order of precedence, the self-signed certificate step, and the write safety rule.

`src/logic/` and `src/ui/` already existed from T00.

**Try it:** —

**Design notes:** - **Old `.env` values:** your `.env` may still hold the old `VITE_OBSIDIAN_BASE_URL=http://127.0.0.1:27123`. In dev it is used only when Settings has no URL, so update it or delete the line. Otherwise dev will point at the wrong port.
- **Settings screen:** the Settings screen is T07. Until then the README shows a one-line console snippet to set the key and token in localStorage.
- **Browser calls to Claude:** a Claude key stored in localStorage and called straight from the browser is fine for a personal local tool. Don't deploy this publicly with a key in it.
- **Not tested here:** I could not test the real Obsidian or Claude calls from this session. The fetch code follows the documented APIs, but the first live run in T06/T07 may need small tweaks. For example, `listFiles` assumes the plugin returns `{ files: [...] }` for the vault root.
- **Vault is flat:** the write guard allows only vault-root session notes, which matches that.

**Next:** T02 should generate the curriculum from the vault. T05 should promote the encounter engine and add `priorGaps` plus mock-tutor tests. T07 should add the Settings overlay and use `testConnection()`.

## T02 — partial — 2026-10-24 01:08:32
Cost $2.17 · 16 min · attempt 1

**What changed:** The curriculum now exists in `src/data/curriculum.js` and is built from the live vault headings. `npm run build` passes and all 30 tests pass (10 new ones in `tests/curriculum.test.js`).

It has four modules, each with one region and a season: Foundations (spring), Contract (summer), Tort (autumn) and Public Law (winter). There are about 45 districts, one per chapter or lecture note, and well over 150 subsections. Every subsection has an `id`, `title`, `sourceFile`, `heading`, `keyConcepts`, `keyCases`, `statutes`, `prerequisites` and `suggestedTutor`. Every district has `source: "vault"`, so the fallback path was not needed.

**It is partial because:**
- I did not cover some notes. See the first two items under design notes.
- I did not re-open the vault to check each heading string against the real note. I took them from the outlines, so the T06 section extractor may find a few that don't match.

**How it is organised:**
- The Foundations, Contract, Tort and Public Law subsections are in `src/data/curriculum/` (`foundations.js`, `contract.js`, `tort.js`, `publicLaw.js`).
- `src/logic/curriculum.js` is pure. It has `makeDistrict`, `flattenSubsections`, `findSubsection`, `findCycle` and `topologicalOrder`.
- Only short lists were taken (concepts, case names, statutes). No note prose was copied.

**Prerequisites** follow VISION §2 and cross district boundaries:
- Contract: Agreement → Consideration → Promissory Estoppel → Intention → Terms → Mistake.
- Tort: Duty of Care (Caparo) → Breach → Causation and Remoteness → Employers' Liability defences. Psychiatric Harm sits after Duty.
- Public Law: Constitution → Separation of Powers → Rule of Law → Sovereignty → HRA, with Entrenchment after Sovereignty.
- Foundations: What is Law → Precedent → Statutory Interpretation → Judiciary → Personnel.
- The tests check each region has an entry subsection with no prerequisites. They also check ids are unique, prerequisites exist, there are no cycles, and `sourceFile` and `heading` are set on every subsection.

**Try it:** Run `npm test` and look at the "curriculum" and "VISION §2 ordering" tests. To browse it, import `curriculum` from `src/data/curriculum.js`. Nothing is shown in the browser yet. The map arrives in T09.

**Design notes:** - **Occupiers' Liability is missing.** VISION §2 lists it after Breach, but the vault has no occupiers' liability note, so I did not invent one. The 1957 and 1984 Acts do not appear in the curriculum. A note for it would need adding to the vault. There is a comment in `tort.js`.
- **No judicial review district.** The vault has no standalone JR note, so JR appears only as `pl-rule-of-law.rol-and-executive`. That subsection sits between Rule of Law and HRA, and I did not add JR cases of my own.
- **Cross-district prerequisites:** I added a few dependencies beyond the bare VISION chain, such as Interpretation after Precedent and Legislation. Please check them for sense.
- **Skipped notes:** The 'districts' rule excludes cheat sheets, indexes, `TUTOR-SESSION-*` notes and `LAW7054-Formative-HighTec-IRAC-Scaffold.md`. I also skipped several duplicate or overlapping notes, since each chapter has one canonical district. These were not mapped:
  - Ch5 `-v1` and the Ch5 workshop prep
  - the combined Ch2–3 note
  - the three Consideration summary and reading-note files
  - the Poole casebook files
  - the Tort W2, W4 and W5 workshop and problem notes
  - the Week 3 Breach lecture and the Duty/Psychiatric workshop
  - the W4 Causation lecture and cases notes
  - `LAW7055-Parliamentary-Sovereignty-Notes.md`
  - `LAW7055-W3-Parliamentary-Supremacy-HRA.md`
  - `LAW7055-Fictitious-Bills-Advisory.md`
  - `LAW7055-Workshop*` notes
  - `LAW7054-Contract-W3-Workshop-Certainty-Intention-Mistake.md`, the Contract Ch1–Ch2 reading notes and the Dissertation note
  - `LAW7053-Legal-Problem-Questions-Essay-Writing.md`
  - `LAW7053-ECA-1972-vs-HRA-1998-Parliamentary-Supremacy.md`

  Some of these could become extra subsections or extra context for the tutor later.
- **Heading strings** came from outlines, and some are long or carry markdown, like `*Res Ipsa Loquitur*` and `# Chapter 1 — …`. T06's `extractSection` should match headings case-insensitively and ignore emphasis markers. The Bingham sections use `#` headings (level 1) rather than `##`.
- **Tutors:** suggested tutors are set per region: Okafor for Contract and Tort, Hale for Public Law and Judiciary independence, and Chen for Foundations and entry chapters.
- **Old demo id:** `contract-offer-acceptance` (the T00 demo) is not in the curriculum. The nearest subsections are `contract-agreement.offer-vs-itt` and `contract-agreement.acceptance`. T06's bank will need to be keyed to the new ids.
- **Legal accuracy:** In the Public Law file, `s.4` is described as a declaration that does not strike down a statute, which is the standard position. The extracted statute names keep the vault's spelling, apart from tidying a few truncated ones such as "Law of Property (Miscellaneous Provisions) Act 1989".

**Next:** T03 can use `flattenSubsections`, `subsectionIndex` and the prerequisite lists for gating.
T06 needs offline bank entries keyed to the new ids: the first three Contract subsections (`contract-intro.what-is-contract`, `contract-agreement.objective-approach`, `contract-agreement.offer-and-acceptance` / `offer-vs-itt`) and the first Tort one (`tort-trespass.assault` or `tort-duty.introduction`).
Decide whether to add Occupiers' Liability and Judicial Review notes to the vault and regenerate.
If you want more depth, map the skipped workshop and lecture notes as extra subsections.

## T02 — partial — 2026-10-24 01:11:20
Cost $0.74 · 3 min · attempt 2

**What changed:** Stopped at a limit before finish_task.

**Try it:** —

**Design notes:** —

**Next:** Continue this task.

## T02 — done — 2026-10-24 01:22:56
Cost $0.18 · 1 min · attempt 1

**What changed:** The curriculum is generated from the vault and was already in the repo from earlier T02 attempts. This session I checked it and ticked T02 in TASKS.md. `npm run build` and `npm test` both pass (35 tests). I changed no code this session, so the vault was not re-read. I only re-checked the file list and one outline, and the curriculum matches them.

`src/data/curriculum.js` assembles four regions from `src/data/curriculum/*.js`, built with the pure helpers in `src/logic/curriculum.js`:
- Foundations (spring)
- Contract (summer)
- Tort (autumn)
- Public Law (winter, including `Bingham - Rule of Law.md`)

Every district is flagged `source: "vault"` because the vault was reachable.

Each district is one chapter or lecture note. Each subsection has an id, title, `sourceFile`, heading, key concepts, key cases, statutes, prerequisites and a suggested tutor. All lists are short extracts, with no note prose copied.

The tests check:
- Ids are unique.
- Every prerequisite exists.
- There are no cycles.
- Every subsection has a `sourceFile` and a `heading`.
- Each region has at least one entry subsection with no prerequisites.
- The VISION §2 ordering holds, for example Offer & Acceptance before Consideration and Duty before Breach.
- Every district points at a real vault note.
- No two subsections share a heading within a note.

**Try it:** Run `npm test` and look at the "curriculum", "VISION §2 ordering" and vault-note tests. Nothing shows in the browser yet. The map arrives in T09.

**Design notes:** - **Occupiers' Liability is missing.** VISION §2 lists it, but the vault has no note for it, so I did not invent one. The 1957 and 1984 Acts are absent from the curriculum. A comment in `tort.js` records this. Adding a note to the vault would let the curriculum be regenerated with it.
- **No Judicial Review district.** The vault has no standalone JR note. JR appears only as a subsection inside the Rule of Law chapter, and I added no JR cases of my own.
- **Skipped notes.** I did not map the duplicate or overlapping notes, such as the Ch5 `-v1`, the combined Ch2–3 note, the Poole casebooks, the workshop and problem notes, `LAW7055-Parliamentary-Sovereignty-Notes.md` and `LAW7055-W3-Parliamentary-Supremacy-HRA.md`. I also skipped the cheat sheets, indexes, `TUTOR-SESSION-*` notes and the HighTec IRAC scaffold. They could become extra subsections or tutor context later.
- **Heading strings.** Some come straight from the outlines and carry markdown, such as `*Res Ipsa Loquitur*`. The Bingham headings are level 1 (`#`). T06's `extractSection` should match headings case-insensitively, ignore emphasis markers, and accept any heading level.
- **Old demo id.** `contract-offer-acceptance` from T00 is not in the curriculum. T06's bank needs entries keyed to the new ids, such as `contract-agreement.offer-vs-itt` and `contract-agreement.acceptance`.
- **Cross-district prerequisites.** Some go beyond the bare VISION chain, for example Interpretation after Precedent and Legislation. Please check they make sense.

**Next:** T03 can use `flattenSubsections`, `subsectionIndex` and the prerequisite lists for gating. T06 needs bank entries keyed to the new ids. Decide whether to add Occupiers' Liability and Judicial Review notes to the vault and regenerate.

## T03 — done — 2026-10-24 01:27:46
Cost $0.69 · 5 min · attempt 1

**What changed:** I added `src/logic/progress.js` with gating, rollups, the gap log and stats, plus `tests/progress.test.js` with 32 new tests. `npm run build` and `npm test` both pass (67 tests). I ticked T03 in TASKS.md.

**Gating**
- Only `explored` and `consolidated` are stored. `locked` and `available` are worked out from prerequisites each time, so adding vault notes can't corrupt a save.
- A subsection unlocks only when every prerequisite is `consolidated`. Explored does not unlock anything.
- Causation (`tort-causation.but-for`) stays locked until the Duty (Caparo) and Breach subsections are consolidated. I tested this on the real curriculum as well as a small one. Breach that is only explored still leaves it locked.
- The padlock tooltip can use `unmetPrerequisites`.

**Rollups**
- Districts, regions and modules each get counts, a fraction and a status: `locked`, `available`, `in-progress` or `consolidated`.
- A district is consolidated only when all its subsections are. `isBrazierLit` is built on that.

**Gap log**
- Each gap has the requested fields: `subsectionId, concept, stage, firstSeen, lastSeen, timesMissed, resolved`. Concepts match case-insensitively.
- Missing the same concept again raises `timesMissed` and re-opens a resolved gap.
- A gap resolves when the concept is credited in a *solid* stage or a correct checkpoint answer, or through `recordRetrieval(..., verdict:'solid')` for the garden and client NPCs. A partial answer does not resolve it.

**Stats**
- Case Recall comes from the authority stage and Application from the scenario stage.
- Statutory Interpretation comes from the precision stage, but only when the subsection lists statutes.
- IRAC Fluency comes from the best IRAC score (0–4). Stages that were skipped or answered "I'm not sure" earn nothing.
- Points per verdict are solid 3, partial 1, missing 0. `statLevel` turns points into levels.

**Applying an encounter result**
- `applyEncounterResult(progress, result, {subsection, now})` does not trust the result's own `outcome`. It re-runs the consolidation rule from the stage verdicts and checkpoint score.
- Opening an encounter and leaving without answering anything changes nothing.
- A later weaker attempt never downgrades `consolidated`.
- Functions return new progress objects and never change the one passed in.

**Small changes to `encounter.js`**
- `result()` and `leave()` now include each stage's `conceptsHit` and the checkpoint's `conceptsHit`, so gaps can be resolved.
- Leaving during a follow-up used to lose the gaps from the last thin answer. `result()` and `leave()` now log them. This was a real bug I found with a test.

**Try it:** —

**Design notes:** - **Concept matching:** gaps resolve by matching the concept text exactly (ignoring case). The offline bank labels and the Claude tutor must keep concept labels stable, ideally the subsection's `keyConcepts`, or gaps won't resolve. T06 should enforce this. Later I could add fuzzy matching.
- **Stat points:** the point values (3/1/0) and level curve (5, 15, 30…) are my own choices. They are easy to change in `VERDICT_POINTS` and `statLevel`.
- **Stored vs derived state:** the stored consolidated or explored state survives even if the curriculum later changes prerequisites. That seemed kinder than re-locking a building the player has already beaten.
- **Cross-district prerequisites:** the "Causation needs Duty and Breach" chain exists through `after: ['tort-breach.calculus', 'tort-breach.res-ipsa']`, so it is the *end* of Breach, not all of it. Critical Perspectives on Breach is not required. I think that's reasonable.
- **`iracScore` source:** the offline evaluator only sets `iracScore` on the scenario stage, so that's where IRAC Fluency comes from. The Claude tutor (T06) should return it for stages 3–5 too if wanted.

**Next:** T04 (save system) can store the progress object as-is, since it is plain JSON, and use `normaliseProgress` when loading. T05 and T06 should keep concept labels consistent, as noted above.

## T04 — done — 2026-10-24 01:30:51
Cost $0.51 · 3 min · attempt 1

**What changed:** The save system is in. `npm run build` passes, and `npm test` passes with 85 tests (18 new in `tests/save.test.js`). I ticked T04 in TASKS.md.

**What it does**
- **Schema:** the save is `version: 1` and covers everything in VISION §7. That is player position, region and facing, cat position, the T03 progress object (subsection states, gaps, stats), inventory, garden plots, lit braziers, tutor preference per subsection, and non-secret settings.
- **Loading:** `loadSave` never throws. If the stored save is corrupt, unversioned-junk or from a newer version, you get a fresh game, and the bad text is copied to `lawworld.save.backup` first so autosave can't wipe it.
- **Repairs:** a save that is only partly broken keeps its usable parts. Bad entries are dropped and bad numbers are reset to defaults.
- **Migration:** `migrate()` runs a chain of numbered steps. The one existing step upgrades unversioned prototype saves (step 0→1). Future schema changes just add a new step.
- **Autosave:** it is debounced, so a burst of changes makes one write. `flush()` writes immediately, and the browser adapter calls it on `pagehide` and when the tab is hidden.
- **Export and import:** the file input and download link are in `src/ui/saveAdapter.js` as `downloadSave()` and `pickAndImportSave()`. A bad import changes nothing and returns a plain message.
- **Storage:** it is injected, so the tests use an in-memory fake. `src/logic/saveStore.js` holds the current save and has `update`, `applyEncounter`, `importText`, `exportText`, `save` and `reset`.
- **In the game:** `GameScene` now restores your position on reload and autosaves it every 2 seconds if you moved. When an encounter closes, whether finished or left, its result goes through `applyEncounterResult` into progress and is saved straight away. Opening and leaving without answering saves nothing.

**What the tests cover:** round-trip, corrupt and throwing storage, partial repair, the migration hook and chain, debounce and flush, export/import round-trip and rejection, and reload restoring consolidated state and unlocks.

**Try it:** Run `npm run dev` and walk away from the start point. Wait about 2 seconds, then reload the page: you should reappear where you stopped. Then press E on the grey "Contract Law" rectangle, answer a couple of questions and click Leave. In dev tools, under Application → Local Storage, `lawworld.save` should now show the subsection as `explored`, with any gaps logged. Setting `lawworld.save` to garbage and reloading starts a fresh game and keeps the garbage under `lawworld.save.backup`. There is no Save, Export or Import button yet. They arrive with the menu in T07, which calls `downloadSave()` and `pickAndImportSave()`.

**Design notes:** - **API keys and tokens are not in the save.** A save file is something you might export or share, and the Claude key and Obsidian token already live in `src/settings.js`. The `settings` section of the save holds only non-secret gameplay preferences, and anything with a key-like name (key, token, secret, password, authorization) is stripped. The tests check this. The vision lists "settings" as saved, so this is a deliberate narrowing, not an oversight.
- **Import is stricter than load.** An unversioned JSON file that doesn't look like a save is rejected on import. Otherwise importing a random file would replace your game with a blank one. Load still treats an unversioned file as a prototype save.
- **A corrupt save is never silently overwritten.** The raw text is backed up to `lawworld.save.backup` before the fresh game takes over. There is no UI for recovering from the backup yet. It is only visible in dev tools.
- **Only the demo encounter feeds progress for now.** `GameScene` applies the demo subsection's result to progress. T09 will route real buildings through the same `saveStore.applyEncounter`.
- **Placeholder defaults:** the cat position and the player's region field are saved but not used until T09 and T10. The default region is `hub` and the default spawn is (480, 320).
- **`GameScene` saves position by polling.** It checks every 2 seconds and only writes if the player moved. That is simple and cheap, and the worst case is losing about 2 seconds of walking on a crash.

**Next:** T05 is already largely done in `encounter.js` from T00. A sensible check is to confirm it against the T05 spec, in particular the `createEncounter({subsection, tutor, priorGaps})` signature, which currently takes positional arguments. T07 should add Save, Export and Import buttons and a "start a new game" confirmation using `saveStore.reset()`.

## T05 — done — 2026-10-24 01:34:19
Cost $0.65 · 3 min · attempt 1

**What changed:** The encounter engine from T00 already did most of T05. I checked it against the spec, brought it in line, and added a separate engine test file. `npm run build` and `npm test` both pass (112 tests).

What changed in `src/logic/encounter.js`:
- **New signature:** `createEncounter({ subsection, tutor, priorGaps })`. The old `createEncounter(subsection, tutor)` call still works, so the existing tests and UI keep running. `priorGaps` is passed to every tutor call as `ctx.priorGaps` (T06 and T08 will use it). `src/ui/encounter.js` now uses the new signature and takes an optional `priorGaps`.
- **Failed tutor call:** the tutor now evaluates an answer before the engine counts it. If the call throws (network down, say), nothing is counted and the player can resend the same answer. Before, the exchange was counted and the stage was left half-done.
- **Double-clicks:** `next`, `submit`, `hint`, `notSure` and `ask` now run one at a time. A second call while one is in flight gets a polite "tutor is still thinking" rejection. Before, a double-click could count one answer twice or skip a stage.
- **Odd evaluations:** an unrecognised verdict is treated as `partial`. A missing `conceptsHit` or `conceptsMissed` becomes an empty list. It can never pass an answer by accident.
- **Hint leaks:** if a tutor's generated prompt carries a `modelAnswer`, the engine keeps it privately. If a hint repeats 8 or more words in a row from it, the hint is replaced with a generic nudge. It matters most for the Claude tutor in T06. The model answer never appears in prompts or results. The offline tutor now passes its model answers in this way.
- **After leaving:** once you call `leave()`, any further calls are rejected.

The rules were already right and are now tested:
- Open answers under 15 characters are rejected and not counted.
- MCQ answers must be one of the options.
- Hints are capped at 2 per stage.
- Follow-ups are capped at 2 per stage.
- There must be at least 8 exchanges before a verdict.
- Consolidation follows VISION §1.

New `tests/encounterEngine.test.js` (27 tests, mock tutor). It covers:
- No verdict without answering; hints, questions and "not sure" never reach a verdict.
- Short answers rejected; MCQ options enforced.
- Hints never reveal the answer, including a deliberately leaky provider.
- The follow-up cap.
- Consolidated, explored (stage 3 or 5 partial, any of 2–5 missing, checkpoint 1/3), and gaps produced.
- The minimum-exchange reflection, "not sure", external answers labelled, leaving mid-follow-up, concurrency, and a throwing tutor.

**Try it:** Nothing new is visible in the browser. Run `npm run dev`, press E on the Contract Law rectangle and play the demo encounter. It should behave as before. Double-clicking Submit now counts once.

**Design notes:** - **The minimum is tested here, but the offline bank needs checking.** An encounter with no follow-ups has 7 exchanges (4 open answers and 3 MCQs). The engine asks for a short reflection question to reach 8. It's counted as an exchange and not scored. I kept this rather than add a fifth scored stage. Real tutors may ask follow-ups naturally, in which case the reflection never appears.
- **"I'm not sure" caps the stage at partial.** After the tutor teaches the idea and you restate it, the best you can get is `partial`. The stage is therefore never consolidated by being taught, and stage 3 or 5 cannot be solid after "I'm not sure". This follows VISION §1 point 4 and was already the case.
- **Evaluation order:** `ask()` and `hint()` are rejected while another call is in flight. The UI already disables its buttons during a call, so this only matters for programmatic use.
- **Not done:** `priorGaps` is only passed through. Nothing in the offline tutor uses it yet, and the intro doesn't mention it. That belongs to T06 and T08.

**Next:** T06: the Claude tutor should use `ctx.priorGaps`, return `modelAnswer` from `generate`, and keep `evaluate` returning the same shape. T07: show a retry button when `engine.submit` throws. The engine now leaves the exchange uncounted, so the same answer can be resent.

## T06 — partial — 2026-10-24 01:51:01
Cost $2.22 · 17 min · attempt 1

**What changed:** The Claude tutor provider, the three personas and four new offline banks are written. `npm run build` and `npm test` pass (126 tests). I have not run the Claude tutor against the real API, and the new banks are not playable yet because nothing in the game uses them.

**What's in:**
- `src/logic/notes.js` has `extractSection(markdown, heading)`. It includes nested sub-headings and stops at the next heading of the same or higher level. Matching ignores `#`, bold, case and trailing colons, and it skips headings inside code fences. The file also has `listHeadings` and `sessionFilesFor`.
- `src/logic/tutorJson.js` parses replies defensively: it strips code fences, finds the first JSON object, and fixes trailing commas. If that fails it retries once with a repair prompt, then throws a readable error. Evaluations with an unknown verdict or empty feedback are rejected, which triggers the retry. Checkpoint questions must have exactly 3 options and a valid correct index.
- `src/data/tutors.js` has Hale, Okafor and Chen, each with a style prompt and voice examples. A shared rules block tells the tutor never to invent citations, to say when the note is silent, to give hints that nudge, and to state that the Occupiers' Liability Act 1984 exists.
- `src/logic/tutorPrompts.js` builds the prompts for the intro, stages 2–5, the MCQ set, evaluation, hints, "I'm not sure" and questions.
- `src/api/tutor.js` implements the tutor interface with Claude:
  - It reads the note section live via Obsidian. If the heading isn't found, it falls back to the whole note.
  - It adds the Gaps and Next-time digests from up to 2 prior `TUTOR-SESSION-*` notes for the subsection, plus open gaps.
  - It returns `modelAnswer` from `generate`, so the engine's hint-leak check works.
  - The 3 checkpoint questions are generated once per subsection, and MCQ marking happens locally.
  - `answerQuestion` asks from the note first. Only if the note lacks the answer does it call web search (`web_search_20250305`, max_uses 3). That answer comes back as `external: true`, which the engine labels "External, not from your notes".
  - If the note can't be read, the call throws, so the engine doesn't count the exchange.
- Offline banks are in `src/data/bank/`, each with 7 stages, 2 hints per stage, 3 MCQs and offline Q&A. They are:
  - `contract-intro.what-is-contract`
  - `contract-agreement.objective-approach`
  - `contract-agreement.offer-and-acceptance`
  - `tort-trespass.assault`
- `OFFLINE_BANK` now includes these banks. The offline tutor also gives a clear `NoOfflineBankError` for subsections with no bank, mentions open gaps in the intro, and no longer returns the contract-formation canned answers on non-contract subsections.
- Tests are in `tests/tutorT06.test.js`. They cover `extractSection`, JSON parsing and repair, offline verdicts (including that stage 5 needs IRAC structure for "solid"), the Claude tutor against a stubbed API (context, one repair retry, external web answers), and the banks' structure.

**Try it:** Nothing new is visible in the browser yet. The demo encounter behaves as before. Run `npm test` to see the new tests. To try the Claude tutor in the console, build `createClaudeTutor({ personaId: 'okafor' })` and call `generate`/`evaluate` with a curriculum subsection. That needs a Claude key and the Obsidian token in Settings or `.env`, and the Obsidian cert accepted.

**Design notes:** - **Banks are not playable yet.** The bank is keyed by curriculum id and the Contract Law rectangle still uses the demo subsection. T07/T09 need to pass `findSubsection(curriculum, id)` to the offline tutor. Also, `createOfflineTutor()` only supports Professor Hale, so the persona is not chosen per subsection. Tutor switching is not wired anywhere yet.
- **The Claude tutor is not wired into the UI.** Nothing calls `createClaudeTutor` or falls back to offline when Claude or Obsidian is down. That is T07's "continue offline" work. Remember `main.js` or the scene needs to pick Claude only when a key is set.
- **The Claude tutor is untested against the live API.** Prompts and JSON handling were only tested with a stubbed `call`. Expect to tune the prompt wording after a first real session.
- **Case law outside the vault.**
  - The Ch1 note names no cases, so its stage 4 uses Balfour v Balfour, Carlill and Currie v Misa. The prompt says the note names none.
  - For the assault bank, the handout only lists case names. I wrote short summaries of Stephens v Myers, Tuberville v Savage, Read v Coker and R v Ireland from standard law.
  - **Please check these against your reading before relying on them.**
  - Thomas v NUM is deliberately not summarised, and the offline tutor says the vault is silent on it.
  - Chwee Kin Keong is flagged as a Singapore authority (persuasive only in England).
- **Offline evaluation is keyword-based.** It rewards keyword overlap and can miss correct answers in unusual wording. It is labelled offline and is a fallback only.
- **`offlineBank.js` is now about 190 lines**, with the new banks in separate files. The old demo bank and its keyword helpers were left as they were.
- **Not done:** I haven't added `priorGaps` to the Claude intro beyond passing them into the context. Prior-session memory reads Gaps and Next-time headings, which T08 must write under exactly those headings.

**Next:** T07: choose Claude or offline when the encounter opens, pass real curriculum subsections and the persona, add retry and "continue offline" on tutor errors, and show a clear message when a subsection has no offline bank. T08: write session notes with `## Gaps` and `## Next time` headings, which `sessionDigest` reads. Later: add offline banks for more subsections, and check the new case summaries against the vault reading.

## T06 — done — 2026-10-24 01:53:35
Cost $0.71 · 3 min · attempt 2

**What changed:** T06 was already mostly built in the earlier partial attempt. This session I checked it against the spec and made two small additions. Build and all 131 tests pass, and I ticked T06 in TASKS.md. I haven't run the Claude tutor against the real API.

What the spec's pieces now are:
- **Personas:** `src/data/tutors.js` has Hale, Okafor and Chen, each with a style prompt and voice examples, plus shared rules.
- **`extractSection`:** `src/logic/notes.js` has `extractSection(markdown, heading)`.
- **Claude tutor:** `src/api/tutor.js` reads the note section live, adds earlier TUTOR-SESSION digests and open gaps, and asks for strict JSON.
  - Parsing strips fences and retries once with a repair prompt.
  - `answerQuestion` tries the note first and uses web search only if the note lacks the answer. Those answers are marked external.
- **Offline tutor and banks:** full 7-stage banks exist for `contract-intro.what-is-contract`, `contract-agreement.objective-approach`, `contract-agreement.offer-and-acceptance` and `tort-trespass.assault`.

Added this session:
- **Persona-aware offline tutor:** `createOfflineTutor({ personaId })` now takes its name and colour from the chosen persona. The bank is the same for every persona. It used to be Hale only.
- **New `tests/bankQuality.test.js`:** for every banked subsection and stages 2–5, the bank's own model answer must score solid, and a vague waffle answer must not, and must get a follow-up. All four banks pass. This also checks the offline evaluator can't mark down a player who writes exactly the right answer.
- **Other tests:** `extractSection`, JSON parsing and repair, offline verdicts and the stubbed Claude tutor were already covered in `tests/tutorT06.test.js`.

**Try it:** Run `npm test` to see the new tests. Nothing new shows in the browser yet, because the encounter UI isn't wired to the real curriculum or to Claude. That is T07. To try Claude in the console you need a Claude key and Obsidian token in Settings or `.env`, and the Obsidian certificate accepted. Then call `createClaudeTutor({ personaId: 'okafor' })`.

**Design notes:** - **Case summaries need checking.** The Ch1 note names no cases, so its stage 4 uses Balfour v Balfour, Carlill and Currie v Misa. The assault handout only lists case names, so the summaries of Stephens v Myers, Tuberville v Savage, Read v Coker and R v Ireland are mine from standard law. Please check them against your reading. Thomas v NUM is deliberately not summarised, and the bank says the vault is silent on it.
- **Chwee Kin Keong is a Singapore authority.** It is flagged as persuasive only in England.
- **Banks are not playable yet.** The Contract Law rectangle still opens the demo subsection. T07 and T09 must pass the real curriculum subsection and the persona to `createOfflineTutor` and `createClaudeTutor`, and fall back to offline when Claude or Obsidian is down.
- **Offline evaluation is keyword-based.** It can miss correct answers in unusual wording. It is labelled offline and is a fallback only.
- **T08 dependency.** Prior-session memory reads the `## Gaps` and `## Next time` headings, so session notes must be written under exactly those headings.
- **Prompts are untested live.** Expect to tune the Claude prompt wording after a first real session.

**Next:** T07: choose Claude or offline when an encounter opens, pass real curriculum subsections and the persona, add retry and "continue offline" on tutor errors, and show a clear message when a subsection has no offline bank (`NoOfflineBankError`). T08: write session notes with `## Gaps` and `## Next time`.

## T07 — partial — 2026-10-24 02:11:12
Cost $2.49 · 18 min · attempt 1

**What changed:** The encounter overlay, Esc menu and Settings screen are built, and the demo encounter can be played start to finish offline. Build and all 135 tests pass. I haven't tried it in a browser, so none of the DOM overlay code has run. I haven't ticked T07 in TASKS.md.

**Not done:**
- **Claude path:** encounters can't use Claude yet. The only playable building is still the grey "Contract Law" rectangle, which runs the demo subsection offline. The Claude path needs real curriculum subsections, which arrive with T09's world.
- **Tutor choice:** there is no tutor picker. The tutor preference is read from the save, defaulting to Hale.
- **Offline fallback:** `chooseMode` is only called and its result ignored. The "continue offline" button is wired but can't appear until a Claude tutor is passed in.

**Changes:**
- **Encounter overlay (`src/ui/encounter.js`):** it now shows the tutor name and swatch, the transcript, the answer box, MCQ buttons, stage pips and the Submit, Hint, I'm not sure, Ask and Leave buttons.
  - **Status and loading:** an OFFLINE or ONLINE badge sits in the header, and a "thinking…" line shows while the tutor works.
  - **Errors:** a failed call shows a readable message with **Retry** and, when a Claude tutor is in use, **Continue offline**.
  - **No double-counting:** retry cannot submit one answer twice. The engine marks a failed next-prompt fetch as pending and retry re-fetches that prompt only. The engine can also swap tutor mid-encounter.
  - **Result:** the finished encounter writes into progress and saves immediately.
- **Keyboard (`src/ui/dom.js`, `src/logic/overlayLock.js`):** every overlay goes through one counted lock. Opening the first overlay disables Phaser keyboard input and releases key captures. Closing the last one restores them. Menu to Settings can't re-enable the keys early.
- **Esc menu (`src/game/GameScene.js`):** Esc opens a menu with Resume, Settings, Save now, Export save and Import save. Esc inside an encounter does nothing, so a stray press can't lose your place. Use Leave.
- **Settings (`src/ui/settings.js`):** fields for Claude key, model, Obsidian URL and token, with Test Claude and Test Obsidian buttons. Results show as green or red text, and the certificate instruction (open `https://127.0.0.1:27124` once and accept it) is on screen. `testClaudeConnection` is new in `claude.js`, and the Obsidian test messages are clearer.
- **Error text (`src/logic/apiErrors.js`):** Claude and Obsidian failures become plain messages, such as bad key, bad model, rate limit, and "open the certificate URL" for network errors.
- **Refactors:** the CSS moved to `src/style.css` and is imported in `main.js`. The engine's constants and pure rules moved to `src/logic/encounterRules.js`, which the engine re-exports so imports are unchanged.
- **Tests:** new `tests/uiLogic.test.js` covers error messages, `chooseMode`, the overlay lock, and retry-without-double-counting with a tutor switch.

**Check before trusting:**
- **Settings tests:** the Claude test sends a 1-token call with your key.
- **Overlay code:** the keyboard lock logic is unit-tested, but the DOM code around it is not.
- **Dead CSS:** the `.lw-door*` and `.lw-tutor-pick` styles in `style.css` are unused until the study-door UI exists.

**Try it:** Run `npm run dev`.
1. Walk to the grey "Contract Law" rectangle and press E. The encounter opens with an OFFLINE MODE badge.
2. Type with W, A, S, D and Space. They should type normally, and the character should not move.
3. Play through: type answers (Enter submits, Shift+Enter adds a line), try Hint and I'm not sure, ask a question, answer the three MCQs, and read the verdict. Then close it and check the banner and save.
4. Press Esc in the world to open the menu and then Settings. Click Test Obsidian with no token to see the message. With Obsidian running, accept the certificate first, then test again.
5. Confirm the character moves again after every overlay closes.

**Design notes:** —

**Next:** 1. Wire the study door once T09 provides real buildings. Show the locked padlock tooltip, a tutor picker (hale, okafor, chen) that saves to `tutorPreference`, and `chooseMode` with an offline-bank check. Build `createClaudeTutor` when the mode is claude, and pass `makeOfflineTutor`.
2. Show the `NoOfflineBankError` message in the encounter when a building has no offline bank.
3. Add a "Play offline" toggle that sets `forceOffline`.
4. Do a browser pass on the overlay layout.
5. T08 will read the session-note fields from `result.tutor` and `result.transcript`.

## T06 — done — 2026-10-24 02:12:59
Cost $0.57 · 2 min · attempt 3

**What changed:** T06 was already built in earlier sessions, so I only checked it against the spec, added tests for the Claude tutor and ticked the box in TASKS.md. `npm run build` and `npm test` both pass (141 tests).

What was already in place and checked:
- **Personas:** `src/data/tutors.js` has Hale, Okafor and Chen, each with a style fragment and voice examples. A shared rules block covers grounding in the note, no invented citations, England & Wales law only, the Occupiers' Liability Act 1984 point, and no answer leaks.
- **Note section:** `extractSection(markdown, heading)` is in `src/logic/notes.js`. It includes nested headings, ignores fenced code, and matches headings loosely.
- **Claude tutor:** `src/api/tutor.js` uses the live note section, the `TUTOR-SESSION` digests for that subsection, and the open gaps. Replies are strict JSON and are parsed defensively with one repair retry.
- **Web search:** `answerQuestion` asks the note first. It calls the `web_search_20250305` tool only when the note doesn't cover the question, and marks that answer `external`. If the search fails, it says it won't guess beyond your notes.
- **Offline tutor and bank:** `src/api/offlineTutor.js` and `src/data/offlineBank.js` give full 7-stage banks for:
  - the demo subsection `contract-offer-acceptance`;
  - the first three Contract subsections: `contract-intro.what-is-contract`, `contract-agreement.objective-approach` and `contract-agreement.offer-and-acceptance`;
  - the first Tort subsection, `tort-trespass.assault`.

  Evaluation is keyword overlap against concepts. Stage 5 needs visible IRAC structure to count as solid.

What I added this session:
- **New tests:** `tests/tutorClaudeFlow.test.js` has 6 tests using a scripted fake Claude. They cover:
  - evaluate, hint and "I'm not sure" calls;
  - checkpoint questions being generated once and marked locally;
  - web search never being used when the note answers, and the honest fallback when search fails;
  - the whole-note fallback when a heading isn't found;
  - prior session notes and open gaps reaching the prompt, with resolved gaps left out;
  - an encounter starting through the engine.
- **Existing tests:** `tests/tutorT06.test.js` and `tests/bankQuality.test.js` already cover `extractSection`, JSON parsing and repair, and the offline verdicts.

I changed no source files.

**Try it:** Run `npm test` to see the T06 tests. To try Claude mode, add a Claude key and Obsidian token in Settings once the study door exists (T09). The demo "Contract Law" rectangle still uses the offline tutor.

**Design notes:** - **Real Claude calls untested:** The Claude path is tested only with a scripted fake. No real API call or live Obsidian fetch has run, so prompt quality with the real model is unverified.
- **Authority stage:** `contract-intro.what-is-contract` has no cases in your Ch1 note, so its authority stage uses Carlill, Balfour and Currie v Misa and says plainly that your note doesn't name them.
- **Authority stage:** For `tort-trespass.assault`, the handout only lists case names. I wrote the case summaries from standard law. Thomas v NUM is deliberately not summarised, because the vault is silent on its holding.
- **Citations to check:** I haven't checked the offline bank's citation strings against a case report, so check them if they matter to you.
- **Offline evaluator:** The keyword evaluator is blunt. A correct answer in unusual wording can score partial. Each stage's own model answer is tested to score solid, and waffle never does.
- **Banks not covered:** Offline mode shows "bank doesn't cover this" for every other building. The study-door UI (T09) must call `chooseMode` and `hasOfflineBank`.

**Next:** Wire the study door in T09: tutor picker, `chooseMode`, and the offline-bank check. T08 adds session write-back. After that, try Claude mode against the real vault and tune the prompts.

## T07 — done — 2026-10-24 02:16:33
Cost $0.68 · 4 min · attempt 2

**What changed:** The encounter overlay, Esc menu and Settings were mostly built in an earlier session. This session I reviewed them against the spec, tidied them up, fixed a few bugs and added tests. `npm run build` passes and so does `npm test` (147 tests). I could not open a browser here, so none of the overlay behaviour has been seen on screen.

What the UI does now:
- **Encounter overlay:** `src/ui/encounter.js` shows the tutor name and colour swatch, the scrolling transcript, and a multi-line box where Enter submits and Shift+Enter adds a new line. It has Submit, Hint, I'm not sure, Ask a question and Leave buttons, and MCQ options as buttons. Seven stage pips run along the top, with an offline or online badge. A "…is thinking" indicator shows while the tutor works.
- **Errors:** A failed call shows a readable message with Retry and, when running online, Continue offline. Retry never counts an answer twice. If the offline bank doesn't cover the building, the overlay goes back to the previous tutor and says why.
- **Keyboard:** Every overlay (encounter, menu, settings) goes through one shared lock. While any is open, Phaser keyboard input is off and key captures are released, so W/A/S/D/Space/E can be typed. They come back when the last overlay closes. Esc inside an encounter does not close it, so a stray press can't drop you out.
- **Settings:** Esc opens the menu, then Settings. It has the Claude key, model, Obsidian URL and token, plus "Test Claude connection" and "Test Obsidian connection" buttons with clear success or failure text. It also carries the instruction to open `https://127.0.0.1:27124` once and accept the certificate.
- **Saving the result:** The encounter's result is written to progress and the save exactly once. That happens when the verdict is reached. If you leave early, it happens on Leave, so leaving early gives *explored*. If nothing was answered, nothing changes.

What I changed this session:
- **New `src/logic/encounterView.js`:** It holds the logic for which controls show in which state. It is pure, so it can be tested.
- **Rewrote `src/ui/encounter.js` to use it.**
- **Fixed bugs:**
  - Asking a question on an MCQ now works.
  - A too-short answer or question stays in the box instead of vanishing.
  - A reply that arrives after you've left can no longer touch a closed overlay.
  - The encounter result is no longer recorded twice.
  - Leaving a verdict screen no longer tries to record again.
- **Added `tests/encounterView.test.js`:** It checks the control logic, that no skip control exists, and that an overlay-style driver plays the offline demo to a verdict.

**Try it:** Run `npm run dev`, walk to the grey "Contract Law" box and press E. Play the whole encounter. Try typing W/A/S/D and Space in the answer box. Try Hint, "I'm not sure", Ask a question and Leave. After the verdict, reload and check that the result persisted. Press Esc and open Settings to see the connection tests. To see the error box, save a bogus Claude key. The demo itself still runs offline, so the error box will only appear once T09 wires Claude into the study door.

**Design notes:** - **Nothing seen in a browser:** The DOM and Phaser behaviour is untested by machine, since only the logic is unit-tested.
- **Leave-and-return rule:** A verdict that finishes the encounter is recorded immediately, so closing the overlay afterwards does nothing extra. Leaving mid-encounter records *explored* plus gaps.
- **Intro "Continue" button:** The intro stage is not a question, so it has a Continue button. No other step has a skip.
- **Demo always offline:** The demo "Contract Law" box still always uses the offline tutor. The Claude path through the overlay (thinking state, retry, continue offline) is built but only exercised for real once T09 adds the study door.
- **Tutor picker:** There is no tutor picker yet, which is T09. The preference is read from the save, defaulting to Hale.

**Next:** T08 writes the TUTOR-SESSION note when an encounter ends. T09 adds the study door with the tutor picker and `chooseMode`.

## T08 — done — 2026-10-24 02:22:47
Cost $1.20 · 6 min · attempt 1

**What changed:** The game now writes a `TUTOR-SESSION-YYYY-MM-DD-HHMM-<subsectionId>.md` note when an encounter ends. It also reads earlier session notes for that subsection when an encounter starts. `npm run build` passes and `npm test` passes (164 tests, 17 of them new). I couldn't run a browser or reach a real Obsidian here, so the write and read were only tested with fake vault functions.

**Writing a note**
- Where: `src/logic/sessionNote.js` has the filename builder and note formatter. `src/api/sessionNotes.js` does the writing.
- Frontmatter: date, time, module, district, subsection, title, tutor, outcome, finished, checkpoint.
- Sections: Covered, Landed, Gaps and Next time.
  - **Covered:** the verdict per stage, with follow-up and hint counts, the IRAC score and the checkpoint score.
  - **Landed:** the concepts the tutor credited that are not also gaps.
  - **Gaps:** the missed concepts, each with its stage.
  - **Next time:** a retrieval question on the gaps, stages still to answer, and what must come out solid to consolidate.
- Content: no transcript and no note prose, only the tutor's verdicts and concept labels.
- Safety: the filename always passes `checkWritePath`, and `assertWritable` runs again before the write. `writeNote` in `obsidian.js` is unchanged and still refuses anything else.
- Trigger: `GameScene.recordEncounter` calls it once per encounter, at the verdict or on Leave.
- Skipped writes: if nothing was answered, no note is written. If Obsidian has no token, nothing is written and the banner says so. If the write fails, the banner shows the reason and the local save is unaffected.

**Memory at the start**
- Lookup: `loadPriorSessions` calls `listFiles`, matches the exact subsection id, keeps the newest two notes and parses their Gaps and Next time.
- Matching bug fixed: `sessionFilesFor` used to match on a suffix, so subsection `b` would pick up `a.b`'s notes. It now uses a strict pattern.
- Claude tutor: it receives the memory and its intro prompt now requires naming an earlier gap. If there is no memory, the prompt says not to pretend there was one.
- Offline tutor: it says "Last time X didn't fully land, so we will meet it again today." This draws on the session-note gaps and on gaps stored in the save.
- Engine: `createEncounter` takes an optional `loadMemory()`, called once before the intro. A failure there just means no memory.

**Try it:** Put the Obsidian URL and token in Settings. Press Esc, then Settings, and use "Test Obsidian connection".

1. Run `npm run dev`, walk to the grey "Contract Law" box and press E.
2. Answer a few stages, then Leave. The banner should say "Session note saved: TUTOR-SESSION-…-contract-offer-acceptance.md". Check that file in the vault.
3. Open the same box again. The intro should say "Last time … didn't fully land", naming a gap from that note.

Without a token, the banner says no session note was written.

**Design notes:** - **Demo subsection:** The demo "Contract Law" box has no place in the curriculum, so `module` is "Contract Law" and `district` is empty in its notes. Real subsections will fill both in once T09 opens them. The same applies to memory: it is keyed on the subsection id, which is the demo's own id for now.
- **Wording of the offline intro:** "Last time X didn't fully land" is built from stored gap labels, so the sentence can read a little stiffly for long concept names.
- **Where "Landed" comes from:** it comes from the tutor's `conceptsHit` labels. That is only as accurate as the tutor's judgement. The offline evaluator's labels are coarse.
- **Several notes in one minute:** two notes for the same subsection in the same minute would have the same filename, so the later one overwrites the earlier. That is unlikely, because an encounter takes at least 10 minutes.
- **Leave-after-verdict:** it does not write a second note. Writing happens once, at the verdict or on Leave.
- **Memory lines:** I did not add the earlier note's outcome text to what the player sees. The memory goes to the tutor, and the intro mentions it.
- **Error text:** the banner shows raw error text from a failed write.

**Next:** T09 builds the world from the curriculum and adds the study door, with the tutor picker and `chooseMode`. That will make session notes carry real module and district names and use Claude with live notes.

## T09 — partial — 2026-10-24 02:46:50
Cost $2.10 · 24 min · attempt 1

**What changed:** T09 is only started. The game still shows the old green grid and the grey "Contract Law" demo box. I wrote one small piece of the layout code, and the build and all 167 tests pass. I ran out of output budget before writing the rest: the hub and region placement, paths and collision, the Phaser world, region banners, the E-at-door flow with tutor picker and padlock tooltip, and building colours.

**Try it:** Nothing new is visible in the browser yet; run `npm test` to see the new layout tests.

**Design notes:** - **What exists:** `src/logic/layoutCell.js` lays out one district as two rows of 3×2 buildings facing a 3-row walkable lane, with the signpost and brazier in the middle of the lane. It also has `packCells`, which packs cells into rows with a gap between them.
- **Tests:** `tests/layoutCell.test.js` checks every real district in the curriculum. It confirms there is one building per subsection, no building overlaps another, doors sit on the lane, and layout is deterministic. `packCells` is checked for overlap and width.
- **Gap in the tests:** "Every door reachable from the hub" is not tested yet, because the hub and region placement that would make it testable is not written.
- **Rewrite risk:** two of my large `write_file` calls were cut off for length, so I wrote the file in pieces. Plan the next session in small files.
- **Size to plan for:** the curriculum has 31 districts and about 170 subsections. The largest districts have 10–12 subsections, so each cell is about 25×7 tiles. Each region (Foundations/Contract/Tort/Public Law) needs about 7–10 cells, so each region will be a few hundred tiles wide. That is fine for Phaser if the ground is a RenderTexture or a few big textures rather than one image per tile.
- **Door interaction:** only buildings with an offline bank can run without Claude and Obsidian. Those are the first three Contract subsections and the first Tort one. Other buildings need both Claude and Obsidian. This is already handled by `chooseMode`, and the picker should say so rather than fail.

**Next:** 1. `src/logic/layout.js`: `buildWorld(curriculum)` returns a map of `{ cols, rows, tiles, buildings, regions, hub, spawn }`.
   - Place the hub in the centre, with Foundations (spring) as the hub town.
   - Put Contract east, Tort south and Public Law north, joined to the hub by path tiles.
   - Pack each region's district cells with `packCells`, and carve path tiles from the hub to each cell's lane.
   - Border each region with trees and water.
   - Add a pure `pathExists(world, from, to)` BFS and test that every door is reachable from the hub spawn. Also test that nothing overlaps and that the layout is deterministic.
2. Rewrite `GameScene.js`: render tiles from the world data, and add static collision bodies for buildings, trees, water and fences. Bound the camera and physics world to the map, and show a region banner on entering a region.
3. Draw building colours by `computeStates` state: grey for locked with a padlock, blue for available, amber for explored, green for consolidated. Draw an unlit brazier and a signpost per district.
4. Door E: for an available or explored building, show a tutor picker (default `suggestedTutor` or the saved `tutorPreference`), then `chooseMode`. Run the Claude tutor and `loadPriorSessions` if both keys are set; otherwise run the offline tutor if there is a bank, and say why if there isn't. For a locked building, show a padlock tooltip listing `unmetPrerequisites` by title. Remove the demo box, and save `player.region`.

## T09 — done — 2026-10-24 03:04:25
Cost $1.85 · 18 min · attempt 2

**What changed:** The green grid and the grey demo box are gone. The game now builds a world from the curriculum, with a hub town in the centre. Contract is to the east, Tort to the south and Public Law to the north, each joined to the hub by a bridged path. I couldn't run the game in a browser overnight, so none of the drawing or door interaction has been seen on screen. The build and all 181 tests pass.

- **Districts and buildings:** every district is a fenced yard with a signpost and an unlit brazier. Each subsection is a building with a door. A new vault note or heading adds buildings automatically, and a test adds a district to confirm that.
- **Colours:** buildings show their state. Locked is grey with a padlock, available is blue, explored is amber and consolidated is green. A brazier lights when its whole district is consolidated.
- **Collision:** trees, water, fences, buildings, signposts and braziers all block the player. The map edge is water and the camera is bounded to the map.
- **Region banner:** entering a region shows a fading banner with the region name, module and season.
- **Doors:** walking to a door shows a prompt, and E opens one of two panels.
  - A locked door lists the prerequisites still to consolidate, by title. Explored is not enough to unlock.
  - An open door shows a tutor picker. The suggested or last-used tutor is marked ★, and your choice is saved per building.
- **Which tutor runs:** the tutor is Claude when both keys are set, otherwise the offline bank. A building with neither says so instead of failing.
- **Tests:** `tests/layout.test.js` covers one building per subsection, no overlaps, solid buildings with walkable doors, every door reachable from the hub, region placement, determinism and collision. `tests/doorInfo.test.js` covers the locked and tutor-picker logic.
- **Save:** your position, region and facing are saved. A saved position that is now inside a wall starts you at the hub fountain.

**Try it:** Run `npm run dev` and open the page.

1. You start at the hub fountain, in the Foundations town. Walk with WASD or the arrow keys.
2. Walk along the east path to Contract. The region banner appears when you cross in.
3. Find the first Contract district. Walk to a blue building's door and press E.
4. Pick a tutor and play. Only the first three Contract buildings and the first Tort building have an offline bank. Other buildings need both a Claude key and an Obsidian token, and the picker says so.
5. Walk to a grey padlocked building and press E to see the prerequisites list.
6. Finish or leave an encounter and the building changes colour.

**Design notes:** - **No Phaser physics:** collision is done in pure code (`worldQuery.js`) instead of Phaser arcade bodies. A world of several thousand tiles would need thousands of static bodies, and this way collision is tested without Phaser. I removed arcade physics from `main.js`.
- **Ground drawing:** the ground is drawn in 16×16-tile chunks only near the camera and freed when far away. The map is large because there are about 170 buildings.
- **Prompt overlap:** the prompt at a door uses the facing direction to choose between doors on opposite sides of a lane. It might be fiddly where the lane is only three tiles wide.
- **Hub:** the first curriculum region (Foundations) is the hub town, with a plaza and a fountain. `buildWorld` supports a hub plus up to three regions and throws if there are more.
- **Unused files:** `src/data/zones.js` and `src/data/demoSubsection.js` are no longer used. I left them in place and they can be deleted.
- **Look:** the art is functional placeholder pixel art for T10 to polish. There is no walk animation, cat or weather yet.
- **Gaps in testing:**
  - I didn't test the Phaser rendering or the encounter flow from the door, because I couldn't run it in a browser.
  - The door-to-encounter wiring reuses the existing, tested encounter code.

**Next:** T10 should add the seasonal tile and tree art, weather particles, the player walk animation and the cat. T11 is the journal. Also consider offline banks for more buildings: only 4 of about 170 can be played without Claude and Obsidian.

## T10 — done — 2026-10-24 03:15:58
Cost $1.49 · 12 min · attempt 1

**What changed:** The world now has seasonal art, weather that changes by region, a walk-animated student and a cat companion. I couldn't run it in a browser overnight, so none of the drawing has been seen on screen. `npm run build` and `npm test` pass (194 tests, 13 new in `tests/sprites.test.js`).

- **Tiles:** each season has its own grass, flowers, paths, water, fences and tree style.
  - Spring has blossom and petals.
  - Summer has dense flowers and glints on the water.
  - Autumn has fallen leaves and orange or red canopies.
  - Winter has snow drifts, ice floes, snowy pines and some bare trees.
  - Sand shores appear where land meets water.
- **Buildings:** they now have shingled roofs with a chimney, timber corner posts, shuttered windows, framed doors with a step and a roof mark. Flower boxes appear in spring and summer, moss on spring roofs, leaves on autumn roofs and snow on winter roofs. The wall and roof colours still show locked, available, explored or consolidated.
- **Weather:** each season has its own particles: petals in spring, sun motes in summer, falling leaves and drifting mist in autumn, snow in winter. Each also adds a faint colour tint. The weather follows the season of the nearest region and fades out and in as you cross the bridge between regions.
- **Player:** a law student with a messenger bag, walking in 4 directions with 2 walk frames plus a standing pose. The frame changes with distance walked, so pushing into a wall doesn't make the legs move.
- **Cat:** a ginger cat that walks the same path you walked, about a tile behind you. It cuts no corners, runs to catch up if it falls behind, and jumps to you after a teleport.
  - Standing still, it stands for about 1.6 seconds, then sits and flicks its tail every few seconds.
  - During an encounter it walks to a free spot beside you and sits.
  - Its position is saved and restored.
- **Braziers:** a lit brazier now flickers between two frames.

**Try it:** Run `npm run dev`.
1. Walk around the hub with WASD. The student's legs should alternate, and the cat should trail you.
2. Stop. After about 1.5 seconds the cat sits and flicks its tail.
3. Walk east along the bridge to Contract and watch the petals fade into sun motes. South is Tort (leaves and mist) and north is Public Law (snow).
4. Compare the buildings in each region: flower boxes in spring and summer, leaves in autumn, snow on the roofs in winter.
5. Open a door with E. The cat should walk up and sit beside you while the encounter is open.

**Design notes:** - **Where the weather switches:** it follows the nearest region, not the region rectangle, so the change happens mid-bridge and fades rather than snapping. It is easy to switch to the exact border.
- **Building textures:** they are made on demand per state, side and season (up to 32), so only the ones used get built.
- **Chunk redraw cost:** the ground chunk redraw is heavier now. I haven't measured it. If scrolling stutters at chunk borders, drop the per-tile detail or cache tile variants.
- **Cat during overlays:** while the menu or door panel is open the cat keeps following normally. It only goes to sit beside you when an encounter is open.
- **Pure logic:** `src/logic/anim.js`, `cat.js` and `weather.js` hold the walk frames, cat behaviour and particle maths. The Phaser files only draw them.
- **Old texture key:** the old `player` texture key no longer exists. Nothing else used it.
- **Weather and cat are drawn from `GameScene.update`:** they hold no state of their own beyond the save's `cat` position.

**Next:** T11 (journal). Once you've seen the game in the browser, tune the cat's follow distance and speed, and the particle counts, in `CAT` in `src/logic/cat.js` and `WEATHER` in `src/logic/weather.js`.

## T11 — done — 2026-10-24 03:19:33
Cost $0.89 · 4 min · attempt 1

**What changed:** Pressing Tab in the world opens a Journal screen. It is also in the Esc menu. Tab or Esc closes it. I couldn't run the game in a browser overnight, so the layout hasn't been seen on screen. `npm run build` and `npm test` pass (202 tests, 8 new in `tests/journal.test.js`).

The journal has four parts:
- **Stats:** four bars (Case Recall, Statutory Interpretation, Application, IRAC Fluency), each showing level and progress to the next level.
- **Your map:** a collapsible tree of module, then district, then subsection. Each subsection shows locked, available, explored or consolidated, and how many open gaps it has. A locked one shows what unlocks it when you hover. A district with its brazier lit shows a flame.
- **Things to revisit:** open gaps as clickable chips, most-missed first. Clicking one shows the building, the module and district, the note file and heading, how often it was missed, the stage where it first appeared, and when it was last seen. It also says that a solid answer on that concept clears the gap.
- **Last sessions:** the 10 most recent encounters, with outcome, tutor, number of exchanges, "left early", and gap count. Hovering shows the gap concepts.

**Try it:** Run `npm run dev`. Play or leave an encounter in any building that has an offline bank, for example the first Contract subsection, then press Tab in the world. You should see stats move after a solid answer, the building's state change in the map, and the session appear in the list. Any missed concepts appear under Things to revisit. Open and close the journal with Tab or Esc, and check W/A/S/D stop moving the player while it is open.</how_to_try_it>
<parameter name="design_notes">- **Session log in the save:** "Last 10 sessions" needed a record that works without Obsidian, so the save now has an optional `sessions` list, capped at 50. Older saves load with an empty list, so I didn't bump `version`. The log uses the outcome recomputed from the stage verdicts, never the outcome the encounter claims. Opening and leaving without answering anything logs nothing.
- **Journal is read-only:** it changes no progress, so it can't be used to skip the learning loop.
- **Gaps for removed buildings:** if the curriculum changes and a gap points at a building that no longer exists, the gap stays in the list and is flagged instead of breaking the screen.
- **Layout and Tab:** the screen's layout is untested visually. I did not test that Tab stays out of browser focus navigation. The key is captured and the overlay swallows it.
- **Click-to-walk:** a gap's detail names the building but can't send you there. A map marker or fast travel would be a later addition.
- **Garden and clients:** T12 and T13 will want to add gap-driven items to this screen.

**Design notes:** —

**Next:** T12 (client NPCs). Once you've seen the journal in the browser, tune the spacing and colours in the "Journal (Tab)" block of `src/style.css`.
