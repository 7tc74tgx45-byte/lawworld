# Overnight agent

This script builds LawWorld while you sleep. It works through `TASKS.md` from top to bottom. For each task it:

1. starts a fresh Claude session (model `claude-sonnet-5-5`) with `docs/VISION.md`, the task and the repo layout;
2. lets Claude read and edit the code, run the build and tests, and read your vault notes (read-only);
3. re-runs `npm run build` and `npm test` itself, and only commits and pushes if both pass. If the code stays broken after three tries, it throws that task's changes away;
4. writes a plain-English entry in `AGENT_LOG.md`, then moves on to the next task.

It stops when the budget is used up. Spending is tracked from the token counts each API reply reports, and the running total survives a restart.

## What the agent can and can't do

- It can only edit files inside the repo. It can't read `.env` or edit its own script.
- The only commands it can run are `npm run build`, `npm test`, `npm install <package>`, `node --test`, `git status`, `git diff` and `git log`. There's no shell, and it can't push or delete outside the repo.
- Vault access is **read-only**: it can list notes, outline them and read them. Only `LAW70xx-*` notes, Bingham and `TUTOR-SESSION-*` notes are visible to it. It never writes to the vault.

## One-time setup (Mac, about 5 minutes)

```bash
cd ~/path/to/lawworld                     # your local clone
# unzip the kit into the repo root so agent/, docs/ and TASKS.md sit next to package.json

python3 -m venv agent/.venv
source agent/.venv/bin/activate
pip install -r agent/requirements.txt

git add agent docs TASKS.md
git commit -m "Add overnight agent kit"
git push
```

Put your Obsidian details in `.env`. The agent uses them to read your notes, and the game uses them when you play locally:

```
VITE_OBSIDIAN_BASE_URL=https://127.0.0.1:27124
VITE_OBSIDIAN_TOKEN=<token from Obsidian → Settings → Local REST API>
```

## Every night

1. Open Obsidian and leave it running, with the Local REST API plugin on.
2. Plug the Mac into power and leave the lid open (the screen can turn off).
3. Run:

```bash
cd ~/path/to/lawworld
source agent/.venv/bin/activate
export ANTHROPIC_API_KEY=sk-ant-...        # your API key from platform.claude.com

python3 agent/overnight.py --check         # free: checks key, git, build, Obsidian
caffeinate -is python3 agent/overnight.py --budget 10
```

`caffeinate` keeps the Mac awake while the script runs. To stop early, press Ctrl-C.

## In the morning

```bash
git log --oneline          # one commit per task
cat AGENT_LOG.md           # what changed, how to try it, the agent's design pushback
npm run dev                # play it at http://localhost:5173
```

If a commit is bad, undo it with `git revert <hash>`. To change direction, edit `TASKS.md`: reorder the tasks, rewrite them, or add new ones in the same `- [ ] **Tnn — Title**` format. The agent always picks up the first unticked task.

## Options

| Flag | Default | Meaning |
|------|---------|---------|
| `--budget` | 10 | Total USD to spend. The running total is kept in `agent/.state.json` |
| `--reset-spend` | off | Set the running total back to $0 (use it on a new night) |
| `--task-cap` | 2.0 | Soft spending cap per task; past it, the agent is told to finish up |
| `--no-push` | push on | Commit locally only |
| `--model` | claude-sonnet-5-5 | Any model listed in `PRICES` in the script |

As a backstop, set a monthly spend limit in the Claude Console (Settings → Limits). Prepaid credits already work as a hard cap: when they run out, the API refuses further calls.
