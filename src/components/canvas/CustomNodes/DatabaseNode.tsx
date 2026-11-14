import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData } from '../../../types/graph';
import { Database, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const DatabaseNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const node: NodeData = data;
  const isSPOF = (node.replicas <= 1 && node.redundancy_type === 'none' && !node.has_fallback);

  const getStatusStyles = () => {
    switch (node.state) {
      case 'FAILED':
        return 'border-red-500/80 bg-red-950/50 shadow-[0_0_20px_rgba(239,68,68,0.4)] text-red-200';
      case 'FAILING':
        return 'border-orange-500/80 bg-orange-950/40 shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-200';
      case 'DEGRADED':
        return 'border-amber-500/80 bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] text-amber-200';
      default:
        return 'border-emerald-700/60 bg-[#0E1A22] shadow-lg text-slate-200 hover:border-emerald-500/60';
    }
  };

  return (
    <div
      className={`relative w-64 rounded-xl border-2 p-3 transition-all duration-300 backdrop-blur-md ${getStatusStyles()} ${
        selected ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0B0F19]' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0B0F19] hover:!bg-emerald-400"
      />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-100 tracking-tight leading-none mb-1">
              {node.name}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="uppercase font-mono text-[9px] bg-slate-800 px-1 py-0.5 rounded text-emerald-300">
                DB ({node.cloud_provider})
              </span>
              <span>{node.zone || node.region}</span>
            </div>
          </div>
        </div>

        {node.state === 'FAILED' ? (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/40 rounded">
            DOWN
          </span>
        ) : isSPOF ? (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded" title="Single Point of Failure: No read replicas">
            <AlertTriangle className="w-2.5 h-2.5" /> SPOF
          </span>
        ) : (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
            ONLINE
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 my-2 py-1.5 px-2 rounded-lg bg-[#0A131A]/80 border border-slate-800/80 text-[11px]">
        <div>
          <span className="text-[10px] text-slate-400 block">Query Latency</span>
          <span className="font-mono font-medium text-slate-200">
            {node.metrics?.latency_p99_ms ? Math.round(node.metrics.latency_p99_ms) : 5}ms
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Pool Load</span>
          <span className="font-mono font-medium text-slate-200">
            {node.metrics?.current_load_pct ? Math.round(node.metrics.current_load_pct) : 35}%
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
        <span className="font-mono text-[10px]">
          Redundancy: {node.redundancy_type.replace('_', ' ')}
        </span>
        <span className="font-mono text-emerald-400 text-[10px]">
          Crit: {node.business_criticality}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0B0F19] hover:!bg-emerald-400"
      />
    </div>
  );
};
