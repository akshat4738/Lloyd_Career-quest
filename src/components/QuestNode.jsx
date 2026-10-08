import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TYPE_EMOJI, PHASE_COLORS } from '../graph.js';

const LABEL = { done: 'Completed', known: 'Already known', available: 'Ready', locked: 'Locked' };

export const QuestNode = memo(function QuestNode({ data }) {
  const color = PHASE_COLORS[data.phase] || '#fff';
  return (
    <div
      className={`quest ${data.type} ${data.state} ${data.overlap ? 'overlap' : ''} ${data.selected ? 'sel' : ''}`}
      style={{ '--c': color }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="q-icon">{TYPE_EMOJI[data.type] || '⚡'}</div>
      <div className="q-body">
        <div className="q-title">{data.title}</div>
        <div className="q-meta">
          {data.type === 'goal' ? 'Final boss' : `${data.hours}h · ${data.type}`} · {LABEL[data.state]}
        </div>
      </div>
      {data.state === 'done' && <div className="q-badge ok">✓</div>}
      {data.state === 'locked' && <div className="q-badge lock">🔒</div>}
      {data.overlap && <div className="q-badge shared">🤝</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

export const PhaseHeader = memo(function PhaseHeader({ data }) {
  return (
    <div className="phase-hdr" style={{ '--c': PHASE_COLORS[data.phase] }}>
      <span>{data.label}</span>
      {data.total > 0 && (
        <em>
          {data.done}/{data.total}
        </em>
      )}
    </div>
  );
});
