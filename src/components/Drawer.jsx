import { TYPE_EMOJI, PHASE_NAMES } from '../graph.js';

export default function Drawer({ node, state, detail, loading, error, onClose, onDone, onKnown, onRegenerate }) {
  if (!node) return null;
  const isGoal = node.type === 'goal';
  return (
    <aside className="drawer">
      <button className="x" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="d-head">
        <div className="d-icon">{TYPE_EMOJI[node.type]}</div>
        <div>
          <h2>{node.title}</h2>
          <div className="d-tags">
            <span className="tag">{PHASE_NAMES[node.phase]}</span>
            <span className="tag">{node.type}</span>
            {!isGoal && <span className="tag">~{node.hours} hours</span>}
            <span className={`tag st-${state}`}>{state}</span>
          </div>
        </div>
      </div>
      <p className="d-desc">{node.description}</p>

      <div className="d-actions">
        <button className={`btn ${state === 'done' ? 'ghost' : 'primary'}`} onClick={onDone}>
          {state === 'done' ? '↩ Mark not done' : '✅ Mark as done'}
        </button>
        {!isGoal && (
          <button className="btn ghost" onClick={onKnown}>
            {state === 'known' ? '↩ I don’t know this' : '⏭ I already know this'}
          </button>
        )}
      </div>
      {state === 'locked' && <p className="hint">🔒 Finish (or skip) the connected steps before this one — but you can still peek at the plan below.</p>}

      {!isGoal && (
        <div className="d-ai">
          <div className="d-ai-head">
            <h3>✨ AI quest guide</h3>
            {detail && !loading && (
              <button className="link" onClick={onRegenerate}>
                🔄 Regenerate
              </button>
            )}
          </div>

          {loading && (
            <div className="skeleton">
              <div className="spin" /> Your local AI is writing a custom quest for this step… (can take ~30-60s on a laptop)
            </div>
          )}
          {error && !loading && (
            <div className="err">
              {error}
              <button className="link" onClick={onRegenerate}>
                Retry
              </button>
            </div>
          )}

          {detail && !loading && (
            <>
              <section>
                <h4>🛠️ Weekend project</h4>
                <b>{detail.weekendProject.title}</b>
                <p>{detail.weekendProject.description}</p>
                <ul>
                  {detail.weekendProject.deliverables?.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4>📦 GitHub repo idea</h4>
                <code className="repo">{detail.repoIdea.name}</code>
                <p>{detail.repoIdea.whatToBuild}</p>
                <div className="chips">
                  {detail.repoIdea.techStack?.map((t, i) => (
                    <span key={i} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              </section>
              <section>
                <h4>🎤 Interview questions</h4>
                <ol>
                  {detail.interviewQuestions?.map((q, i) => (
                    <li key={i}>
                      <b>{q.q}</b>
                      <small>Look for: {q.lookFor}</small>
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <h4>💡 Tips</h4>
                <ul>
                  {detail.tips?.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </section>
              <a className="link" target="_blank" rel="noreferrer" href={`https://www.google.com/search?q=${encodeURIComponent(node.title + ' tutorial')}`}>
                🔎 Search resources for this step
              </a>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
