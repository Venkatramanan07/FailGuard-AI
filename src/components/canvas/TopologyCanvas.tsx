import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTopologyStore } from '../../store/topologyStore';
import { ServiceNode } from './CustomNodes/ServiceNode';
import { DatabaseNode } from './CustomNodes/DatabaseNode';
import { GatewayNode } from './CustomNodes/GatewayNode';
import { QueueNode } from './CustomNodes/QueueNode';
import { RegionZoneNode } from './CustomNodes/RegionZoneNode';
import { CustomEdge } from './CustomEdges/CustomEdge';

export const TopologyCanvas: React.FC = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    selectEdge,
  } = useTopologyStore();

  const nodeTypes = useMemo(
    () => ({
      service: ServiceNode,
      database: DatabaseNode,
      gateway: GatewayNode,
      queue: QueueNode,
      cache: RegionZoneNode,
      third_party: RegionZoneNode,
      region_zone: RegionZoneNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      custom: CustomEdge,
    }),
    []
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: any) => {
      selectEdge(edge.id);
    },
    [selectEdge]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  return (
    <div className="w-full h-full relative bg-[#090D16]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes as any}
        edgeTypes={edgeTypes as any}
        onNodesChange={onNodesChange as any}
        onEdgesChange={onEdgesChange as any}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2.0}
        defaultEdgeOptions={{ type: 'custom', animated: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="#1E293B"
        />
        <Controls className="!bg-[#111827] !border !border-slate-800 !rounded-xl !shadow-2xl [&>button]:!bg-[#111827] [&>button]:!border-slate-800 [&>button]:!text-slate-300 hover:[&>button]:!bg-[#1F293D]" />
        <MiniMap
          nodeColor={(n: any) => {
            const state = n.data?.state;
            if (state === 'FAILED') return '#EF4444';
            if (state === 'FAILING') return '#F97316';
            if (state === 'DEGRADED') return '#F59E0B';
            if (state === 'CIRCUIT_OPEN') return '#A855F7';
            return '#10B981';
          }}
          className="!bg-[#111827]/90 !border !border-slate-800 !rounded-xl !shadow-2xl"
          maskColor="rgba(11, 15, 25, 0.75)"
        />
      </ReactFlow>
    </div>
  );
};
