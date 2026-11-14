import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData } from '../../../types/graph';
import { Server, ShieldAlert, Zap, Layers, RefreshCw } from 'lucide-react';

export const ServiceNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const node: NodeData = data;

  const getStatusStyles = () => {
    switch (node.state) {
      case 'FAILED':
        return 'border-red-500/80 bg-red-950/40 shadow-[0_0_20px_rgba(239,68,68,0.4)] text-red-200';
      case 'FAILING':
        return 'border-orange-500/80 bg-orange-950/40 shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-200';
      case 'DEGRADED':
        return 'border-amber-500/80 bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] text-amber-200';
      case 'CIRCUIT_OPEN':
        return 'border-purple-500/80 bg-purple-950/40 shadow-[0_0_15px_rgba(168,85,247,0.3)] text-purple-200';
      default:
        return 'border-slate-700/80 bg-[#121A2A] shadow-lg text-slate-200 hover:border-indigo-500/60';
    }
  };

  const getStatusBadge = () => {
    switch (node.state) {
      case 'FAILED':
        return <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/40 rounded">CRASHED</span>;
      case 'FAILING':
        return <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/40 rounded animate-pulse">FAILING</span>;
      case 'DEGRADED':
        return <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded">DEGRADED</span>;
      case 'CIRCUIT_OPEN':
        return <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded">CIRCUIT OPEN</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">HEALTHY</span>;
    }
  };

  return (
    <div
      className={`relative w-64 rounded-xl border-2 p-3 transition-all duration-300 backdrop-blur-md ${getStatusStyles()} ${
        selected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#0B0F19]' : ''
      }`}
    >
      {/* Input Target Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0B0F19] hover:!bg-indigo-400"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-100 tracking-tight leading-none mb-1">
              {node.name}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="uppercase font-mono text-[9px] bg-slate-800 px-1 py-0.5 rounded text-slate-300">
                {node.cloud_provider}
              </span>
              <span>{node.region}</span>
            </div>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-1.5 my-2 py-1.5 px-2 rounded-lg bg-[#0E1524]/80 border border-slate-800/80 text-[11px]">
        <div>
          <span className="text-[10px] text-slate-400 block">Latency (p99)</span>
          <span className={`font-mono font-medium ${node.metrics?.latency_p99_ms > 500 ? 'text-amber-400' : 'text-slate-200'}`}>
            {node.metrics?.latency_p99_ms ? Math.round(node.metrics.latency_p99_ms) : 0}ms
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Error Rate</span>
          <span className={`font-mono font-medium ${node.metrics?.error_rate > 0.05 ? 'text-red-400' : 'text-slate-200'}`}>
            {node.metrics?.error_rate ? (node.metrics.error_rate * 100).toFixed(1) : '0.0'}%
          </span>
        </div>
      </div>

      {/* Resilience Capabilities Pills */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1" title={`${node.replicas} instance replica(s)`}>
            <Layers className="w-3 h-3 text-slate-400" />
            <span className="font-mono">{node.replicas}x</span>
          </span>
          {node.has_circuit_breaker && (
            <span className="flex items-center gap-1 text-purple-400" title="Circuit Breaker Enabled">
              <Zap className="w-3 h-3" />
              <span>CB</span>
            </span>
          )}
          {node.has_fallback && (
            <span className="flex items-center gap-1 text-blue-400" title="Fallback Route Configured">
              <RefreshCw className="w-3 h-3" />
              <span>FB</span>
            </span>
          )}
        </div>
        <span className="font-mono text-slate-400 text-[10px]">
          Crit: {node.business_criticality}
        </span>
      </div>

      {/* Output Source Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0B0F19] hover:!bg-indigo-400"
      />
    </div>
  );
};
