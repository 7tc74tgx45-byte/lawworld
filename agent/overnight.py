#!/usr/bin/env python3
"""
LawWorld overnight build agent.

Runs on your Mac inside the lawworld repo. Works through TASKS.md one task at a
time with the Anthropic API, verifies every change with `npm run build` and
`npm test`, commits each finished task, pushes, and stops when the budget is
spent (or the tasks run out).

    python3 agent/overnight.py --check          # preflight only, no API spend
    caffeinate -is python3 agent/overnight.py --budget 10

See agent/README.md for setup.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import os
import re
import shlex
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

REPO = pathlib.Path(__file__).resolve().parent.parent
AGENT_DIR = REPO / "agent"
STATE_FILE = AGENT_DIR / ".state.json"
RUN_LOG = AGENT_DIR / "run.log"
AGENT_LOG = REPO / "AGENT_LOG.md"
TASKS_FILE = REPO / "TASKS.md"
VISION_FILE = REPO / "docs" / "VISION.md"

# USD per million tokens (input, output). Cache writes bill at 1.25x input,
# cache reads at 0.1x input. Check https://platform.claude.com/docs/en/about-claude/pricing
PRICES = {
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-sonnet-4-5": (3.00, 15.00),
}

SKIP_DIRS = {".git", "node_modules", "dist", "dist-ssr", "__pycache__", ".venv"}
PROTECTED_NAMES = {".env", ".env.local"}
PROTECTED_PREFIXES = ("agent/", ".git/", "node_modules/", "dist/")
ALLOWED_COMMANDS = [
    ["npm", "run", "build"],
    ["npm", "test"],
    ["npm", "run", "test"],
    ["npm", "install"],
    ["node", "--test"],
    ["git", "status"],
    ["git", "diff"],
    ["git", "log"],
]
PKG_RE = re.compile(r"^(@[\w.-]+/)?[\w.-]+(@[\w.^~<>=-]+)?$")
VAULT_NOTE_RE = re.compile(r"^(LAW70(53|54|55)-.*|Bingham - Rule of Law)\.md$")
MAX_READ_CHARS = 40_000


# ---------------------------------------------------------------- utilities

def now() -> str:
    return dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log(msg: str) -> None:
    line = f"[{now()}] {msg}"
    print(line, flush=True)
    try:
        with RUN_LOG.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def load_dotenv(path: pathlib.Path) -> dict:
    out = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def run(cmd: list[str], timeout: int = 300) -> tuple[int, str]:
    try:
        p = subprocess.run(
            cmd, cwd=REPO, capture_output=True, text=True, timeout=timeout,
            env={**os.environ, "CI": "1", "FORCE_COLOR": "0"},
        )
        return p.returncode, (p.stdout + p.stderr)
    except subprocess.TimeoutExpired:
        return 124, f"Timed out after {timeout}s: {' '.join(cmd)}"
    except FileNotFoundError as e:
        return 127, str(e)


def tail(text: str, n: int = 8000) -> str:
    return text if len(text) <= n else "…(truncated)…\n" + text[-n:]


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except json.JSONDecodeError:
            pass
    return {"spent": 0.0, "attempts": {}, "skipped": [], "proposal_rounds": 0}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2))


# ---------------------------------------------------------------- vault (read-only)

class Vault:
    def __init__(self, base: str, token: str):
        self.base = base.rstrip("/")
        self.token = token
        host = urllib.parse.urlparse(self.base).hostname or ""
        self.ctx = ssl.create_default_context()
        if host in ("127.0.0.1", "localhost", "::1"):
            # The Obsidian Local REST API uses a self-signed cert on localhost only.
            self.ctx.check_hostname = False
            self.ctx.verify_mode = ssl.CERT_NONE

    def _get(self, path: str, accept: str) -> str:
        req = urllib.request.Request(
            self.base + path,
            headers={"Authorization": f"Bearer {self.token}", "Accept": accept},
        )
        with urllib.request.urlopen(req, context=self.ctx, timeout=20) as r:
            return r.read().decode("utf-8", "replace")

    def list(self) -> list[str]:
        data = json.loads(self._get("/vault/", "application/json"))
        return [f for f in data.get("files", []) if not f.endswith("/")]

    def read(self, name: str) -> str:
        quoted = "/".join(urllib.parse.quote(seg) for seg in name.split("/"))
        return self._get("/vault/" + quoted, "text/markdown")


HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
CASE_RE = re.compile(r"[*_]((?:[A-Z][^*_\n]{1,90}? v\.? [^*_\n]{1,90}?)|(?:Re [A-Z][^*_\n]{1,60}?)|(?:[A-Z][^*_\n]{1,40}?'s Case))[*_]")
STATUTE_RE = re.compile(r"\b([A-Z][A-Za-z'()]*(?: (?:[A-Z][A-Za-z'()]*|of|and|the|for|to|on|in))* Act \d{4})")


def outline(md: str) -> str:
    """Headings with line numbers, plus case names and statutes under each."""
    out, cases, statutes = [], [], []

    def flush():
        if cases:
            out.append("    cases: " + "; ".join(dict.fromkeys(cases))[:600])
        if statutes:
            out.append("    statutes: " + "; ".join(dict.fromkeys(statutes))[:300])
        cases.clear()
        statutes.clear()

    for i, line in enumerate(md.splitlines(), 1):
        m = HEADING_RE.match(line)
        if m:
            flush()
            out.append(f"L{i} {m.group(1)} {m.group(2).strip()}")
            continue
        cases.extend(c.strip() for c in CASE_RE.findall(line))
        statutes.extend(s.strip() for s in STATUTE_RE.findall(line))
    flush()
    return "\n".join(out) or "(no headings found)"


def extract_section(md: str, heading: str) -> str | None:
    lines = md.splitlines()
    target = heading.strip().lstrip("#").strip().lower()
    for i, line in enumerate(lines):
        m = HEADING_RE.match(line)
        if m and target in m.group(2).strip().lower():
            level = len(m.group(1))
            end = len(lines)
            for j in range(i + 1, len(lines)):
                m2 = HEADING_RE.match(lines[j])
                if m2 and len(m2.group(1)) <= level:
                    end = j
                    break
            return "\n".join(lines[i:end])
    return None


# ---------------------------------------------------------------- tools

TOOLS = [
    {
        "name": "list_files",
        "description": "List files in the repo (skips node_modules, .git, dist). Path is relative to the repo root.",
        "input_schema": {"type": "object", "properties": {"path": {"type": "string", "default": "."}}},
    },
    {
        "name": "read_file",
        "description": "Read a text file from the repo with line numbers. Optionally a line range.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "start_line": {"type": "integer"},
                "end_line": {"type": "integer"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Create or overwrite a file in the repo with the full content. For large files write a skeleton first and add to it with edit_file.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}, "content": {"type": "string"}},
            "required": ["path", "content"],
        },
    },
    {
        "name": "edit_file",
        "description": "Replace one exact, unique occurrence of old_str with new_str in a repo file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "old_str": {"type": "string"},
                "new_str": {"type": "string"},
            },
            "required": ["path", "old_str", "new_str"],
        },
    },
    {
        "name": "delete_file",
        "description": "Delete a file in the repo.",
        "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
    },
    {
        "name": "run_command",
        "description": "Run an allowed command in the repo root: npm run build | npm test | npm install <pkg> [-D] | node --test [files] | git status | git diff [args] | git log [args]. No shell operators.",
        "input_schema": {"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]},
    },
    {
        "name": "vault_list",
        "description": "List study-note filenames in Fynn's Obsidian vault (read-only).",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "vault_outline",
        "description": "Compact outline of a vault note: headings with line numbers, plus case names and statutes found under each heading. Cheap; use this before vault_read.",
        "input_schema": {"type": "object", "properties": {"filename": {"type": "string"}}, "required": ["filename"]},
    },
    {
        "name": "vault_read",
        "description": "Read a vault note (read-only). Pass heading to get just that section; otherwise use offset/limit in characters.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {"type": "string"},
                "heading": {"type": "string"},
                "offset": {"type": "integer", "default": 0},
                "limit": {"type": "integer", "default": 20000},
            },
            "required": ["filename"],
        },
    },
    {
        "name": "finish_task",
        "description": "Call once the task is complete (or cannot progress). The harness then runs npm run build and npm test; if they fail you will be asked to fix them.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string"},
                "status": {"type": "string", "enum": ["done", "partial", "blocked"]},
                "summary": {"type": "string", "description": "What changed, for Fynn, in plain words."},
                "how_to_try_it": {"type": "string", "description": "What Fynn should do in the browser to see this work."},
                "design_notes": {"type": "string", "description": "Pushback, risks, decisions Fynn should know about."},
                "next_steps": {"type": "string"},
            },
            "required": ["task_id", "status", "summary"],
        },
    },
]


class ToolError(Exception):
    pass


def safe_path(p: str, for_write: bool = False) -> pathlib.Path:
    rel = p.strip()
    while rel.startswith("./"):
        rel = rel[2:]
    rel = rel.lstrip("/") or "."
    full = (REPO / rel).resolve()
    if full != REPO and REPO not in full.parents:
        raise ToolError(f"Path outside repo: {p}")
    relposix = full.relative_to(REPO).as_posix() if full != REPO else "."
    if (full.name in PROTECTED_NAMES or full.name.startswith(".env")) and full.name != ".env.example":
        raise ToolError(f"{p} is protected")
    if for_write and any((relposix + "/").startswith(pre) for pre in PROTECTED_PREFIXES):
        raise ToolError(f"{p} is protected")
    if for_write and relposix == ".":
        raise ToolError("Cannot write the repo root")
    return full


def check_command(cmd: str) -> list[str]:
    if any(ch in cmd for ch in ";&|><$`\n"):
        raise ToolError("Shell operators are not allowed")
    parts = shlex.split(cmd)
    for allowed in ALLOWED_COMMANDS:
        if parts[: len(allowed)] == allowed:
            if allowed == ["npm", "install"]:
                for arg in parts[2:]:
                    if arg in ("-D", "--save-dev"):
                        continue
                    if not PKG_RE.match(arg):
                        raise ToolError(f"Bad package name: {arg}")
            if allowed[0] == "git" and any(a in ("--output", "-o") for a in parts):
                raise ToolError("Not allowed")
            return parts
    raise ToolError(f"Command not allowed: {cmd}")


def execute(name: str, args: dict, vault: Vault | None) -> str:
    if name == "list_files":
        root = safe_path(args.get("path", "."))
        files = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
            for fn in sorted(filenames):
                fp = pathlib.Path(dirpath) / fn
                files.append(f"{fp.relative_to(REPO).as_posix()}  ({fp.stat().st_size} B)")
        return "\n".join(files[:500]) or "(empty)"

    if name == "read_file":
        fp = safe_path(args["path"])
        if not fp.is_file():
            raise ToolError(f"No such file: {args['path']}")
        lines = fp.read_text(encoding="utf-8", errors="replace").splitlines()
        s = max(1, args.get("start_line") or 1)
        e = min(len(lines), args.get("end_line") or len(lines))
        body = "\n".join(f"{i:>5}  {lines[i-1]}" for i in range(s, e + 1))
        if len(body) > MAX_READ_CHARS:
            body = body[:MAX_READ_CHARS] + f"\n…(truncated; file has {len(lines)} lines — use start_line/end_line)"
        return body or "(empty file)"

    if name == "write_file":
        fp = safe_path(args["path"], for_write=True)
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(args["content"], encoding="utf-8")
        return f"Wrote {args['path']} ({len(args['content'].splitlines())} lines)"

    if name == "edit_file":
        fp = safe_path(args["path"], for_write=True)
        if not fp.is_file():
            raise ToolError(f"No such file: {args['path']}")
        text = fp.read_text(encoding="utf-8")
        n = text.count(args["old_str"])
        if n != 1:
            raise ToolError(f"old_str found {n} times; it must match exactly once")
        fp.write_text(text.replace(args["old_str"], args["new_str"], 1), encoding="utf-8")
        return f"Edited {args['path']}"

    if name == "delete_file":
        fp = safe_path(args["path"], for_write=True)
        if not fp.is_file():
            raise ToolError(f"No such file: {args['path']}")
        fp.unlink()
        return f"Deleted {args['path']}"

    if name == "run_command":
        parts = check_command(args["command"])
        code, out = run(parts, timeout=420)
        return f"exit {code}\n{tail(out)}"

    if name.startswith("vault_"):
        if vault is None:
            raise ToolError("Obsidian is not reachable tonight. Use the fallback described in the task.")
        try:
            if name == "vault_list":
                files = [f for f in vault.list() if VAULT_NOTE_RE.match(f)]
                return "\n".join(sorted(files)) or "(no LAW notes found)"
            fn = args["filename"]
            if not VAULT_NOTE_RE.match(fn) and not fn.startswith("TUTOR-SESSION-"):
                raise ToolError("Only LAW70xx study notes, Bingham and TUTOR-SESSION notes can be read")
            md = vault.read(fn)
            if name == "vault_outline":
                return f"{fn} — {len(md)} chars\n" + outline(md)
            if args.get("heading"):
                sec = extract_section(md, args["heading"])
                if sec is None:
                    raise ToolError(f"Heading not found: {args['heading']}. Use vault_outline.")
                md = sec
            off = max(0, args.get("offset") or 0)
            lim = min(30000, args.get("limit") or 20000)
            chunk = md[off: off + lim]
            more = f"\n…({len(md) - off - lim} more chars; use offset)" if off + lim < len(md) else ""
            return chunk + more
        except urllib.error.HTTPError as e:
            raise ToolError(f"Obsidian returned {e.code} for that note")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise ToolError(f"Obsidian unreachable: {e}")

    raise ToolError(f"Unknown tool {name}")


# ---------------------------------------------------------------- tasks

TASK_START = re.compile(r"^- \[( |x)\] \*\*(T\d+)\b")


def parse_tasks() -> list[dict]:
    tasks, cur = [], None
    for line in TASKS_FILE.read_text(encoding="utf-8").splitlines():
        m = TASK_START.match(line)
        if m:
            cur = {"id": m.group(2), "done": m.group(1) == "x", "lines": [line]}
            tasks.append(cur)
        elif cur is not None and (line.startswith("- [") or line.startswith("#")):
            cur = None
        elif cur is not None:
            cur["lines"].append(line)
    for t in tasks:
        t["text"] = "\n".join(t["lines"]).rstrip()
    return tasks


def tick_task(task_id: str) -> None:
    text = TASKS_FILE.read_text(encoding="utf-8")
    text = re.sub(rf"^- \[ \] \*\*{task_id}\b", f"- [x] **{task_id}", text, count=1, flags=re.M)
    TASKS_FILE.write_text(text, encoding="utf-8")


def repo_tree() -> str:
    try:
        return execute("list_files", {"path": "."}, None)
    except ToolError as e:
        return str(e)


def recent_log(n_chars: int = 4000) -> str:
    if not AGENT_LOG.exists():
        return "(no entries yet)"
    return tail(AGENT_LOG.read_text(encoding="utf-8"), n_chars)


def append_agent_log(entry: str) -> None:
    if not AGENT_LOG.exists():
        AGENT_LOG.write_text("# LawWorld — Overnight agent log\n\nNewest entries at the bottom.\n", encoding="utf-8")
    with AGENT_LOG.open("a", encoding="utf-8") as f:
        f.write("\n" + entry.strip() + "\n")


# ---------------------------------------------------------------- git + verify

def git_clean() -> bool:
    code, out = run(["git", "status", "--porcelain"])
    return code == 0 and out.strip() == ""


def verify() -> tuple[bool, str]:
    report = []
    code, out = run(["npm", "run", "build"], timeout=600)
    report.append(f"$ npm run build → exit {code}\n{tail(out, 5000)}")
    if code != 0:
        return False, "\n".join(report)
    pkg = json.loads((REPO / "package.json").read_text())
    if "test" in pkg.get("scripts", {}):
        code, out = run(["npm", "test"], timeout=600)
        report.append(f"$ npm test → exit {code}\n{tail(out, 5000)}")
        if code != 0:
            return False, "\n".join(report)
    return True, "\n".join(report)


def commit(message: str, push: bool) -> str:
    run(["git", "add", "-A"])
    code, out = run(["git", "commit", "-m", message])
    if code != 0:
        return f"commit failed: {tail(out, 500)}"
    if push:
        pcode, pout = run(["git", "push"], timeout=120)
        if pcode != 0:
            return "committed locally; push failed: " + tail(pout, 300)
        return "committed and pushed"
    return "committed locally"


def rollback() -> None:
    run(["git", "reset", "--hard", "HEAD"])
    run(["git", "clean", "-fd", "-e", "agent/"])


# ---------------------------------------------------------------- API

class OutOfCredit(Exception):
    pass


def cost_of(usage, prices) -> tuple[float, int]:
    pin, pout = prices
    inp = getattr(usage, "input_tokens", 0) or 0
    cw = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cr = getattr(usage, "cache_read_input_tokens", 0) or 0
    out = getattr(usage, "output_tokens", 0) or 0
    cost = (inp * pin + cw * pin * 1.25 + cr * pin * 0.10 + out * pout) / 1_000_000
    return cost, inp + cw + cr


def call_api(client, anthropic, **kw):
    delay = 15
    for attempt in range(8):
        try:
            with client.messages.stream(**kw) as s:
                return s.get_final_message()
        except anthropic.AuthenticationError:
            raise SystemExit("API key rejected. Check ANTHROPIC_API_KEY.")
        except anthropic.BadRequestError as e:
            if "credit" in str(e).lower():
                raise OutOfCredit(str(e))
            raise
        except anthropic.APIStatusError as e:
            if e.status_code in (429, 500, 502, 503, 529):
                log(f"API {e.status_code}, retrying in {delay}s")
            else:
                raise
        except anthropic.APIConnectionError as e:
            log(f"Connection error ({e}), retrying in {delay}s")
        time.sleep(delay)
        delay = min(delay * 2, 300)
    raise RuntimeError("API kept failing; stopping for the night.")


def to_dicts(content) -> list[dict]:
    out = []
    for b in content:
        if b.type == "text" and b.text:
            out.append({"type": "text", "text": b.text})
        elif b.type == "tool_use":
            out.append({"type": "tool_use", "id": b.id, "name": b.name, "input": b.input})
    return out or [{"type": "text", "text": "(no content)"}]


def with_cache_breakpoint(messages: list[dict]) -> list[dict]:
    """Strip old breakpoints and cache the whole conversation up to the last block."""
    for m in messages:
        if isinstance(m["content"], list):
            for blk in m["content"]:
                blk.pop("cache_control", None)
    last = messages[-1]["content"]
    if isinstance(last, list) and last:
        last[-1]["cache_control"] = {"type": "ephemeral"}
    return messages


SYSTEM_RULES = """You are the lead game developer on LawWorld, working unattended overnight. Fynn Amos (LLM Law student, Oxford Brookes) reviews your commits in the morning. He cares most that the game genuinely teaches and checks understanding from his own Obsidian notes; visuals matter but come second.

