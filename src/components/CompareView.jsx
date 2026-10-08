import { useMemo, useState } from 'react';
import { api } from '../api.js';
import RoadmapView from './RoadmapView.jsx';
import { findOverlap } from '../graph.js';

const EMPTY = {};

export default function CompareView({ constraints, onBack }) {
  const [goalA, setGoalA] = useState('Frontend Developer at a fintech startup');
  const [goalB, setGoalB] = useState('UI/UX Designer for fintech apps');
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    setA(null);
    setB(null);
    try {
      setBusy('Generating role 1 of 2…');
      const ra = await api.generate({ goal: goalA, ...constraints });
      setA(ra);
      setBusy('Generating role 2 of 2…');
      const rb = await api.generate({ goal: goalB, ...constraints });
      setB(rb);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const pairs = useMemo(() => (a && b ? findOverlap(a, b) : []), [a, b]);
  const idsA = useMemo(() => new Set(pairs.map((p) => p.a.id)), [pairs]);
  const idsB = useMemo(() => new Set(pairs.map((p) => p.b.id)), [pairs]);
  const pct = a && b ? Math.round((pairs.length / Math.max(1, Math.min(a.nodes.length, b.nodes.length) - 1)) * 100) : 0;

  return (
    <div className="compare">
      <div className="cmp-bar">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <input value={goalA} onChange={(e) => setGoalA(e.target.value)} placeholder="Dream role #1" />
        <span className="vs">VS</span>
        <input value={goalB} onChange={(e) => setGoalB(e.target.value)} placeholder="Dream role #2" />
        <button className="btn primary" onClick={run} disabled={!!busy}>
          {busy || '⚔️ Compare paths'}
        </button>
      </div>
      {error && <div className="err" style={{ margin: 12 }}>{error}</div>}
      {busy && (
        <div className="skeleton" style={{ margin: 12 }}>
          <div className="spin" /> {busy} (about a minute each on a laptop)
        </div>
      )}
      {a && b && (
        <div className="cmp-summary">
          <b>🤝 {pairs.length} shared stepping stones</b> · ~{pct}% overlap. Gold-glowing nodes appear on both paths:
          {pairs.map((p) => (
            <span className="chip gold" key={p.a.id}>
              {p.a.title}
            </span>
          ))}
          {!pairs.length && <span className="muted"> none found — these are very different journeys!</span>}
        </div>
      )}
      <div className="cmp-grid">
        <div className="cmp-pane">
          {a ? (
            <>
              <h3>{a.goal}</h3>
              <RoadmapView roadmap={a} status={EMPTY} overlapIds={idsA} plain />
            </>
          ) : (
            <div className="empty">Role 1 appears here</div>
          )}
        </div>
        <div className="cmp-pane">
          {b ? (
            <>
              <h3>{b.goal}</h3>
              <RoadmapView roadmap={b} status={EMPTY} overlapIds={idsB} plain />
            </>
          ) : (
            <div className="empty">Role 2 appears here</div>
          )}
        </div>
      </div>
    </div>
  );
}
