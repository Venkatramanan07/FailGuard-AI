import React, { useState } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import {
  ShieldAlert,
  AlertTriangle,
  Cpu,
  Zap,
  GitCommit,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const SpofPanel: React.FC = () => {
  const {
    criticality,
    validation,
    runStaticAnalysis,
    isAnalyzing,
    selectNode,
    selectEdge,
  } = useTopologyStore();

  const [activeSubTab, setActiveSubTab] = useState<'spofs' | 'bridges' | 'bottlenecks' | 'validation'>('spofs');

  const spofs = criticality?.spofs || [];
  const bridges = criticality?.bridges || [];
  const bottlenecks = criticality?.bottlenecks || [];
  const validationIssues = validation?.issues || [];
  const cycles = validation?.cycles || [];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-[#090D16] text-slate-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            SPOFs, Bottlenecks & Architecture Validation
          </h2>
          <p className="text-xs text-slate-400">
            Detected via NetworkX articulation points, cut edges, betweenness centrality, and Johnson's cycle algorithm
          </p>
        </div>
        <div className="flex items-center gap-3">
          {validation && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-medium border flex items-center gap-1.5 ${
                validation.is_valid
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                  : 'bg-red-950/60 text-red-300 border-red-500/40'
              }`}
            >
              {validation.is_valid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Graph DAG Valid
                </>
              ) : (
                <>
                  <AlertOctagon className="w-3.5 h-3.5" />
                  {validation.critical_issues_count} Architectural Issues
                </>
              )}
            </span>
          )}

          <button
            onClick={() => runStaticAnalysis()}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition disabled:opacity-50 shadow-md shadow-indigo-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Analyzing Graph...' : 'Re-run NetworkX Engine'}</span>
          </button>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('spofs')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeSubTab === 'spofs'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Articulation Points ({spofs.length})
        </button>
        <button
          onClick={() => setActiveSubTab('bridges')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeSubTab === 'bridges'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Cut Bridge Edges ({bridges.length})
        </button>
        <button
          onClick={() => setActiveSubTab('bottlenecks')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeSubTab === 'bottlenecks'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Centrality Bottlenecks ({bottlenecks.length})
        </button>
        <button
          onClick={() => setActiveSubTab('validation')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeSubTab === 'validation'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Validation Issues ({validationIssues.length})
        </button>
      </div>

      {/* Tab 1: SPOFs */}
      {activeSubTab === 'spofs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Single Points of Failure ({spofs.length} nodes)
            </h3>
            <span className="text-xs text-slate-400">Click any component to inspect in canvas</span>
          </div>

          {spofs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#111827] border border-slate-800 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              No structural single points of failure detected in this topology!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {spofs.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => selectNode(s.node_id)}
                  className="p-4 rounded-xl bg-[#111827] border border-slate-800 hover:border-amber-500/60 cursor-pointer transition space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition">
                        {s.node_name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {s.node_id} &bull; {s.cloud_provider} &bull; {s.region}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        s.severity === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      }`}
                    >
                      {s.severity}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-mono text-[11px]">
                    {s.impact_reason}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                    <span className="capitalize">Tier: {s.tier.replace('_', ' ')}</span>
                    <span className="text-amber-400 font-mono font-medium">
                      Crit: {s.business_criticality} &bull; ${s.revenue_per_minute}/min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Cut Bridge Edges */}
      {activeSubTab === 'bridges' && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-indigo-400" />
            Graph Cut Edges ({bridges.length} bridges)
          </h3>
          <p className="text-xs text-slate-400">
            Severing any of these edges partitions the dependency graph into disconnected components.
          </p>

          {bridges.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#111827] border border-slate-800 text-center text-xs text-slate-400">
              No bridge cut edges found. Topology has redundant network routing paths.
            </div>
          ) : (
            <div className="space-y-2.5">
              {bridges.map((b, idx) => (
                <div
                  key={idx}
                  onClick={() => selectEdge(b.edge_id)}
                  className="p-4 rounded-xl bg-[#111827] border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-mono text-slate-200">
                      <span className="font-semibold text-indigo-300">{b.source_name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-semibold text-emerald-300">{b.target_name}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {b.protocol.toUpperCase()} {b.is_sync ? '(Sync)' : '(Async)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono text-[11px]">
                    {b.impact_reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Centrality Bottlenecks */}
      {activeSubTab === 'bottlenecks' && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Betweenness Centrality & PageRank Top Nodes
          </h3>
          <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
            {bottlenecks.map((b, idx) => (
              <div
                key={idx}
                onClick={() => selectNode(b.node_id)}
                className="flex items-center justify-between text-xs pb-3 border-b border-slate-800 last:border-0 last:pb-0 hover:bg-[#151F33] p-2 rounded-lg cursor-pointer transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{b.node_name}</span>
                    {b.is_spof && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        SPOF
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Inbound: {b.in_degree} callers &bull; Outbound: {b.out_degree} deps &bull; Tier: {b.tier}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Betweenness</span>
                    <span className="font-mono text-indigo-300 font-bold">
                      {b.betweenness_centrality.toFixed(4)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">PageRank</span>
                    <span className="font-mono text-emerald-300 font-bold">
                      {b.pagerank_score.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Validation Issues & Loops */}
      {activeSubTab === 'validation' && (
        <div className="space-y-4">
          {/* Synchronous Cycle Check */}
          <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              Synchronous Circular Dependency Deadlocks ({cycles.length})
            </h3>
            {cycles.length === 0 ? (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                No circular dependency deadlocks detected. Synchronous graph is a valid DAG.
              </p>
            ) : (
              <ul className="space-y-2">
                {cycles.map((c, idx) => (
                  <li
                    key={idx}
                    className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 font-mono text-xs"
                  >
                    <span className="font-semibold block text-red-200 mb-1">
                      ⚠️ Circular Deadlock Loop #{idx + 1}:
                    </span>
                    {c.join(' ➔ ')} ➔ {c[0]}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Validation Issues List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Architecture Lint Issues ({validationIssues.length})
            </h3>
            {validationIssues.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 text-center text-xs text-slate-400">
                All cloud architecture rules passed without warnings.
              </div>
            ) : (
              validationIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#111827] border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                      <AlertOctagon
                        className={`w-3.5 h-3.5 ${
                          issue.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'
                        }`}
                      />
                      {issue.category} &bull; Component: <code className="text-indigo-300">{issue.component_id}</code>
                    </span>
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-mono font-bold ${
                        issue.severity === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-snug">{issue.message}</p>
                  <p className="text-[11px] text-slate-400 font-mono bg-[#090D16] p-2 rounded border border-slate-800">
                    💡 <strong>Mitigation:</strong> {issue.recommendation}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
