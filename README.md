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

Walk to the grey "Contract Law" rectangle and press **E** to play the offline demo encounter.

---

## Settings

The game is configured in the in-game **Settings** screen (arrives in task T07). Until then, values live in `localStorage` under the key `lawworld.settings.v1`, handled by `src/settings.js`.

| Setting | Default | Notes |
|---|---|---|
| `claudeApiKey` | empty | Your Anthropic key. Stored only in this browser. |
| `claudeModel` | `claude-sonnet-5-5` | Any Messages API model id. |
| `obsidianUrl` | `https://127.0.0.1:27124` | Local REST API plugin (HTTPS port). |
| `obsidianToken` | empty | Bearer token from the plugin's settings. |

To set them by hand before the Settings screen exists, run this in the browser console on the game page:

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
├── logic/   pure JS (no Phaser, no DOM, no import.meta.env): rules, encounter engine, note guard. Unit-tested.
├── api/     browser clients: claude.js, obsidian.js, offlineTutor.js
├── game/    Phaser scenes (graphics drawn programmatically)
├── ui/      DOM overlays (encounter, later settings and journal)
├── data/    curriculum, tutors, offline question bank
├── settings.js   localStorage-backed settings
└── main.js
tests/       node:test files, run by `npm test`
```

## Controls

`W` `A` `S` `D` / arrow keys move, `E` interacts. While an overlay is open, Phaser keyboard input is switched off so you can type freely.
