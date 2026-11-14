import React, { useState } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import { apiService } from '../../services/api';
import { QuickBlastResult } from '../../types/simulation';
import {
  X,
  Server,
  Activity,
  Layers,
  Zap,
  RefreshCw,
  Flame,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const InspectorDrawer: React.FC = () => {
  const {
    selectedNodeId,
    selectedEdgeId,
    selectNode,
    selectEdge,
    nodes,
    edges,
    updateNodeData,
    addInjection,
    runBackendSimulation,
  } = useTopologyStore();

  const [quickBlast, setQuickBlast] = useState<QuickBlastResult | null>(null);
  const [loadingBlast, setLoadingBlast] = useState(false);

  const node = nodes.find((n) => n.id === selectedNodeId);
  const edge = edges.find((e) => e.id === selectedEdgeId);

  if (!node && !edge) return null;

  const handleQuickBlast = async () => {
    if (!node) return;
    setLoadingBlast(true);
    try {
      const backendNodes = nodes.map((n) => ({
        id: n.id,
        name: n.data.name,
        type: n.data.type,
        business_criticality: n.data.business_criticality,
        replicas: n.data.replicas,
        has_circuit_breaker: n.data.has_circuit_breaker,
      }));
      const backendEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        protocol: e.data?.protocol,
        is_sync: e.data?.is_sync,
      }));

      const res = await apiService.runQuickBlast({
        target_node_id: node.id,
        failure_type: 'NODE_CRASH',
        nodes: backendNodes,
        edges: backendEdges,
      });
      setQuickBlast(res);
    } catch (err) {
      console.error('Quick blast failed:', err);
    } finally {
      setLoadingBlast(false);
    }
  };

  const handleCrashNode = async () => {
    if (!node) return;
    addInjection({
      target_type: 'NODE',
      target_id: node.id,
      failure_type: 'NODE_CRASH',
    });
    await runBackendSimulation(`Crash ${node.data.name}`);
  };

  return (
    <aside className="w-80 md:w-96 bg-[#0E1524] border-l border-slate-800 flex flex-col justify-between shrink-0 h-full overflow-y-auto select-none p-4 space-y-4">
      {/* Node Inspector */}
      {node && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{node.data.name}</h3>
                <span className="text-[10px] text-slate-400 font-mono">{node.id}</span>
              </div>
            </div>
            <button
              onClick={() => {
                selectNode(null);
                setQuickBlast(null);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Health Status & Reason */}
          <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400">Current Health State</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                  node.data.state === 'FAILED'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : node.data.state === 'DEGRADED'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {node.data.state}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {node.data.status_reason || 'Service is running normally within operational SLO.'}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-[#090D16] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Latency (p99)</span>
              <span className="text-sm font-bold font-mono text-slate-100">
                {node.data.metrics?.latency_p99_ms ? Math.round(node.data.metrics.latency_p99_ms) : 35}ms
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#090D16] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Error Rate</span>
              <span className="text-sm font-bold font-mono text-slate-100">
                {node.data.metrics?.error_rate ? (node.data.metrics.error_rate * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
          </div>

          {/* Redundancy & Resilience Controls */}
          <div className="space-y-2 p-3 rounded-xl bg-[#090D16] border border-slate-800 text-xs">
            <span className="text-[11px] font-semibold text-slate-300 block mb-2">
              Resilience Architecture
            </span>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Replicas</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateNodeData(node.id, { replicas: Math.max(1, node.data.replicas - 1) })}
                  className="w-5 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-bold"
                >
                  -
                </button>
                <span className="font-mono text-slate-200">{node.data.replicas}</span>
                <button
                  onClick={() => updateNodeData(node.id, { replicas: node.data.replicas + 1 })}
                  className="w-5 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
              <span className="text-slate-400">Circuit Breaker</span>
              <input
                type="checkbox"
                checked={node.data.has_circuit_breaker}
                onChange={(e) => updateNodeData(node.id, { has_circuit_breaker: e.target.checked })}
                className="rounded accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
              <span className="text-slate-400">Fallback Strategy</span>
              <input
                type="checkbox"
                checked={node.data.has_fallback}
                onChange={(e) => updateNodeData(node.id, { has_fallback: e.target.checked })}
                className="rounded accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Blast Radius Analysis */}
          <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Blast Radius Predictor</span>
              <button
                onClick={handleQuickBlast}
                disabled={loadingBlast}
                className="px-2 py-1 rounded text-[10px] font-medium bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/50 transition disabled:opacity-50"
              >
                {loadingBlast ? 'Calculating...' : 'Compute Blast'}
              </button>
            </div>

            {quickBlast && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">System Impact:</span>
                  <span className="font-mono font-bold text-red-400">{quickBlast.blast_radius_pct}%</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  <span className="block font-medium text-slate-300">Callers Impacted:</span>
                  <span className="font-mono text-[10px] text-amber-300">
                    {quickBlast.direct_dependents.length > 0
                      ? quickBlast.direct_dependents.join(', ')
                      : 'None (Leaf Node)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <button
            onClick={handleCrashNode}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/20 transition"
          >
            <Flame className="w-4 h-4" />
            <span>Crash This Service Now</span>
          </button>
        </div>
      )}

      {/* Edge Inspector */}
      {edge && !node && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Dependency Link</h3>
              <span className="text-[10px] text-slate-400 font-mono">{edge.id}</span>
            </div>
            <button
              onClick={() => selectEdge(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-mono">{edge.source}</span>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-mono">{edge.target}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-slate-400">
              <span>Protocol:</span>
              <span className="font-mono text-slate-200">{edge.data?.protocol}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Type:</span>
              <span className="font-mono text-slate-200">{edge.data?.is_sync ? 'Synchronous RPC' : 'Async Event'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>State:</span>
              <span className="font-mono font-bold text-indigo-400">{edge.data?.state}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
