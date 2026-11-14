import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData } from '../../../types/graph';
import { Cpu, Radio, ShieldAlert } from 'lucide-react';

export const QueueNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const node: NodeData = data;

  const getStatusStyles = () => {
    switch (node.state) {
      case 'FAILED':
        return 'border-red-500/80 bg-red-950/50 shadow-[0_0_20px_rgba(239,68,68,0.4)] text-red-200';
      case 'DEGRADED':
        return 'border-amber-500/80 bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] text-amber-200';
      default:
        return 'border-violet-700/60 bg-[#161226] shadow-lg text-slate-200 hover:border-violet-500/60';
    }
  };

  return (
    <div
      className={`relative w-64 rounded-xl border-2 p-3 transition-all duration-300 backdrop-blur-md ${getStatusStyles()} ${
        selected ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-[#0B0F19]' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0B0F19] hover:!bg-violet-400"
      />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-100 tracking-tight leading-none mb-1">
              {node.name}
            </h4>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="uppercase font-mono text-[9px] bg-slate-800 px-1 py-0.5 rounded text-violet-300">
                ASYNC BUS
              </span>
              <span>{node.region}</span>
            </div>
          </div>
        </div>
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded">
          {node.state}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 my-2 py-1.5 px-2 rounded-lg bg-[#0E0C1C]/80 border border-slate-800/80 text-[11px]">
        <div>
          <span className="text-[10px] text-slate-400 block">Queue Lag</span>
          <span className="font-mono font-medium text-slate-200">
            {node.metrics?.latency_p99_ms ? Math.round(node.metrics.latency_p99_ms) : 8}ms
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Partitions</span>
          <span className="font-mono font-medium text-slate-200">
            {node.replicas * 3} Partitions
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
        <span className="text-violet-300">Decoupled Buffer</span>
        <span className="font-mono text-violet-400 text-[10px]">
          Crit: {node.business_criticality}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0B0F19] hover:!bg-violet-400"
      />
    </div>
  );
};