How you work
- One task per session: the one named in the first message. Stay in scope; fix any blocking bug you meet on the way.
- Never add tasks to TASKS.md. You may not append, insert, or write new task entries to that file — TASKS.md is Fynn's to curate. Your job is only to tick off tasks that are already there.
- Read before you edit. Prefer edit_file for changes; write_file for new files. Keep files under ~400 lines; split modules rather than growing one file.
- Before finish_task, run `npm run build` and `npm test` yourself and fix failures. The harness re-runs both and will refuse to commit a broken build.
- Be honest in finish_task. "partial" with a clear note is better than claiming "done".
- If the task as written would hurt the learning design or the architecture, do the better thing and explain why in design_notes. Fynn wants pushback.

Architecture
- src/logic/  pure JS (no Phaser, no DOM, no import.meta.env, no fetch) — all rules: progress, gating, encounter state machine, save schema, layout, note parsing. Unit-tested in tests/*.test.js with node:test and node:assert. `npm test` runs `node --test`.
- src/api/    Claude and Obsidian clients, tutor providers (browser fetch).
- src/game/   Phaser 3 scenes. Graphics drawn programmatically and turned into textures; no external image files.
- src/ui/     DOM overlays (encounter, settings, journal) over the canvas. Text input lives in the DOM, not Phaser. While an overlay is open, disable Phaser keyboard input and release key captures so the player can type W/A/S/D/space.
- src/data/   curriculum, tutors, offline question bank.
- No new runtime dependencies beyond Phaser unless essential.

Hard rules
- Never write to the vault from this session (you only have read tools). In the game, writeNote may only create files starting with TUTOR-SESSION-, and must refuse LAW7054-Tort-Ch8-Breach-Standard-of-Care.md.
- Don't copy note prose into the repo. Extract headings, short concept lists, case names, statutes. The game reads notes live at runtime. The offline bank may contain short questions and model answers you write yourself, grounded in the notes.
- Never hard-code API keys. Browser Claude calls need `anthropic-dangerous-direct-browser-access: true`. Default model id: claude-sonnet-5-5.
- England & Wales law. Never invent citations; if the vault is silent, say so in the content.
- The learning rules in VISION.md §1 are non-negotiable: typed answers, tutor as gatekeeper, follow-ups, hints that nudge, no skip buttons.

The full product vision follows. Re-read the relevant section before designing anything.
"""


def build_system() -> list[dict]:
    vision = VISION_FILE.read_text(encoding="utf-8") if VISION_FILE.exists() else "(docs/VISION.md missing)"
    return [{"type": "text", "text": SYSTEM_RULES + "\n\n" + vision, "cache_control": {"type": "ephemeral"}}]


def tools_with_cache() -> list[dict]:
    tools = json.loads(json.dumps(TOOLS))
    tools[-1]["cache_control"] = {"type": "ephemeral"}
    return tools


# ---------------------------------------------------------------- main loop

def run_task(client, anthropic, cfg, state, vault, task: dict) -> str:
    tid = task["id"]
    started = time.time()
    kickoff = f"""Your task this session: **{tid}**

{task['text']}

Context
- Budget: ${state['spent']:.2f} of ${cfg.budget:.2f} spent tonight. Soft cap for this task: ${cfg.task_cap:.2f}.
- Obsidian vault tools are {'AVAILABLE' if vault else 'UNAVAILABLE tonight (use the fallback)'}.
- Tasks being skipped tonight: {', '.join(state['skipped']) or 'none'}.

Repo files
{repo_tree()}

Recent agent log
{recent_log()}

Full TASKS.md (for awareness only — do just {tid})
{TASKS_FILE.read_text(encoding='utf-8')}

Start by reading the files you need."""

    messages = [{"role": "user", "content": [{"type": "text", "text": kickoff}]}]
    system, tools = build_system(), tools_with_cache()
    task_cost, verify_fails, wrap_sent = 0.0, 0, False
    prices = PRICES[cfg.model]
    outcome = None

    for turn in range(1, cfg.max_turns + 1):
        if state["spent"] >= cfg.budget:
            outcome = ("budget", None)
            break
        resp = call_api(
            client, anthropic, model=cfg.model, max_tokens=16000, system=system,
            tools=tools, messages=with_cache_breakpoint(messages),
        )
        cost, ctx = cost_of(resp.usage, prices)
        state["spent"] += cost
        task_cost += cost
        save_state(state)
        log(f"{tid} turn {turn}: ${cost:.3f} (task ${task_cost:.2f}, night ${state['spent']:.2f}), context {ctx:,} tok")

        messages.append({"role": "assistant", "content": to_dicts(resp.content)})
        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        cut_off = resp.stop_reason == "max_tokens"

        if not tool_uses:
            nudge = ("Your message hit the output limit. " if cut_off else "") + \
                "Continue using the tools. When the task is complete, call finish_task."
            messages.append({"role": "user", "content": [{"type": "text", "text": nudge}]})
            continue

        results, finish = [], None
        for tu in tool_uses:
            if tu.name == "finish_task":
                finish = tu
                continue
            if cut_off and tu is tool_uses[-1]:
                results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                "content": "Cut off at the output limit, not executed. Write large files in smaller pieces."})
                continue
            try:
                out = execute(tu.name, tu.input, vault)
                results.append({"type": "tool_result", "tool_use_id": tu.id, "content": out})
            except ToolError as e:
                results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True, "content": str(e)})
            except Exception as e:  # keep the night going
                results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True, "content": f"Tool crashed: {e!r}"})

        if finish is not None:
            ok, report = verify()
            if ok:
                outcome = ("finished", finish.input)
                results.append({"type": "tool_result", "tool_use_id": finish.id, "content": "Verified. Committing."})
                messages.append({"role": "user", "content": results})
                break
            verify_fails += 1
            log(f"{tid}: verification failed ({verify_fails})")
            (REPO / "agent" / "last-failure.log").write_text(f"# {tid} verify fail {verify_fails}\n\n" + report)
            if verify_fails > 2 or finish.input.get("status") == "blocked":
                outcome = ("broken", finish.input)
                break
            results.append({"type": "tool_result", "tool_use_id": finish.id, "is_error": True,
                            "content": "Verification FAILED. Fix this, then call finish_task again.\n" + report})

        if not wrap_sent and (task_cost >= cfg.task_cap or ctx >= cfg.context_soft):
            wrap_sent = True
            results.append({"type": "text", "text":
                "You're near this task's budget/context limit. Get the build and tests green, then call finish_task "
                "(status 'partial' if needed, with clear next_steps)."})
        if ctx >= cfg.context_hard or task_cost >= cfg.task_cap * 1.5:
            outcome = ("limit", None)
            messages.append({"role": "user", "content": results})
            break
        messages.append({"role": "user", "content": results})
    else:
        outcome = ("limit", None)

    kind, info = outcome
    minutes = (time.time() - started) / 60
    attempts = state["attempts"].get(tid, 0) + 1
    state["attempts"][tid] = attempts

    if kind in ("limit", "budget") and info is None:
        ok, _ = verify()
        info = {"status": "partial", "summary": "Stopped at a limit before finish_task.", "next_steps": "Continue this task."}
        kind = "finished" if ok else "broken"

    if kind == "finished":
        status = info.get("status", "partial")
        if status == "done":
            tick_task(tid)
        elif attempts >= 2:
            state["skipped"].append(tid)
        append_agent_log(f"""## {tid} — {status} — {now()}
Cost ${task_cost:.2f} · {minutes:.0f} min · attempt {attempts}

**What changed:** {info.get('summary', '')}

**Try it:** {info.get('how_to_try_it', '—')}

**Design notes:** {info.get('design_notes', '—')}

**Next:** {info.get('next_steps', '—')}""")
        res = commit(f"agent({tid}): {status} — {info.get('summary', '')[:60]}", cfg.push)
        log(f"{tid}: {status}, {res}")
    else:
        rollback()
        if attempts >= 2:
            state["skipped"].append(tid)
        append_agent_log(f"""## {tid} — rolled back — {now()}
Cost ${task_cost:.2f} · {minutes:.0f} min · attempt {attempts}

The build or tests stayed broken, so tonight's changes for this task were discarded.
{('Agent said: ' + info.get('summary', '')) if info else ''}""")
        res = commit(f"agent({tid}): log rollback", cfg.push)
        log(f"{tid}: rolled back, {res}")
    save_state(state)
    return kind


def proposal_task(state) -> dict:
    n = 90 + state["proposal_rounds"] * 3
    return {"id": f"T{n}", "text": f"""- [ ] **T{n} — Review and propose**
  All listed tasks are done or skipped. Review the codebase against docs/VISION.md, then append 3 new tasks
  (ids T{n+1}, T{n+2}, T{n+3}) under "## Agent-proposed" in TASKS.md, in the same format, each with a clear
  "Done when". Prioritise learning depth, then Obsidian integration, then feel/visuals. Then call finish_task with status done."""}


def preflight(cfg, quiet: bool = False) -> tuple[bool, Vault | None]:
    ok = True
    say = (lambda m: None) if quiet else (lambda m: print(m, flush=True))
    say(f"Repo: {REPO}")
    for f in (TASKS_FILE, VISION_FILE):
        if not f.exists():
            say(f"✗ missing {f.relative_to(REPO)}")
            ok = False
    if cfg.model not in PRICES:
        say(f"✗ no price for model {cfg.model}; add it to PRICES")
        ok = False
    key = os.environ.get("ANTHROPIC_API_KEY")
    say("✓ ANTHROPIC_API_KEY set" if key else "✗ ANTHROPIC_API_KEY not set (export it first)")
    ok &= bool(key)
    if not (REPO / "node_modules").exists():
        say("… running npm install")
        run(["npm", "install"], timeout=600)
    if git_clean():
        say("✓ git working tree clean")
    else:
        say("✗ uncommitted changes — commit or stash them first (git status)")
        ok = False
    code, _ = run(["git", "remote", "get-url", "origin"])
    say("✓ git remote set" if code == 0 else "! no git remote; commits stay local")
    good, report = verify()
    say("✓ build/tests pass now" if good else "! build currently fails — the agent will be told to fix it first\n" + tail(report, 1500))

    env = load_dotenv(REPO / ".env")
    base = env.get("VITE_OBSIDIAN_BASE_URL") or "https://127.0.0.1:27124"
    if "27123" in base and base.startswith("http://"):
        base = "https://127.0.0.1:27124"
    token = env.get("VITE_OBSIDIAN_TOKEN", "")
    vault = None
    if token:
        try:
            v = Vault(base, token)
            notes = [f for f in v.list() if VAULT_NOTE_RE.match(f)]
            say(f"✓ Obsidian reachable at {base}: {len(notes)} LAW notes")
            vault = v
        except Exception as e:
            say(f"! Obsidian not reachable at {base} ({e}). Open Obsidian with the Local REST API plugin enabled.")
    else:
        say("! VITE_OBSIDIAN_TOKEN missing in .env — vault tools disabled")

    nxt = next((t for t in parse_tasks() if not t["done"]), None) if TASKS_FILE.exists() else None
    say(f"Next task: {nxt['id'] if nxt else '(none)'}")
    say(f"Budget tonight: ${cfg.budget:.2f} (already spent: ${load_state()['spent']:.2f})")
    return ok, vault


def main():
    ap = argparse.ArgumentParser(description="LawWorld overnight build agent")
    ap.add_argument("--budget", type=float, default=10.0, help="USD to spend in total (persists across restarts)")
    ap.add_argument("--task-cap", type=float, default=2.0, help="soft USD cap per task")
    ap.add_argument("--model", default="claude-sonnet-5-5")
    ap.add_argument("--max-turns", type=int, default=60)
    ap.add_argument("--context-soft", type=int, default=140_000)
    ap.add_argument("--context-hard", type=int, default=180_000)
    ap.add_argument("--no-push", dest="push", action="store_false")
    ap.add_argument("--check", action="store_true", help="preflight only; no API calls")
    ap.add_argument("--reset-spend", action="store_true", help="start the spend counter at $0")
    cfg = ap.parse_args()

    if cfg.reset_spend and STATE_FILE.exists():
        STATE_FILE.unlink()
    ok, vault = preflight(cfg)
    if cfg.check or not ok:
        sys.exit(0 if ok else 1)

    import anthropic  # noqa: E402
    client = anthropic.Anthropic(max_retries=2)
    state = load_state()
    log(f"=== Night started · model {cfg.model} · budget ${cfg.budget:.2f} · spent so far ${state['spent']:.2f}")

    try:
        while True:
            remaining = cfg.budget - state["spent"]
            if remaining < 0.40:
                log("Budget reached. Stopping.")
                break
            pending = [t for t in parse_tasks() if not t["done"] and t["id"] not in state["skipped"]]
            if pending:
                task = pending[0]
            elif state["proposal_rounds"] < 3:
                task = proposal_task(state)
                state["proposal_rounds"] += 1
                save_state(state)
            else:
                log("No tasks left. Stopping.")
                break
            log(f"--- {task['id']} starting (${remaining:.2f} left)")
            if run_task(client, anthropic, cfg, state, vault, task) == "budget":
                break
    except OutOfCredit as e:
        log(f"Out of API credit: {e}")
    except KeyboardInterrupt:
        log("Stopped by you (Ctrl-C). Uncommitted work for the current task is left in place; review with git status.")
    finally:
        done = [t["id"] for t in parse_tasks() if t["done"]]
        log(f"=== Night over · spent ${state['spent']:.2f} · tasks done: {', '.join(done) or 'none'} · skipped: {', '.join(state['skipped']) or 'none'}")


if __name__ == "__main__":
    main()
