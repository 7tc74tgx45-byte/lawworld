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
