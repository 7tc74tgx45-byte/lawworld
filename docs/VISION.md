# LawWorld — Vision & Design Rules

LawWorld is a top-down, Stardew-Valley-meets-Pokémon world for Fynn Amos, an LLM Law (Conversion) student at Oxford Brookes. Its job is **consolidation of real reading**: the world is built from Fynn's Obsidian vault, and progress in the world only happens when he shows understanding of what he has read.

It is not a quiz app with a game skin, and it is not an exam simulator. A good session feels like working through a chapter with a sharp tutor who remembers you.

---

## 1. The learning loop (non-negotiable)

1. **Nothing progresses without a typed answer.** Every question requires the player to type and submit a response (or pick an MCQ option). There is no "Mark as consolidated" button, no "Next" that skips a question, and no click-through dialogue in place of a question.
2. **The tutor is the gatekeeper.** Only the tutor's evaluation moves a subsection to *consolidated*. The player can leave an encounter at any time; progress so far is kept and the subsection becomes *explored*.
3. **Evaluation responds to what was written.** Feedback names what the answer got right, what was missing or wrong, and adds the legal precision. If an answer is thin, the tutor asks a follow-up at the same stage (up to 2) before moving on and logging a gap.
4. **Mistakes and curiosity are rewarded, not punished.** "Hint" and "I'm not sure" are always available. A hint is a Socratic nudge, never the answer. Saying "I'm not sure" is useful information: it logs the concept as a gap to revisit.
5. **The player can ask questions.** At any point the player may ask the tutor a question instead of answering. The tutor answers from the vault note first; if the vault doesn't cover it, the tutor may use web search and must label that answer as **external, not from your notes**.
6. **Depth.** A subsection encounter is at least 8 exchanges and usually 10–15 minutes. A chapter is many subsections. A module is weeks of play.

### Encounter stages (per subsection)

| # | Stage | What the player does |
|---|-------|---------------------|
| 1 | Intro | Tutor sets the scene in 2–3 sentences (why this matters, link to what came before). |
| 2 | Plain English | Explain the concept in their own words. |
| 3 | Precision | Give the legal rule properly: elements, tests, statutory wording. |
| 4 | Authority | Name and explain a case (facts → rule → why it matters), or a statutory section. |
| 5 | Application | A short client scenario. Player identifies the issue and applies the rule. Tutor nudges toward IRAC structure (Issue, Rule, Application, Conclusion). |
| 6 | Checkpoint | 3 MCQs on what was just covered. A wrong answer opens a short explanation. |
| 7 | Verdict | Tutor summarises what landed and what didn't, and gives the outcome. |

