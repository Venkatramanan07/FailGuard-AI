import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData } from '../../../types/graph';
import { Cloud, ExternalLink, Zap } from 'lucide-react';

export const RegionZoneNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const node: NodeData = data;
  const isCache = node.type === 'cache';
  const isExternal = node.type === 'third_party';

  const getStatusStyles = () => {
    switch (node.state) {
      case 'FAILED':
        return 'border-red-500/80 bg-red-950/50 shadow-[0_0_20px_rgba(239,68,68,0.4)] text-red-200';
      case 'DEGRADED':
        return 'border-amber-500/80 bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] text-amber-200';
      default:
        return isCache
          ? 'border-pink-700/60 bg-[#1D0F1B] shadow-lg text-slate-200 hover:border-pink-500/60'
          : 'border-blue-700/60 bg-[#0F172A] shadow-lg text-slate-200 hover:border-blue-500/60';
    }
  };

  return (
    <div
      className={`relative w-64 rounded-xl border-2 p-3 transition-all duration-300 backdrop-blur-md ${getStatusStyles()} ${
        selected ? 'ring-2 ring-pink-400 ring-offset-2 ring-offset-[#0B0F19]' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0B0F19] hover:!bg-pink-400"
      />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isCache ? 'bg-pink-500/10 border border-pink-500/20 text-pink-400' : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'}`}>
            {isExternal ? <ExternalLink className="w-4 h-4" /> : isCache ? <Zap className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-100 tracking-tight leading-none mb-1">
              {node.name}
            </h4>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="uppercase font-mono text-[9px] bg-slate-800 px-1 py-0.5 rounded text-pink-300">
                {isCache ? 'CACHE' : 'EXTERNAL'}
              </span>
              <span>{node.region}</span>
            </div>
          </div>
        </div>
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700 rounded">
          {node.state}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 my-2 py-1.5 px-2 rounded-lg bg-[#0C0B14]/80 border border-slate-800/80 text-[11px]">
        <div>
          <span className="text-[10px] text-slate-400 block">Latency</span>
          <span className="font-mono font-medium text-slate-200">
            {node.metrics?.latency_p99_ms ? Math.round(node.metrics.latency_p99_ms) : 5}ms
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Hit Rate</span>
          <span className="font-mono font-medium text-slate-200">
            {isCache ? '96.4%' : 'N/A'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
        <span className="font-mono text-[10px] text-pink-300">
          {isCache ? 'In-Memory Key/Val' : '3rd Party SaaS'}
        </span>
        <span className="font-mono text-slate-400 text-[10px]">
          Crit: {node.business_criticality}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0B0F19] hover:!bg-pink-400"
      />
    </div>
  );
};
