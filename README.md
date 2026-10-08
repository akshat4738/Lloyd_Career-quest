# 🗺️ CareerQuest — Reverse-Engineered Career Roadmapper

Type a hyper-specific dream job → a **local LLM (Ollama)** builds a personalised, interactive
**skill tree** you can zoom, pan and click. No cloud, no API keys.

## Run it (3 steps)

1. Make sure **Ollama is running** and the model is pulled (once):
   ```
   ollama pull llama3.2:3b
   ```
2. In this folder:
   ```
   npm install
   ```
3. Start everything (API server + web app) with one command:
   ```
   npm run dev
   ```
   Open **http://localhost:5173**

The model name is set in `.env` (`OLLAMA_MODEL=llama3.2:3b`). Change it to e.g. `qwen2.5:7b-instruct`
for better quality (restart `npm run dev` afterwards).

## Features
- **AI engine**: your goal + hours/week + months + background → phases, skills, certifications,
  projects and real intermediate roles as a prerequisite graph (structured JSON output, validated and repaired server-side).
- **Interactive skill tree** (React Flow): zoom, pan, minimap, click any node.
- **Actionable nodes**: click a node → the AI writes a weekend project, GitHub repo idea, 5 interview questions and tips.
- **Dynamic re-routing**: mark "I already know this" and the node disappears; its parents re-connect to its children and the camera re-frames.
- **Gamification**: XP, levels, locked / ready / done states, confetti on phase completion.
- **Limits & re-plan**: set hours/week + months; the HUD warns if over budget; "Re-plan with AI" regenerates and carries over progress.
- **Compare two roles**: side by side, shared stepping stones glow gold.
- **People who took this path**: 3 typical journeys with intermediate roles and side projects.
- **Export / share**: PNG image export and a copy-paste share link (roadmap is encoded in the URL).

## Project layout
```
server/index.js      Express API + Ollama calls + prompts + JSON schemas
server/normalize.js  Turns messy LLM output into a guaranteed-valid DAG
server/knowledge.js  Real roles / certs / tools injected into prompts (grounding)
src/App.jsx          App state, HUD, landing, actions
src/graph.js         Layout, re-routing, node states, XP, overlap matching
src/components/*     RoadmapView (React Flow), QuestNode, Drawer, CompareView, PathsModal...
```

## Troubleshooting
- **"Cannot reach Ollama"** → open the Ollama app / run `ollama serve`.
- **"Model not found"** → `ollama pull llama3.2:3b`.
- **Generation is slow** → normal on CPU (30-120 s). First call also loads the model into memory.
  Use a bigger model only if you have the RAM/GPU.
- **Port busy** → change `PORT` in `.env` and the proxy target in `vite.config.js`.
- **Poor/odd roadmap** → click "New quest" and be more specific, or try again; for better quality use a 7B+ model.
