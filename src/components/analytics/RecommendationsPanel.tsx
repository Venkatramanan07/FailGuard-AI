import React, { useState } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import {
  Wrench,
  CheckCircle,
  Shield,
  ArrowRight,
  Lightbulb,
  Clock,
  Layers,
  Sparkles,
  Zap,
  TrendingUp,
} from 'lucide-react';

export const RecommendationsPanel: React.FC = () => {
  const {
    simulationResult,
    recoveryPlan,
    nodes,
    updateNodeData,
    runStaticAnalysis,
  } = useTopologyStore();

  const [appliedMitigations, setAppliedMitigations] = useState<Record<string, boolean>>({});

  const recoverySteps = recoveryPlan?.topological_recovery_plan || [];
  const mitigations = recoveryPlan?.architectural_mitigations || [];
  const simulationRecs = simulationResult?.recommendations || [];

  const handleApplyMitigation = async (mitigationId: string, targetComponent: string, patternType: string) => {
    const targetNode = nodes.find((n) => n.id === targetComponent || n.data.name === targetComponent);
    if (!targetNode) return;

    if (patternType.includes('REPLICA') || patternType.includes('DATABASE')) {
      updateNodeData(targetNode.id, {
        replicas: Math.max(2, targetNode.data.replicas + 1),
        redundancy_type: 'multi_az',
      });
    } else if (patternType.includes('CIRCUIT_BREAKER')) {
      updateNodeData(targetNode.id, {
        has_circuit_breaker: true,
        has_fallback: true,
      });
    } else if (patternType.includes('CACHE') || patternType.includes('FALLBACK')) {
      updateNodeData(targetNode.id, {
        has_fallback: true,
        fallback_behavior: 'serve_cache',
      });
    } else {
      // General resilience improvement
      updateNodeData(targetNode.id, {
        replicas: targetNode.data.replicas + 1,
        has_circuit_breaker: true,
      });
    }

    setAppliedMitigations((prev) => ({ ...prev, [mitigationId]: true }));

    // Re-run static analysis to calculate new improved score
    setTimeout(() => {
      runStaticAnalysis();
    }, 200);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-[#090D16] text-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-400" />
            Reverse-Topological Recovery Plan & Architectural Mitigations
          </h2>
          <p className="text-xs text-slate-400">
            Algorithmic sequencing calculated via reverse dependency resolution to prevent secondary thundering herd crash-loops
          </p>
        </div>
        {recoveryPlan && (
          <span className="text-xs font-mono text-slate-400 bg-[#111827] px-3 py-1.5 rounded-xl border border-slate-800">
            {recoveryPlan.total_impacted_services > 0
              ? `${recoveryPlan.total_impacted_services} services require ordered recovery`
              : 'Full baseline recovery ordering available'}
          </span>
        )}
      </div>

      {/* Section 1: Topological Recovery Sequence */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          Optimal Safe Recovery Sequence ({recoverySteps.length} stages)
        </h3>
        <p className="text-xs text-slate-400">
          Restore foundational storage and message brokers first. Restoring gateways before databases triggers connection pool exhaustion and retry storms.
        </p>

        {recoverySteps.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 text-center text-xs text-slate-400">
            Run a failure simulation to generate a targeted post-incident recovery runbook.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recoverySteps.map((step) => (
              <div
                key={step.step_order}
                className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300">
                      STAGE {step.step_order}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                        step.priority_level === 'P0_IMMEDIATE'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : step.priority_level === 'P1_HIGH'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {step.priority_level}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-100 mb-1">{step.node_name}</h4>
                  <span className="text-[10px] font-mono text-slate-400 block mb-2">
                    Tier: {step.tier.replace('_', ' ')}
                  </span>
                  <p className="text-[11px] text-slate-300 leading-snug">{step.reason}</p>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-1 text-[10px]">
                  {step.dependencies_to_wait_for.length > 0 ? (
                    <div className="text-amber-300 font-mono">
                      Must await: {step.dependencies_to_wait_for.join(', ')}
                    </div>
                  ) : (
                    <div className="text-emerald-400 font-mono">
                      Zero dependencies &mdash; safe for immediate cold start
                    </div>
                  )}
                  {step.revenue_recovered_per_minute > 0 && (
                    <div className="text-emerald-400 font-mono">
                      +${step.revenue_recovered_per_minute.toLocaleString()}/min recovered
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Algorithmic Architectural Mitigations */}
      <div className="space-y-3 pt-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Recommended Architectural Mitigations ({mitigations.length})
        </h3>
        <p className="text-xs text-slate-400">
          Click &ldquo;Apply Fix to Canvas&rdquo; to modify component configuration in real-time and observe resilience score gains.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mitigations.map((mitigation) => {
            const isApplied = appliedMitigations[mitigation.id];
            return (
              <div
                key={mitigation.id}
                className={`p-5 rounded-2xl border transition-all space-y-3 flex flex-col justify-between ${
                  isApplied
                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                    : 'bg-[#111827] border-slate-800 hover:border-indigo-500/50'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                      <Lightbulb className="w-4 h-4 shrink-0" />
                      {mitigation.pattern_type.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        Effort: {mitigation.effort}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        -{mitigation.blast_radius_reduction_pct}% Blast
                      </span>
                    </div>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-100">{mitigation.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono text-[11px]">
                    {mitigation.description}
                  </p>
                  <div className="text-[10px] text-slate-400">
                    Target: <code className="text-indigo-300 font-mono">{mitigation.target_component}</code>
                  </div>
                </div>

                <button
                  onClick={() =>
                    handleApplyMitigation(mitigation.id, mitigation.target_component, mitigation.pattern_type)
                  }
                  disabled={isApplied}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition self-start ${
                    isApplied
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{isApplied ? 'Fix Applied to Topology' : 'Apply Architectural Fix to Canvas'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Production Readiness Guardrails */}
      <div className="p-6 rounded-2xl bg-[#0D1424] border border-slate-800 space-y-4 mt-6">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Production Resilience Guardrails & Best Practices
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800/80 flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
            <div>
              <strong className="text-slate-100 block">Fast-Failing Circuit Breakers</strong>
              <span className="text-slate-400 text-[11px]">
                Enforce tight 1000-2000ms timeouts on downstream dependencies to avoid thread exhaustion cascades.
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800/80 flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
            <div>
              <strong className="text-slate-100 block">Multi-AZ Stateful Storage</strong>
              <span className="text-slate-400 text-[11px]">
                Ensure databases have hot-standby replicas across distinct cloud availability zones.
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800/80 flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
            <div>
              <strong className="text-slate-100 block">Queue-Based Event Decoupling</strong>
              <span className="text-slate-400 text-[11px]">
                Buffer high-throughput ingestion spikes in Kafka or SQS to isolate consumers from peak loads.
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800/80 flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
            <div>
              <strong className="text-slate-100 block">Stale-While-Revalidate Cache Fallbacks</strong>
              <span className="text-slate-400 text-[11px]">
                Return cached responses when upstream databases or search clusters enter degraded states.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