Stages may loop (follow-ups) and the tutor may add an extra layer when the note has more depth (for example Consideration → part payment → *Pinnel's Case* → *Foakes v Beer* → promissory estoppel).

### Consolidation rule

A subsection becomes **consolidated** only when:
- every stage 2–5 has been answered (not skipped), and
- at least stages 3 and 5 were judged *solid*, the rest at least *partial*, and
- the checkpoint scored at least 2/3.

Otherwise it becomes **explored**, and each concept judged *missing* or *partial* is logged as a **gap** that later resurfaces (in the garden, in client NPC problems, and at the start of the next encounter on that topic).

---

## 2. Curriculum = map

The vault is flat. Study notes are named `LAW[module]-[Author/Source]-[WX or ChX]-[Topic].md`. Modules:

- **LAW7053 Legal Foundations** (Rutherford) — the starting area. **Spring.**
- **LAW7054 Contract** (Poole/Merkin & Saintier) — **Summer.**
- **LAW7054 Tort** (Brennan) — **Autumn.**
- **LAW7055 Public Law** (Stanton & Prescott; Bingham) — **Winter.**

Structure: **module → region**, **chapter or lecture note → district**, **section heading in the note (## / ###) → building**. The curriculum file is generated from the vault's note headings, so new notes add new buildings.

Prerequisites follow the logic of the law, for example:
- Contract: Offer & Acceptance → Consideration → Promissory Estoppel; Intention after Consideration; Terms after Formation; Vitiating factors after Terms.
- Tort: Duty of Care → Breach → Causation → Remoteness → Defences; Psychiatric Harm after Duty; Occupiers' Liability after Breach.
- Public Law: UK Constitution → Separation of Powers → Rule of Law → Parliamentary Sovereignty → Judicial Review → HRA.
- Foundations: What is Law → Precedent → Statutory Interpretation → Judiciary → Legal Personnel.

A locked building shows a padlock and names what unlocks it.

---

## 3. Tutors

Three personas, defined in data and used as system prompts:

- **Professor Hale (Socratic)** — answers questions with sharper questions; best for conceptual topics (Rule of Law, Sovereignty, What is Law).
- **Ms Okafor, Solicitor (Practitioner)** — frames everything as a client file: "What do you tell the client? What's the risk? What evidence do we need?" Best for Contract and Tort.
- **Dr Chen (Seminar lead)** — warm and conversational; explains, then checks. Best for Foundations and for a first pass at anything.

The player may switch tutor at the door of any building. All three ground everything in the vault note, never invent citations, and use England & Wales law.

---

## 4. World

- Hub town (spring) in the centre with paths to three regions.
- Each region has its own palette and weather particles: summer sun motes and long grass; autumn falling leaves and mist; winter snow and frost; spring petals.
- Districts are clusters of buildings around a signpost and a **hearth/brazier** that lights when the whole chapter is consolidated.
- Player: a law student with a messenger bag, 4-direction walk animation. **Cat companion** follows a few tiles behind and sits beside the player during encounters.
- NPCs:
  - Tutors stationed in each region.
  - **Client NPCs** who wander and bring a legal problem built from subsections the player has explored. The player types advice; the tutor evaluates it (IRAC). Good advice earns materials.
- **Knowledge garden** in the hub: solid answers earn seeds; planting a seed and *watering* it requires answering a short retrieval question on a past gap or consolidated topic (spaced repetition). Trees grow through stages and persist.
- Materials by region: Contract → Precedent Scrolls; Tort → Case Reports; Public Law → Statute Rolls; Foundations → Ink. Materials buy extra hints or light braziers.
- Character stats: Case Recall, Statutory Interpretation, Application, IRAC Fluency. They rise from evaluated answers, not from clicking.
- Graphics are drawn programmatically (Phaser Graphics → generated textures) — simple but deliberate pixel art, no circle-head placeholders.

---

## 5. Obsidian integration

- Local REST API plugin: `https://127.0.0.1:27124` (self-signed certificate; the player must open that URL once in the browser and accept it). Bearer token.
- At encounter start the game fetches the subsection's note **live** and extracts the relevant heading section, plus any prior `TUTOR-SESSION-*` notes for that subsection, plus logged gaps. That is the tutor's context.
- After an encounter the game writes `TUTOR-SESSION-YYYY-MM-DD-HHMM-<subsectionId>.md` (frontmatter + covered / landed / gaps / tutor / outcome).
- **The game may only write files whose name starts with `TUTOR-SESSION-`.** It never edits study notes. `LAW7054-Tort-Ch8-Breach-Standard-of-Care.md` must never be written.
- If Obsidian or the Claude API is unreachable, the game runs in **offline mode** using a built-in question bank and a simple local evaluator, clearly labelled.

## 6. Claude API (in the game)

- Called from the browser with headers `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`.
- Default model `claude-sonnet-5-5`, configurable in Settings.
- Keys are entered in the in-game Settings screen and stored in localStorage. `.env` is a dev-only fallback. Never hard-code keys; never require them at build time.
- The tutor returns strict JSON (question objects, evaluation objects) that the encounter engine consumes; free text is only for display.
- Web search uses the Messages API server tool `{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}` and only when the player asks something the note doesn't cover.

## 7. Save system

Auto-save to localStorage after every meaningful action (versioned schema with migrations): player position and region, every subsection state, gaps, stats, inventory, garden plots, lit braziers, cat position, settings, tutor preference per subsection. Manual "Save" in the menu, plus export/import of the save as JSON. Reloading restores exactly where the player was.

## 8. Law accuracy notes

- England & Wales only. Use the vault for content; if the vault is silent, say so rather than invent.
- **The Occupiers' Liability Act 1984 exists**: it governs the duty owed to non-visitors (including trespassers) and replaced the common-law position in *British Railways Board v Herrington* [1972] AC 537. The 1957 Act governs lawful visitors. One vault note wrongly says the 1984 Act does not exist; do not repeat that error.
- Citations in OSCOLA style where shown.
