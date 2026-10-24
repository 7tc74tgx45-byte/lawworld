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
