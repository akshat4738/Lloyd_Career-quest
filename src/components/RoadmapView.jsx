import { useEffect, useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, Controls, MiniMap, Background, MarkerType, useReactFlow } from '@xyflow/react';
import { QuestNode, PhaseHeader } from './QuestNode.jsx';
import { visibleGraph, layoutGraph, nodeStates, PHASE_NAMES, PHASE_COLORS } from '../graph.js';

const nodeTypes = { quest: QuestNode, phase: PhaseHeader };

function Inner({ roadmap, status, selectedId, onSelect, showSkipped, overlapIds, plain, wrapRef, rfRef }) {
  const rf = useReactFlow();
  useEffect(() => {
    if (rfRef) rfRef.current = rf;
  }, [rf, rfRef]);

  const { nodes, edges, sig } = useMemo(() => {
    const vg = visibleGraph(roadmap, status, showSkipped);
    const { pos, headers } = layoutGraph(vg.nodes, vg.edges);
    const states = nodeStates(roadmap, status);

    const flowNodes = vg.nodes.map((n) => ({
      id: n.id,
      type: 'quest',
      position: pos[n.id],
      draggable: false,
      data: { ...n, state: plain ? 'available' : states[n.id], selected: selectedId === n.id, overlap: overlapIds?.has(n.id) },
    }));
    const hdrNodes = headers.map((h) => {
      const inPhase = roadmap.nodes.filter((n) => n.phase === h.phase && n.id !== 'goal');
      return {
        id: 'hdr' + h.phase,
        type: 'phase',
        position: { x: h.x, y: h.y },
        selectable: false,
        draggable: false,
        data: {
          phase: h.phase,
          label: PHASE_NAMES[h.phase],
          total: inPhase.length,
          done: inPhase.filter((n) => status[n.id] === 'done' || status[n.id] === 'known').length,
        },
      };
    });
    const flowEdges = vg.edges.map((e) => {
      const srcDone = status[e.source] === 'done' || status[e.source] === 'known';
      const color = e.skipped ? '#475569' : srcDone ? '#4ade80' : '#7c83b8';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: srcDone && status[e.target] !== 'done' && !e.skipped,
        style: { stroke: color, strokeWidth: srcDone ? 3 : 2, strokeDasharray: e.skipped ? '4 6' : undefined, opacity: e.skipped ? 0.5 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });
    return { nodes: [...hdrNodes, ...flowNodes], edges: flowEdges, sig: vg.nodes.map((n) => n.id).join(',') };
  }, [roadmap, status, selectedId, showSkipped, overlapIds, plain]);

  // Re-frame the camera whenever the visible set of nodes changes (re-routing).
  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.12, duration: 700 }), 80);
    return () => clearTimeout(t);
  }, [sig, rf]);

  return (
    <div className="flow-wrap" ref={wrapRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.15}
        maxZoom={1.8}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => n.type === 'quest' && onSelect?.(n.id)}
        onPaneClick={() => onSelect?.(null)}
      >
        <Background gap={28} size={1.6} color="#2a2f6b" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.type === 'phase' ? 'transparent' : PHASE_COLORS[n.data?.phase] || '#888')}
          maskColor="rgba(10,10,40,.7)"
        />
      </ReactFlow>
    </div>
  );
}

export default function RoadmapView(props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
