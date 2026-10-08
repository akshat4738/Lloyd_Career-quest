import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hintsFor } from './knowledge.js';
import { normalizeRoadmap } from './normalize.js';

const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/* ------------------------------ Ollama helper ------------------------------ */

class OllamaDown extends Error {}

async function ollamaJSON({ system, user, schema, temperature = 0.5, numPredict = 2200 }) {
  let res;
  try {
    res = await fetch(`${HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        format: schema, // structured output: forces valid JSON matching the schema
        keep_alive: '30m',
        options: { temperature, num_ctx: 4096, num_predict: numPredict },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch {
    throw new OllamaDown(`Cannot reach Ollama at ${HOST}. Start it (open the Ollama app, or run "ollama serve").`);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 404) throw new OllamaDown(`Model "${MODEL}" not found. Run: ollama pull ${MODEL}`);
    throw new Error(`Ollama error ${res.status}: ${t.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let out = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.error) throw new Error(obj.error);
        out += obj.message?.content ?? '';
      } catch (e) {
        if (e.message && !e.message.includes('JSON')) throw e;
      }
    }
  }
  try {
    return JSON.parse(out);
  } catch {
    // salvage the largest {...} block
    const s = out.indexOf('{');
    const e = out.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(out.slice(s, e + 1));
    throw new Error('Model did not return valid JSON');
  }
}

async function withRetries(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      if (e instanceof OllamaDown) throw e;
      last = e;
      console.warn(`[attempt ${i + 1}/${tries}] ${e.message}`);
    }
  }
  throw new Error(`The AI could not produce a valid result (${last?.message}). Try again or simplify the goal.`);
}

function sendError(res, e) {
  console.error(e.message);
  res.status(e instanceof OllamaDown ? 503 : 502).json({ error: e.message });
}

/* -------------------------------- Schemas ---------------------------------- */

const roadmapSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['skill', 'certification', 'project', 'role'] },
          title: { type: 'string' },
          description: { type: 'string' },
          phase: { type: 'integer' },
          hours: { type: 'integer' },
          requires: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'type', 'title', 'description', 'phase', 'hours', 'requires'],
      },
    },
  },
  required: ['summary', 'nodes'],
};

const detailSchema = {
  type: 'object',
  properties: {
    weekendProject: {
      type: 'object',
      properties: { title: { type: 'string' }, description: { type: 'string' }, deliverables: { type: 'array', items: { type: 'string' } } },
      required: ['title', 'description', 'deliverables'],
    },
    repoIdea: {
      type: 'object',
      properties: { name: { type: 'string' }, whatToBuild: { type: 'string' }, techStack: { type: 'array', items: { type: 'string' } } },
      required: ['name', 'whatToBuild', 'techStack'],
    },
    interviewQuestions: {
      type: 'array',
      items: { type: 'object', properties: { q: { type: 'string' }, lookFor: { type: 'string' } }, required: ['q', 'lookFor'] },
    },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['weekendProject', 'repoIdea', 'interviewQuestions', 'tips'],
};

const pathsSchema = {
  type: 'object',
  properties: {
    paths: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          persona: { type: 'string' },
          startingPoint: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: { role: { type: 'string' }, when: { type: 'string' }, sideProject: { type: 'string' } },
              required: ['role', 'when', 'sideProject'],
            },
          },
        },
        required: ['persona', 'startingPoint', 'steps'],
      },
    },
  },
  required: ['paths'],
};

/* -------------------------------- Prompts ---------------------------------- */

function roadmapPrompts({ goal, hours, months, background, known }) {
  const capacity = Math.round((Number(hours) || 10) * 4.3 * (Number(months) || 6));
  const hints = hintsFor(goal);
  const system = `You are an expert career coach who knows how real people get hired. You reply with JSON only.
Design a skill-tree roadmap for the user's EXACT dream job.

RULES
- Output 12 to 16 nodes. Each node has: id ("n1","n2",...), type, title, description, phase, hours, requires.
- type is one of: skill, certification, project, role.
- title: max 8 words and SPECIFIC (name the real tool, framework, certification or job title, never "learn basics").
- description: ONE short, concrete sentence.
- phase: 1=Foundations, 2=Core Skills, 3=Specialise (for the exact industry / company type in the goal), 4=Proof of Work (projects and certifications), 5=Launch (real intermediate or entry-level job titles, applying, interviews).
- hours: realistic integer study hours for that step.
- requires: ids of nodes from EARLIER phases that must be finished first. Phase 1 nodes use [].
- Include at least 3 projects specific to the industry named in the goal, at least 1 real certification, and at least 2 real job titles (internship, junior role, etc.) in phase 5.
- Use only real tools, real certifications and real job titles. NEVER invent URLs.
- The whole plan should total about ${capacity} hours (${hours || 10} hours/week for ${months || 6} months).
- Skip anything the user already knows.
- summary: 1-2 sentences describing this exact path.
${hints ? '\n' + hints + '\n' : ''}
EXAMPLE NODE: {"id":"n4","type":"project","title":"Build a REST API with Express","description":"Create a CRUD API with JWT auth and deploy it on Render.","phase":2,"hours":14,"requires":["n1","n2"]}`;
  const user = `Dream job: ${goal}
Background: ${background || 'college student, beginner'}
Skills already known (do NOT include): ${known || 'none'}
Time budget: ${hours || 10} hours per week for ${months || 6} months.`;
  return { system, user };
}

