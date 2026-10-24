// Claude tutor provider: implements the encounter-engine tutor interface (see src/logic/encounter.js).
// Context for every call = the live note section for the subsection (via Obsidian), prior TUTOR-SESSION notes
// for it, and open gaps. Replies are strict JSON, parsed defensively with ONE repair retry.
// Dependencies are injectable (opts.call / readNote / listFiles) so the provider can be tested without a network.

import { callClaude } from './claude.js';
import { readNote as obsidianRead, listFiles as obsidianList } from './obsidian.js';
import { getPersona, personaSystemPrompt } from '../data/tutors.js';
import { extractSection, sessionFilesFor } from '../logic/notes.js';
import { parseWithRepair, REPAIR_PROMPT, cleanPrompt, cleanEvaluation, cleanText } from '../logic/tutorJson.js';
import {
  contextBlock, introPrompt, questionPrompt, mcqPrompt, evaluatePrompt, hintPrompt, mcqHintPrompt,
  notSurePrompt, answerPrompt, webAnswerPrompt,
} from '../logic/tutorPrompts.js';

export const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 3 };

/** Pull the "Gaps" and "Next time" sections out of a TUTOR-SESSION note (what the tutor needs, not the whole log). */
export function sessionDigest(markdown) {
  const parts = [];
  for (const h of ['Gaps', 'Next time']) {
    const s = extractSection(markdown, h);
    if (s) parts.push(s.replace(/^#+\s*/, '').replace(/\n+/g, ' '));
  }
  return parts.join(' | ');
}

/**
 * createClaudeTutor({ personaId, call?, readNote?, listFiles?, model? }) -> tutor
 * The tutor keeps a per-subsection cache of the note context and of the checkpoint questions.
 */
export function createClaudeTutor(opts = {}) {
  const persona = getPersona(opts.personaId ?? 'chen');
  const call = opts.call ?? callClaude;
  const readNote = opts.readNote ?? obsidianRead;
  const listFiles = opts.listFiles ?? obsidianList;
  const system = personaSystemPrompt(persona.id);
  const cache = new Map(); // subsection id -> { block, base, mcq?, secrets }

  async function ask(user, extra = {}) {
    const res = await call({ system, messages: [{ role: 'user', content: user }], maxTokens: extra.maxTokens ?? 1400, model: opts.model, tools: extra.tools });
    return res.text ?? '';
  }

  /** Ask for JSON, validate, repair once. */
  async function askJson(user, validate, extra) {
    const text = await ask(user, extra);
    return parseWithRepair(
      text,
      async (bad) => {
        const res = await call({
          system,
          messages: [
            { role: 'user', content: user },
            { role: 'assistant', content: bad.slice(0, 4000) || '(empty)' },
            { role: 'user', content: REPAIR_PROMPT },
          ],
          maxTokens: extra?.maxTokens ?? 1400,
          model: opts.model,
        });
        return res.text ?? '';
      },
      validate,
    );
  }

  /** Load (once per subsection) the note section, earlier sessions, and build the shared context block. */
  async function load(ctx) {
    const sub = ctx.subsection;
    let entry = cache.get(sub.id);
    if (!entry) {
      let noteSection = '';
      let noteNote = '';
      const md = await readNote(sub.sourceFile); // a failure here is surfaced to the player (retry / offline)
      noteSection = extractSection(md, sub.heading);
      if (!noteSection) {
        noteSection = md;
        noteNote = `heading "${sub.heading}" was not found, so the whole note is supplied`;
      }
      let priorSessions = [];
      try {
        const files = sessionFilesFor(await listFiles(), sub.id).slice(0, 2);
        for (const f of files) {
          try {
            const d = sessionDigest(await readNote(f));
            if (d) priorSessions.push(d);
          } catch { /* a missing session note is not fatal */ }
        }
      } catch { /* listing failed: carry on without memory */ }
      entry = { base: { subsection: sub, noteSection, noteNote, priorSessions }, mcq: null, secrets: new Map() };
      cache.set(sub.id, entry);
    }
    const gaps = (ctx.priorGaps ?? []).filter((g) => !g.resolved);
    return { entry, block: contextBlock({ ...entry.base, gaps }) };
  }

  async function loadMcq(entry, block) {
    if (entry.mcq) return entry.mcq;
    const obj = await askJson(mcqPrompt(block), (o) => {
      const qs = Array.isArray(o.questions) ? o.questions.map((q) => cleanPrompt(q, { mcq: true })).filter(Boolean) : [];
      return qs.length >= 3 ? { questions: qs.slice(0, 3) } : null;
    }, { maxTokens: 2000 });
    entry.mcq = obj.questions;
    return entry.mcq;
  }

  const questionOf = (prompt) => prompt?.text ?? '';
  const secretFor = (entry, stage) => entry.secrets.get(stage) ?? '';

  return {
    id: persona.id,
    name: persona.name,
    colour: persona.colour,
    offline: false,

    async generate(stage, ctx) {
      const { entry, block } = await load(ctx);
      if (stage === 1) {
        const o = await askJson(introPrompt(block), (x) => cleanText(x));
        return { text: o.text };
      }
      if (stage === 6) {
        const qs = await loadMcq(entry, block);
        const q = qs[ctx.mcqIndex] ?? qs[qs.length - 1];
        return { text: `Question ${ctx.mcqIndex + 1} of 3: ${q.text}`, options: q.options, modelAnswer: q.options[q.correct] };
      }
      const o = await askJson(questionPrompt(block, stage), (x) => cleanPrompt(x));
      entry.secrets.set(stage, o.modelAnswer ?? '');
      return { text: o.text, modelAnswer: o.modelAnswer ?? '' };
    },

    async evaluate(stage, prompt, answer, ctx) {
      const { entry, block } = await load(ctx);
      if (stage === 6) {
        const q = entry.mcq?.[ctx.mcqIndex];
        if (!q) throw new Error('Checkpoint question missing; please retry.');
        const correct = answer === q.correct;
        const concept = q.concept || ctx.subsection.keyConcepts?.[0] || ctx.subsection.title;
        return {
          verdict: correct ? 'solid' : 'missing',
          correct,
          feedback: correct ? `Correct. ${q.explanation}` : `Not quite. ${q.explanation}`,
          conceptsHit: correct ? [concept] : [],
          conceptsMissed: correct ? [] : [concept],
        };
      }
      const answers = ctx.answers?.length ? ctx.answers : [String(answer)];
      const ev = await askJson(
        evaluatePrompt(block, {
          stage, question: questionOf(prompt), modelAnswer: secretFor(entry, stage),
          answers, followUpsUsed: ctx.followUpsUsed, notSure: ctx.notSure,
        }),
        cleanEvaluation,
      );
      return ev;
    },

    async hint(stage, prompt, index, ctx) {
      const { entry, block } = await load(ctx);
      if (stage === 6) {
        const q = entry.mcq?.[ctx.mcqIndex];
        const o = await askJson(mcqHintPrompt(block, { q, index }), (x) => cleanText(x));
        return o.text;
      }
      const o = await askJson(
        hintPrompt(block, { stage, question: questionOf(prompt), modelAnswer: secretFor(entry, stage), answers: ctx.answers ?? [], index }),
        (x) => cleanText(x),
      );
      return o.text; // the engine's leak check replaces a hint that copies the model answer
    },

    async notSure(stage, prompt, ctx) {
      const { entry, block } = await load(ctx);
      if (stage === 6) {
        const q = entry.mcq?.[ctx.mcqIndex];
        return { explanation: q?.explanation ?? '', concepts: [q?.concept || ctx.subsection.title] };
      }
      const o = await askJson(
        notSurePrompt(block, { stage, question: questionOf(prompt), modelAnswer: secretFor(entry, stage) }),
        (x) => (typeof x.explanation === 'string' && x.explanation.trim() ? x : null),
      );
      const concepts = Array.isArray(o.concepts) ? o.concepts.map(String).filter(Boolean).slice(0, 6) : [];
      return { explanation: o.explanation.trim(), concepts: concepts.length ? concepts : ctx.subsection.keyConcepts };
    },

    /** Answer from the note first; use web search ONLY if the note lacks the answer, and mark that external. */
    async answerQuestion(question, ctx) {
      const { block } = await load(ctx);
      const o = await askJson(answerPrompt(block, question), (x) => (typeof x.text === 'string' && x.text.trim() && typeof x.inNote === 'boolean' ? x : null));
      if (o.inNote) return { text: o.text.trim(), external: false };
      try {
        const web = (await ask(webAnswerPrompt(question, ctx.subsection), { tools: [WEB_SEARCH_TOOL], maxTokens: 1500 })).trim();
        if (web) return { text: web, external: true };
      } catch { /* fall through to the honest "note is silent" answer */ }
      return { text: `${o.text.trim()} I could not search the web just now, so I will not guess beyond your notes.`, external: false };
    },
  };
}
