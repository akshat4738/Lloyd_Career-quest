import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { api } from './api.js';
import { stats, nodeStates, norm, PHASE_NAMES } from './graph.js';
import RoadmapView from './components/RoadmapView.jsx';
import Drawer from './components/Drawer.jsx';
import PathsModal from './components/PathsModal.jsx';
import CompareView from './components/CompareView.jsx';
import Confetti from './components/Confetti.jsx';

const LS = 'careerquest.v1';
const EXAMPLES = [
  'Full Stack Developer at a climate tech startup',
  'UI/UX Designer for fintech apps',
  'Machine Learning Engineer at a healthcare company',
  'DevOps Engineer at a game studio',
  'Data Analyst at a sports analytics team',
];
const LOAD_MSGS = [
  '🗺️ Scouting the terrain…',
  '🧙 Consulting the career wizards…',
  '⚔️ Forging your skill tree…',
  '🧭 Finding real stepping-stone roles…',
  '🏅 Picking certifications that actually matter…',
  '🛠️ Dreaming up portfolio projects…',
  '🔗 Wiring prerequisites together…',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const encodeShare = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
const decodeShare = (s) => JSON.parse(decodeURIComponent(escape(atob(s))));

export default function App() {
  const [view, setView] = useState('landing'); // landing | roadmap | compare
  const [roadmap, setRoadmap] = useState(null);
  const [status, setStatus] = useState({});
  const [details, setDetails] = useState({});
  const [detailBusy, setDetailBusy] = useState({});
  const [detailErr, setDetailErr] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  const [goalInput, setGoalInput] = useState('');
  const [cons, setCons] = useState({ hours: 10, months: 6, background: '', known: '' });

  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [burst, setBurst] = useState(null);
  const [toast, setToast] = useState('');

  const wrapRef = useRef(null);
  const rfRef = useRef(null);

  /* ----------------------------- boot / persistence ----------------------------- */
  useEffect(() => {
    api.health().then(setHealth);
    try {
      if (location.hash.startsWith('#r=')) {
        const shared = decodeShare(location.hash.slice(3));
        setRoadmap(shared.roadmap);
        setCons((c) => ({ ...c, ...(shared.cons || {}) }));
        setGoalInput(shared.roadmap.goal);
        setView('roadmap');
        history.replaceState(null, '', location.pathname);
        return;
      }
      const saved = JSON.parse(localStorage.getItem(LS) || 'null');
      if (saved?.roadmap) {
        setRoadmap(saved.roadmap);
        setStatus(saved.status || {});
        setDetails(saved.details || {});
        setCons((c) => ({ ...c, ...(saved.cons || {}) }));
        setGoalInput(saved.roadmap.goal);
        setView('roadmap');
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  useEffect(() => {
    if (roadmap) localStorage.setItem(LS, JSON.stringify({ roadmap, status, details, cons }));
  }, [roadmap, status, details, cons]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const a = setInterval(() => setLoadMsg((m) => (m + 1) % LOAD_MSGS.length), 2600);
    const b = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [loading]);

  /* -------------------------------- generation --------------------------------- */
  const generate = async (goal, { carry = false } = {}) => {
    if (!goal.trim()) return;
    setError('');
    setLoading(true);
    try {
      const prev = roadmap;
      const prevStatus = status;
      const knownTitles = [
        cons.known,
        ...(carry && prev ? prev.nodes.filter((n) => prevStatus[n.id] === 'known').map((n) => n.title) : []),
      ]
        .filter(Boolean)
        .join(', ');
      const r = await api.generate({ goal: goal.trim(), ...cons, known: knownTitles });

      // Carry progress over by matching titles when re-planning.
      const next = {};
      if (carry && prev) {
        const byTitle = new Map(prev.nodes.filter((n) => prevStatus[n.id]).map((n) => [norm(n.title), prevStatus[n.id]]));
        r.nodes.forEach((n) => {
          const s = byTitle.get(norm(n.title));
          if (s) next[n.id] = s;
        });
      }
      setRoadmap(r);
      setStatus(next);
      setDetails({});
      setSelectedId(null);
      setView('roadmap');
      setShowPlan(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------- node actions ------------------------------- */
  const knownList = useMemo(
    () => (roadmap ? roadmap.nodes.filter((n) => status[n.id] === 'known').map((n) => n.title) : []),
    [roadmap, status]
  );

  const loadDetail = useCallback(
    async (node, force = false) => {
      if (!roadmap || node.type === 'goal') return;
      if (!force && details[node.id]) return;
      setDetailBusy((b) => ({ ...b, [node.id]: true }));
      setDetailErr((e) => ({ ...e, [node.id]: '' }));
      try {
        const d = await api.nodeDetail({
          goal: roadmap.goal,
          node,
          background: cons.background,
          known: [cons.known, ...knownList].filter(Boolean).join(', '),
        });
        setDetails((s) => ({ ...s, [node.id]: d }));
      } catch (e) {
        setDetailErr((s) => ({ ...s, [node.id]: e.message }));
      } finally {
        setDetailBusy((b) => ({ ...b, [node.id]: false }));
      }
    },
    [roadmap, details, cons, knownList]
  );

  const selectNode = (id) => {
    setSelectedId(id);
    const node = roadmap?.nodes.find((n) => n.id === id);
    if (node && !details[id] && !detailBusy[id]) loadDetail(node);
  };

  const celebrate = (id, nextStatus) => {
    const node = roadmap.nodes.find((n) => n.id === id);
    const mk = (big) => setBurst({ id: Date.now(), big });
    if (id === 'goal') {
      mk(true);
      setToast('👑 DREAM JOB UNLOCKED! You completed the whole quest!');
      return;
    }
    const inPhase = roadmap.nodes.filter((n) => n.phase === node.phase && n.id !== 'goal');
    if (inPhase.every((n) => nextStatus[n.id] === 'done' || nextStatus[n.id] === 'known')) {
      mk(true);
      setToast(`🏆 Phase complete: ${PHASE_NAMES[node.phase]}! New area unlocked.`);
    } else {
      mk(false);
      setToast(`✅ +${20 + node.hours * 5} XP for “${node.title}”`);
    }
  };

  const setNodeStatus = (id, st) => {
    const node = roadmap.nodes.find((n) => n.id === id);
    const cur = status[id];
    const next = { ...status };
    if (cur === st) delete next[id];
    else next[id] = st;
    setStatus(next);
    if (st === 'done' && cur !== 'done') celebrate(id, next);
    if (st === 'known' && cur !== 'known') setToast(`⏭ Skipped “${node.title}” — path re-routed, ${node.hours}h saved`);
  };

  /* ----------------------------------- export/share ----------------------------- */
  const exportPng = async () => {
    if (!wrapRef.current) return;
    setToast('📸 Rendering image…');
    rfRef.current?.fitView({ padding: 0.1, duration: 0 });
    await sleep(300);
    try {
      const url = await toPng(wrapRef.current, {
        pixelRatio: 2,
        backgroundColor: '#0b0d2e',
        filter: (n) => !(n.classList && (n.classList.contains('react-flow__controls') || n.classList.contains('react-flow__minimap'))),
      });
      const a = document.createElement('a');
      a.download = `roadmap-${norm(roadmap.goal).replace(/ /g, '-').slice(0, 40)}.png`;
      a.href = url;
      a.click();
      setToast('📸 Roadmap image downloaded!');
    } catch (e) {
      setToast('Could not export image: ' + e.message);
    }
  };

  const shareLink = async () => {
    const url = `${location.origin}${location.pathname}#r=${encodeShare({ roadmap, cons: { hours: cons.hours, months: cons.months } })}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast('🔗 Share link copied! Anyone with it can open this roadmap.');
    } catch {
      window.prompt('Copy your share link:', url);
    }
  };

  /* ----------------------------------- derived ---------------------------------- */
  const st = useMemo(() => (roadmap ? stats(roadmap, status) : null), [roadmap, status]);
  const states = useMemo(() => (roadmap ? nodeStates(roadmap, status) : {}), [roadmap, status]);
  const selected = roadmap?.nodes.find((n) => n.id === selectedId) || null;
  const capacity = Math.round((Number(cons.hours) || 0) * 4.3 * (Number(cons.months) || 0));
  const over = st && capacity > 0 && st.remaining > capacity;

  const reset = () => {
    localStorage.removeItem(LS);
    setRoadmap(null);
    setStatus({});
    setDetails({});
    setSelectedId(null);
    setView('landing');
  };

  /* ------------------------------------ render ----------------------------------- */
  const healthMsg =
    health && health.server === false
      ? '⚠️ The CareerQuest server is not running. Use "npm run dev" (not just "vite").'
      : health && !health.ollama
      ? '⚠️ Ollama is not running. Open the Ollama app (or run "ollama serve") and refresh.'
      : health && !health.installed
      ? `⚠️ Model "${health.model}" is not installed. Run:  ollama pull ${health.model}`
      : '';

  return (
    <div className="app">
      <header className="top">
        <div className="logo" onClick={() => setView(roadmap ? 'roadmap' : 'landing')}>
          🗺️ <b>Career</b>Quest
        </div>
        {view === 'roadmap' && roadmap && <div className="goal-pill">🎯 {roadmap.goal}</div>}
        <div className="spacer" />
        {roadmap && view !== 'roadmap' && (
          <button className="btn ghost" onClick={() => setView('roadmap')}>
            My roadmap
          </button>
        )}
        {view !== 'compare' && (
          <button className="btn ghost" onClick={() => setView('compare')}>
            ⚔️ Compare roles
          </button>
        )}
        {roadmap && (
          <button className="btn ghost" onClick={reset}>
            ＋ New quest
          </button>
        )}
      </header>

      {healthMsg && <div className="banner">{healthMsg}</div>}

      {view === 'landing' && (
        <main className="landing">
          <div className="floaties">
            {['⚡', '🏅', '🛠️', '🚩', '👑', '🧭', '🚀'].map((e, i) => (
              <span key={i} style={{ left: `${8 + i * 13}%`, animationDelay: `${i * 0.7}s` }}>
                {e}
              </span>
            ))}
          </div>
          <h1>
            Reverse-engineer your <span className="grad">dream job</span>
          </h1>
          <p className="sub">Type a hyper-specific target. Your local AI turns it into an interactive skill tree you can zoom, pan, click and conquer.</p>

          <div className="card form">
            <label>🎯 Your dream job (be specific!)</label>
            <input
              autoFocus
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generate(goalInput)}
              placeholder="e.g. Full Stack Developer at a climate tech startup"
            />
            <div className="chips">
              {EXAMPLES.map((x) => (
                <button key={x} className="chip click" onClick={() => setGoalInput(x)}>
                  {x}
                </button>
              ))}
            </div>
            <div className="row">
              <div>
                <label>⏱ Hours / week</label>
                <input type="number" min="1" max="80" value={cons.hours} onChange={(e) => setCons({ ...cons, hours: e.target.value })} />
              </div>
              <div>
                <label>📅 Months</label>
                <input type="number" min="1" max="48" value={cons.months} onChange={(e) => setCons({ ...cons, months: e.target.value })} />
              </div>
            </div>
            <label>🎓 Your background (optional)</label>
            <input value={cons.background} onChange={(e) => setCons({ ...cons, background: e.target.value })} placeholder="e.g. 2nd-year CS student, know basic Python" />
            <label>✅ Skills you already know (optional, comma separated)</label>
            <input value={cons.known} onChange={(e) => setCons({ ...cons, known: e.target.value })} placeholder="e.g. HTML, CSS, Git" />
            <button className="btn primary big" disabled={loading || goalInput.trim().length < 3} onClick={() => generate(goalInput)}>
              ✨ Generate my roadmap
            </button>
            {error && <div className="err">{error}</div>}
          </div>
        </main>
      )}

      {view === 'compare' && <CompareView constraints={cons} onBack={() => setView(roadmap ? 'roadmap' : 'landing')} />}

      {view === 'roadmap' && roadmap && st && (
        <>
          <div className="hud">
            <div className="lvl">
              <div className="lvl-badge">LV {st.level}</div>
              <div className="xp">
                <div className="xp-fill" style={{ width: `${st.levelPct}%` }} />
              </div>
              <span className="xp-n">{st.xp} XP</span>
            </div>
            <div className="stat">
              ✅ {st.doneCount}/{st.total} steps
            </div>
            <div className={`stat ${over ? 'warn' : ''}`}>
              ⏳ {st.remaining}h left{capacity ? ` of ${capacity}h budget` : ''}
              {st.skippedHours > 0 && <em> · saved {st.skippedHours}h</em>}
            </div>
            <div className="spacer" />
            <label className="toggle">
              <input type="checkbox" checked={showSkipped} onChange={(e) => setShowSkipped(e.target.checked)} /> show skipped
            </label>
            <div className="plan-wrap">
              <button className={`btn ${over ? 'warnbtn' : 'ghost'}`} onClick={() => setShowPlan((s) => !s)}>
                🎚 Re-plan{over ? ' (over budget!)' : ''}
              </button>
              {showPlan && (
                <div className="popover">
                  <b>Fit the roadmap to your life</b>
                  <div className="row">
                    <div>
                      <label>Hours / week</label>
                      <input type="number" min="1" max="80" value={cons.hours} onChange={(e) => setCons({ ...cons, hours: e.target.value })} />
                    </div>
                    <div>
                      <label>Months</label>
                      <input type="number" min="1" max="48" value={cons.months} onChange={(e) => setCons({ ...cons, months: e.target.value })} />
                    </div>
                  </div>
                  <small className="muted">Budget ≈ {capacity}h. Your progress and known skills carry over.</small>
                  <button className="btn primary" disabled={loading} onClick={() => generate(roadmap.goal, { carry: true })}>
                    Re-plan with AI
                  </button>
                </div>
              )}
            </div>
            <button className="btn ghost" onClick={() => setShowPaths(true)}>
              🧭 Paths
            </button>
            <button className="btn ghost" onClick={exportPng}>
              📸 Image
            </button>
            <button className="btn ghost" onClick={shareLink}>
              🔗 Share
            </button>
          </div>

          {knownList.length > 0 && (
            <div className="known-bar">
              ⏭ Skipped:
              {roadmap.nodes
                .filter((n) => status[n.id] === 'known')
                .map((n) => (
                  <button key={n.id} className="chip click" title="Click to un-skip" onClick={() => setNodeStatus(n.id, 'known')}>
                    {n.title} ✕
                  </button>
                ))}
            </div>
          )}

          <div className="summary">{roadmap.summary}</div>

          <div className="stage">
            <RoadmapView
              roadmap={roadmap}
              status={status}
              selectedId={selectedId}
              onSelect={(id) => (id ? selectNode(id) : setSelectedId(null))}
              showSkipped={showSkipped}
              wrapRef={wrapRef}
              rfRef={rfRef}
            />
            <Drawer
              node={selected}
              state={selected ? states[selected.id] : ''}
              detail={selected ? details[selected.id] : null}
              loading={selected ? !!detailBusy[selected.id] : false}
              error={selected ? detailErr[selected.id] : ''}
              onClose={() => setSelectedId(null)}
              onDone={() => setNodeStatus(selected.id, 'done')}
              onKnown={() => setNodeStatus(selected.id, 'known')}
              onRegenerate={() => loadDetail(selected, true)}
            />
          </div>
        </>
      )}

      {showPaths && roadmap && <PathsModal goal={roadmap.goal} background={cons.background} onClose={() => setShowPaths(false)} />}

      {loading && (
        <div className="loading">
          <div className="loader-card">
            <div className="orb" />
            <h2>{LOAD_MSGS[loadMsg]}</h2>
            <p className="muted">Your local AI is building your roadmap. Small models on a laptop take roughly 30-120 seconds.</p>
            <div className="muted">⏱ {elapsed}s</div>
          </div>
        </div>
      )}

      <Confetti burst={burst} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
