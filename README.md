# LawWorld

A top-down browser RPG for consolidating law reading. The world is built from your Obsidian vault, and progress only happens when you show understanding by typing answers to a tutor. See `docs/VISION.md` for the design rules.

Built with [Vite](https://vite.dev/), vanilla JavaScript and [Phaser 3](https://phaser.io/).

---

## Getting started

```bash
npm install
npm run dev      # open http://localhost:5173
npm test         # node --test (pure logic in src/logic/)
npm run build    # production build into dist/
```

You start at the hub fountain. Walk to a building and press **E** at its door. (The grey "Contract Law" rectangle from the first demo is gone: every building now comes from the curriculum.)

---

## Playing

### Controls

| Key | What it does |
|---|---|
| `W` `A` `S` `D` / arrows | Walk |
| `E` | Interact: a door, a client, or a garden plot |
| `Tab` | Journal |
| `Esc` | Menu (Resume, Settings, Save now, Export save, Import save) |

While any overlay is open, Phaser keyboard input is switched off so you can type freely.

### The world

- The **hub** (spring) is in the centre and holds the Foundations buildings and the knowledge garden, with paths to three regions: **Contract** (summer), **Tort** (autumn) and **Public Law** (winter).
- Each chapter note is a **district**: a signpost, a brazier and a ring of buildings. Each `##` / `###` heading in the note is a **building**.
- Building colour shows its state: locked, available, explored (you left or did not pass), consolidated.
- A **locked** door shows a padlock and names the subsections that unlock it. Only *consolidated* prerequisites unlock a door; *explored* does not.
- The **brazier** in a district lights when every building in it is consolidated, and stays lit.
- Music and weather change by region; crossing a border fades the screen to the region's season colour.

### Encounters (a building)

At a door you pick a tutor (Professor Hale, Ms Okafor or Dr Chen). The encounter has seven stages: intro, plain English, precision, authority, application, a three-question checkpoint, and a verdict.

- Every step needs a **typed answer** (or an MCQ choice). There is no skip and no "mark as done".
- **Hint** gives a nudge, never the answer. **I'm not sure** is always allowed and logs the concept as a gap. **Ask a question** (5+ characters) puts a question to the tutor instead of answering it.
- Thin answers get up to two follow-ups at the same stage.
- A subsection is **consolidated** only if stages 2-5 were all answered, stages 3 and 5 were judged solid, and the checkpoint scored at least 2/3. Anything else is **explored**, and each missing or partial concept becomes a **gap**.
- **Leave** at any time keeps what was evaluated so far. Closing or reloading the tab mid-encounter does the same: the page-hide handler calls `engine.leave()` and records the result once, so evaluated progress is not lost.
- Online, Claude reads your note live from Obsidian. Without a Claude key and an Obsidian token the game runs **offline** with the built-in question bank (written for the first Contract subsections and the first Tort subsection). Offline mode is labelled in the panel, and a building with no bank needs the online mode.
- If Obsidian is connected, a `TUTOR-SESSION-…` note is written when the encounter ends, and earlier ones are read back as the tutor's memory.

### Settings screen (`Esc`, then Settings)

Claude API key and model, Obsidian URL and token, **Test connection** buttons for each (with clear success/failure text), music volume and mute, and sound-effects volume and mute. Details are in the next section.

### Knowledge garden (hub)

Solid answers in a building earn **seeds** (one per solid stage 2-5). To stop a replayed building from being farmed, a subsection pays at most 4 seeds per calendar day.

Press **E** at an empty plot to plant a seed against a concept to remember (open gaps first, then consolidated topics you have not seen for longest). Press **E** at a plant to **water** it by answering a short retrieval question. Only a solid answer grows it, a partial answer keeps it alive, and a "not sure" is logged as a gap. A watered plant stays damp for 10 minutes. A plant not watered for three in-game days (8 real hours each, so 24 hours) withers, and a solid answer revives it. Trees grow through five stages and persist.

### Clients

A client NPC wanders each region once something there is explored or consolidated, bringing a short problem built from those subsections (biased toward your open gaps). Press **E**, type your advice, and the tutor evaluates it (Issue, Rule, Application, Conclusion), with one follow-up. Good advice earns the region's material (Precedent Scrolls, Case Reports, Statute Rolls or Ink) and stat gains. A served client leaves for five minutes. Clients need no skip: no typed advice, no reward.

### Journal (`Tab`)

Read-only. Four stat bars (Case Recall, Statutory Interpretation, Application, IRAC Fluency), your materials and seeds, a tree of modules, districts and buildings with their states, the "Things to revisit" gap list (with the building each gap lives in), and the last ten sessions.

### Saving

The game autosaves to `localStorage` (key `lawworld.save`) after every meaningful action and writes a finished encounter at once. The save is versioned and migrated, and covers position and region, every subsection state, gaps, stats, inventory, garden plots, lit braziers, cat position, tutor preference per building, clients and the session log. A corrupt save is moved to a backup key and a fresh game starts. Reloading puts you back exactly where you were.

From the `Esc` menu: **Save now**, **Export save** (downloads a JSON file) and **Import save** (validates the file first and changes nothing if it is bad). The Claude key and Obsidian token are never part of a save.

---

## Settings

Settings are stored in `localStorage` under `lawworld.settings.v1` (handled by `src/settings.js`) and edited in the in-game Settings screen.

| Setting | Default | Notes |
|---|---|---|
| `claudeApiKey` | empty | Your Anthropic key. Stored only in this browser. |
| `claudeModel` | `claude-sonnet-5-5` | Any Messages API model id. |
| `obsidianUrl` | `https://127.0.0.1:27124` | Local REST API plugin (HTTPS port). |
| `obsidianToken` | empty | Bearer token from the plugin's settings. |
| `musicVolume`, `musicMuted` | | Procedural music (Web Audio, no files). |
| `sfxVolume`, `sfxMuted` | | Synthesised sound effects. |

You can still set them by hand in the browser console:

```js
localStorage.setItem('lawworld.settings.v1', JSON.stringify({
  claudeApiKey: 'sk-ant-...',
  obsidianToken: '...',
}));
```

**Order of precedence:** Settings (localStorage) first. A `.env` file is a **dev-only fallback**: it is read only while `npm run dev` is running, only when Settings has no value, and is ignored in production builds. No key is ever needed at build time and none is hard-coded.

Optional `.env` (copy `.env.example`; `.env` is gitignored):

```
VITE_CLAUDE_API_KEY=
VITE_OBSIDIAN_TOKEN=
VITE_OBSIDIAN_BASE_URL=https://127.0.0.1:27124
```

Claude is called straight from the browser with the headers `x-api-key`, `anthropic-version: 2023-06-01` and `anthropic-dangerous-direct-browser-access: true`. That is fine for a personal local tool, but do not deploy it publicly with a key in it.

---

## Connecting Obsidian (self-signed certificate)

1. In Obsidian, install and enable the **Local REST API** community plugin.
2. Copy its API key (the bearer token) into LawWorld's Settings.
3. The plugin serves HTTPS on `https://127.0.0.1:27124` with a **self-signed certificate**, which browsers block by default. **Open `https://127.0.0.1:27124` once in the same browser**, click through the warning ("Advanced", then "Proceed") and you should see a small JSON status page. After that, the game can talk to Obsidian.
4. If Obsidian or Claude cannot be reached, the game falls back to **offline mode** with the built-in question bank, clearly labelled.

### Write safety

The game reads study notes live and never edits them. It may only create files whose names start with `TUTOR-SESSION-` (ending `.md`, vault root only). `LAW7054-Tort-Ch8-Breach-Standard-of-Care.md` is always refused. The rule is a pure function in `src/logic/noteGuard.js`, covered by `tests/noteGuard.test.js`, and `writeNote()` in `src/api/obsidian.js` checks it before any network call.

---

## Project structure

```
src/
├── logic/   pure JS (no Phaser, no DOM, no import.meta.env): rules, encounter engine, progress, garden, clients, save, layout. Unit-tested.
├── api/     browser clients: claude.js, obsidian.js, tutor.js (Claude), offlineTutor.js, sessionNotes.js
├── game/    Phaser scenes (graphics drawn programmatically)
├── ui/      DOM overlays: encounter, settings, journal, garden, door panel, client encounter, transitions
├── audio/   procedural music and sound effects (Web Audio)
├── data/    curriculum, tutors, offline question bank
├── settings.js   localStorage-backed settings
└── main.js
tests/       node:test files, run by `npm test`
```
