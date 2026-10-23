# Lawworld

A top-down browser RPG for studying law. You walk around a 2D world and interact with zones, NPCs, and content powered by Claude AI and your Obsidian vault.

Built with [Vite](https://vite.dev/) + vanilla JavaScript + [Phaser 3](https://phaser.io/).

---

## What it does (foundation)

- Top-down tile map with WASD / arrow-key movement
- Player-character walks around a green tile world
- Zone structure (`src/data/zones.js`) maps map regions to law topics
- Claude API client (`src/api/claude.js`) for AI-driven NPC dialogue and quiz questions
- Obsidian API client (`src/api/obsidian.js`) for reading/writing vault notes in-game

---

## Getting started

### 1. Clone

```bash
git clone https://github.com/fynnamos/lawworld.git
cd lawworld
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Key | Where to get it |
|---|---|
| `VITE_CLAUDE_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `VITE_OBSIDIAN_TOKEN` | Obsidian → Settings → Local REST API plugin |
| `VITE_OBSIDIAN_BASE_URL` | Default `http://127.0.0.1:27123` (change if custom port) |

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Project structure

```
lawworld/
├── src/
│   ├── game/          # Phaser scenes and game logic
│   │   └── GameScene.js
│   ├── api/           # External API clients
│   │   ├── claude.js      # Claude AI (NPC dialogue, quizzes)
│   │   └── obsidian.js    # Obsidian vault (read/write notes)
│   ├── data/          # Static data and content structure
│   │   └── zones.js       # Map zone definitions (regions → law topics)
│   └── main.js        # Phaser game bootstrap
├── .env               # Local secrets (gitignored)
├── .env.example       # Template — copy to .env
└── vite.config.js
```

---

## Controls

| Key | Action |
|---|---|
| `W` / `↑` | Move up |
| `S` / `↓` | Move down |
| `A` / `←` | Move left |
| `D` / `→` | Move right |

---

## Build for production

```bash
npm run build
```

Output goes to `dist/`. Deploy anywhere that serves static files (Cloudflare Pages, Vercel, Netlify, etc.).
