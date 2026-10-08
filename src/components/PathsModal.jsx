import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function PathsModal({ goal, background, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .paths({ goal, background })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [goal, background]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>
          ✕
        </button>
        <h2>🧭 People who took this path</h2>
        <p className="muted">AI-synthesised typical routes to “{goal}” — patterns, not real named people.</p>
        {!data && !error && (
          <div className="skeleton">
            <div className="spin" /> Researching typical journeys…
          </div>
        )}
        {error && <div className="err">{error}</div>}
        {data?.paths.map((p, i) => (
          <div className="path" key={i}>
            <h3>
              {['🚀', '🎓', '🔁'][i % 3]} {p.persona}
            </h3>
            <small className="muted">Starts: {p.startingPoint}</small>
            <div className="timeline">
              {p.steps.map((s, j) => (
                <div className="tl-step" key={j}>
                  <div className="tl-dot" />
                  <div>
                    <b>{s.role}</b> <span className="tag">{s.when}</span>
                    <div className="muted">🛠️ Side project: {s.sideProject}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