/* -------------------------------- Routes ----------------------------------- */

app.get('/api/health', async (_req, res) => {
  try {
    const r = await fetch(`${HOST}/api/tags`);
    const j = await r.json();
    const names = (j.models || []).map((m) => m.name);
    const installed = names.some((n) => n === MODEL || n === `${MODEL}:latest` || n.split(':')[0] === MODEL);
    res.json({ ollama: true, model: MODEL, installed, installedModels: names });
  } catch {
    res.json({ ollama: false, model: MODEL, installed: false, installedModels: [] });
  }
});

app.post('/api/generate', async (req, res) => {
  const { goal } = req.body || {};
  if (!goal || String(goal).trim().length < 3) return res.status(400).json({ error: 'Please enter a dream job.' });
  try {
    const { system, user } = roadmapPrompts(req.body);
    const roadmap = await withRetries(async (i) => {
      const raw = await ollamaJSON({ system, user, schema: roadmapSchema, temperature: i === 0 ? 0.5 : 0.3 });
      return normalizeRoadmap(raw, String(goal).trim());
    });
    res.json(roadmap);
  } catch (e) {
    sendError(res, e);
  }
});

app.post('/api/node-detail', async (req, res) => {
  const { goal, node, known, background } = req.body || {};
  if (!goal || !node?.title) return res.status(400).json({ error: 'Missing goal or node.' });
  const system = `You are a practical mentor. Reply with JSON only.
Give highly specific, actionable help for ONE step of a career roadmap.
- weekendProject: a concrete project doable in one weekend that proves this step, tied to the user's industry. title, 2-sentence description, 3 deliverables.
- repoIdea: a GitHub repository idea: name (kebab-case), whatToBuild (1-2 sentences), techStack (3-5 real technologies).
- interviewQuestions: exactly 5 questions an interviewer for the target job would ask about this step, each with lookFor (what a good answer includes, one sentence).
- tips: 3 short, concrete tips (real tools, real course or certification names are fine; NEVER invent URLs).`;
  const user = `Dream job: ${goal}
Roadmap step: ${node.title} (${node.type}) - ${node.description || ''}
User background: ${background || 'college student'}
Skills the user already knows: ${known || 'none'}`;
  try {
    const out = await withRetries(async () => {
      const d = await ollamaJSON({ system, user, schema: detailSchema, temperature: 0.7, numPredict: 1600 });
      if (!d?.weekendProject?.title || !Array.isArray(d.interviewQuestions)) throw new Error('Incomplete detail');
      return d;
    }, 2);
    res.json(out);
  } catch (e) {
    sendError(res, e);
  }
});

app.post('/api/paths', async (req, res) => {
  const { goal, background } = req.body || {};
  if (!goal) return res.status(400).json({ error: 'Missing goal.' });
  const system = `You are a career researcher. Reply with JSON only.
Describe 3 DIFFERENT typical routes people take to land the target job. Each path has a persona (e.g. "CS grad via internship"), a startingPoint, and 3-5 steps. Each step has a real job title or milestone in "role", a rough timing in "when" (e.g. "Year 1"), and a concrete side project they built in "sideProject". These are typical patterns, not real named people. Never invent URLs.`;
  const user = `Target job: ${goal}\nTypical audience: ${background || 'college students'}`;
  try {
    const out = await withRetries(async () => {
      const d = await ollamaJSON({ system, user, schema: pathsSchema, temperature: 0.7, numPredict: 1800 });
      if (!Array.isArray(d?.paths) || !d.paths.length) throw new Error('No paths');
      return d;
    }, 2);
    res.json(out);
  } catch (e) {
    sendError(res, e);
  }
});

/* ------------- Serve the built frontend if it exists (npm start) ----------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const server = app.listen(PORT, () => {
  console.log(`\n  CareerQuest API  → http://localhost:${PORT}`);
  console.log(`  Ollama model     → ${MODEL} @ ${HOST}\n`);
});
server.requestTimeout = 0;
server.timeout = 0;
