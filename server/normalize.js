// Small local models produce imperfect graphs. This turns whatever the LLM returned into a
// guaranteed-valid DAG: unique ids, edges only point forward in phase (so no cycles), every
// non-root node has a parent, and every leaf connects to the final "dream job" node.

export const PHASE_NAMES = {
  1: 'Foundations',
  2: 'Core Skills',
  3: 'Specialise',
  4: 'Proof of Work',
  5: 'Launch',
  6: 'Dream Job',
};
const TYPES = ['skill', 'certification', 'project', 'role'];

const clip = (s, n) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function normalizeRoadmap(raw, goal) {
  const list = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const seen = new Set();
  const nodes = [];

  for (const n of list) {
    const title = clip(n?.title, 70);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const type = TYPES.includes(String(n.type).toLowerCase()) ? String(n.type).toLowerCase() : 'skill';
    nodes.push({
      _orig: String(n.id ?? '').trim().toLowerCase(),
      _req: Array.isArray(n.requires) ? n.requires.map((r) => String(r).trim().toLowerCase()) : [],
      type,
      title,
      description: clip(n.description, 240) || 'Work through this step with a small hands-on exercise.',
      phase: clamp(Math.round(Number(n.phase)) || 1, 1, 5),
      hours: clamp(Math.round(Number(n.hours)) || 8, 1, 150),
    });
    if (nodes.length >= 18) break;
  }

  if (nodes.length < 6) throw new Error('The model returned too few usable steps');

  // Make sure phases start at 1.
  const minPhase = Math.min(...nodes.map((n) => n.phase));
  if (minPhase > 1) nodes.forEach((n) => (n.phase -= minPhase - 1));

  nodes.forEach((n, i) => (n.id = 'n' + (i + 1)));

  // Map ids the model used (or index fallbacks) to our ids.
  const lookup = new Map();
  nodes.forEach((n) => n._orig && !lookup.has(n._orig) && lookup.set(n._orig, n));
  nodes.forEach((n, i) => {
    for (const k of ['n' + (i + 1), String(i + 1)]) if (!lookup.has(k)) lookup.set(k, n);
  });

  // Parents: only from strictly earlier phases => the graph is always acyclic.
  const parents = new Map(nodes.map((n) => [n.id, new Set()]));
  for (const n of nodes) {
    for (const r of n._req) {
      const p = lookup.get(r);
      if (p && p.phase < n.phase) parents.get(n.id).add(p.id);
    }
  }
  // Orphans in later phases get attached to the nearest earlier phase.
  const posInPhase = {};
  for (const n of nodes) {
    posInPhase[n.phase] = (posInPhase[n.phase] ?? -1) + 1;
    if (n.phase > 1 && parents.get(n.id).size === 0) {
      for (let ph = n.phase - 1; ph >= 1; ph--) {
        const cands = nodes.filter((c) => c.phase === ph);
        if (cands.length) {
          parents.get(n.id).add(cands[posInPhase[n.phase] % cands.length].id);
          break;
        }
      }
    }
  }

  const edges = [];
  const hasChild = new Set();
  for (const n of nodes) {
    [...parents.get(n.id)].slice(0, 3).forEach((pid) => {
      edges.push({ id: `${pid}-${n.id}`, source: pid, target: n.id });
      hasChild.add(pid);
    });
  }

  const goalNode = {
    id: 'goal',
    type: 'goal',
    title: clip(goal, 60),
    description: 'Your dream role. Everything on this map leads here.',
    phase: 6,
    hours: 0,
  };
  const leaves = nodes.filter((n) => !hasChild.has(n.id));
  (leaves.length ? leaves : [nodes[nodes.length - 1]]).forEach((n) =>
    edges.push({ id: `${n.id}-goal`, source: n.id, target: 'goal' })
  );

  const clean = nodes.map(({ id, type, title, description, phase, hours }) => ({
    id,
    type,
    title,
    description,
    phase,
    hours,
  }));

  return {
    goal: clip(goal, 120),
    summary: clip(raw?.summary, 300),
    phaseNames: PHASE_NAMES,
    nodes: [...clean, goalNode],
    edges,
  };
}
