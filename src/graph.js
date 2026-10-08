export const PHASE_NAMES = {
  1: 'Foundations',
  2: 'Core Skills',
  3: 'Specialise',
  4: 'Proof of Work',
  5: 'Launch',
  6: 'Dream Job',
};
export const PHASE_COLORS = {
  1: '#4ade80',
  2: '#22d3ee',
  3: '#a78bfa',
  4: '#fbbf24',
  5: '#fb7185',
  6: '#f472b6',
};
export const TYPE_EMOJI = { skill: '⚡', certification: '🏅', project: '🛠️', role: '🚩', goal: '👑' };

export const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9+# ]/g, ' ').replace(/\s+/g, ' ').trim();

export function parentsMap(roadmap) {
  const m = {};
  roadmap.nodes.forEach((n) => (m[n.id] = []));
  roadmap.edges.forEach((e) => m[e.target]?.push(e.source));
  return m;
}

/** done | known | available | locked  (known + done both satisfy prerequisites) */
export function nodeStates(roadmap, status) {
  const parents = parentsMap(roadmap);
  const out = {};
  for (const n of roadmap.nodes) {
    const s = status[n.id];
    if (s === 'done' || s === 'known') out[n.id] = s;
    else out[n.id] = parents[n.id].every((p) => status[p] === 'done' || status[p] === 'known') ? 'available' : 'locked';
  }
  return out;
}

/**
 * The dynamic re-routing: known skills are removed from the visible graph and their
 * parents are bridged straight to their children, so the path visibly shortens.
 */
export function visibleGraph(roadmap, status, showSkipped) {
  const known = new Set(roadmap.nodes.filter((n) => status[n.id] === 'known' && n.id !== 'goal').map((n) => n.id));
  if (showSkipped || known.size === 0) {
    return {
      nodes: roadmap.nodes,
      edges: roadmap.edges.map((e) => ({ ...e, skipped: known.has(e.source) || known.has(e.target) })),
    };
  }
  const parents = parentsMap(roadmap);
  const memo = {};
  const resolve = (id) => {
    if (memo[id]) return memo[id];
    const res = new Set();
    for (const p of parents[id] || []) {
      if (known.has(p)) resolve(p).forEach((x) => res.add(x));
      else res.add(p);
    }
    return (memo[id] = [...res]);
  };
  const nodes = roadmap.nodes.filter((n) => !known.has(n.id));
  const edges = [];
  for (const n of nodes) {
    for (const p of resolve(n.id)) edges.push({ id: `${p}-${n.id}`, source: p, target: n.id, bridged: true });
  }
  return { nodes, edges };
}

export const COL_W = 310;
export const ROW_H = 120;

export function layoutGraph(nodes, edges) {
  const phases = [...new Set(nodes.map((n) => n.phase))].sort((a, b) => a - b);
  const colOf = Object.fromEntries(phases.map((p, i) => [p, i]));
  const cols = phases.map(() => []);
  nodes.forEach((n) => cols[colOf[n.phase]].push(n));

  const parents = {};
  nodes.forEach((n) => (parents[n.id] = []));
  edges.forEach((e) => parents[e.target]?.push(e.source));

  const yIdx = {};
  cols.forEach((col, ci) => {
    if (ci > 0) {
      const bary = (n) => {
        const ps = parents[n.id].filter((p) => yIdx[p] !== undefined);
        return ps.length ? ps.reduce((a, p) => a + yIdx[p], 0) / ps.length : 0;
      };
      col.sort((a, b) => bary(a) - bary(b));
    }
    col.forEach((n, i) => (yIdx[n.id] = i - (col.length - 1) / 2));
  });

  const pos = {};
  nodes.forEach((n) => (pos[n.id] = { x: colOf[n.phase] * COL_W, y: yIdx[n.id] * ROW_H }));
  const minY = Math.min(...Object.values(pos).map((p) => p.y));
  const headers = phases.map((p) => ({ phase: p, x: colOf[p] * COL_W, y: minY - 110 }));
  return { pos, headers };
}

export function stats(roadmap, status) {
  let remaining = 0;
  let doneHours = 0;
  let doneCount = 0;
  let skippedHours = 0;
  let total = 0;
  for (const n of roadmap.nodes) {
    if (n.id === 'goal') continue;
    total++;
    const s = status[n.id];
    if (s === 'done') {
      doneHours += n.hours;
      doneCount++;
    } else if (s === 'known') skippedHours += n.hours;
    else remaining += n.hours;
  }
  const xp = doneCount * 20 + doneHours * 5 + (status.goal === 'done' ? 500 : 0);
  return { remaining, doneHours, doneCount, skippedHours, total, xp, level: Math.floor(xp / 150) + 1, levelPct: ((xp % 150) / 150) * 100 };
}

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'with', 'in', 'on', 'basics', 'intro', 'introduction', 'build', 'learn', 'using', 'your', 'first']);
const tokens = (s) => new Set(norm(s).split(' ').filter((t) => t && !STOP.has(t)));

/** Pair up nodes of two roadmaps that are (nearly) the same skill. */
export function findOverlap(a, b) {
  const pairs = [];
  const used = new Set();
  for (const na of a.nodes) {
    if (na.id === 'goal') continue;
    const ta = tokens(na.title);
    let best = null;
    let bestScore = 0;
    for (const nb of b.nodes) {
      if (nb.id === 'goal' || used.has(nb.id)) continue;
      const tb = tokens(nb.title);
      const inter = [...ta].filter((t) => tb.has(t)).length;
      const score = inter / Math.max(1, Math.min(ta.size, tb.size) + (Math.max(ta.size, tb.size) - Math.min(ta.size, tb.size)) * 0.4);
      if (score > bestScore) {
        bestScore = score;
        best = nb;
      }
    }
    if (best && bestScore >= 0.6) {
      used.add(best.id);
      pairs.push({ a: na, b: best });
    }
  }
  return pairs;
}
