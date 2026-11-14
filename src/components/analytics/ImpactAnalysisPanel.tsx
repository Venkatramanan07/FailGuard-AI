import React from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import {
  Activity,
  Flame,
  ShieldAlert,
  DollarSign,
  AlertOctagon,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const ImpactAnalysisPanel: React.FC = () => {
  const { simulationResult, criticality, setSimulationStep, simulationStep } = useTopologyStore();

  const frames = simulationResult?.timeline_frames || [];
  const criticalPaths = simulationResult?.critical_path_impact || [];
  const businessImpact = simulationResult?.business_impact;
  const spofs = criticality?.spofs || [];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-[#090D16] text-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Cascading Failure Impact & Financial Analysis
          </h2>
          <p className="text-xs text-slate-400">
            Real discrete-event cascade propagation and business impact computed by NetworkX graph engine
          </p>
        </div>
        {simulationResult && (
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300">
              Blast: <strong>{simulationResult.blast_radius_pct}%</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
              Score: <strong>{simulationResult.resilience_score}</strong>/100
            </span>
            {businessImpact && (
              <span
                className={`px-2.5 py-1 rounded-lg font-bold border ${
                  businessImpact.business_risk_level === 'CATASTROPHIC'
                    ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                    : businessImpact.business_risk_level === 'HIGH'
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                    : businessImpact.business_risk_level === 'MEDIUM'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                }`}
              >
                RISK: {businessImpact.business_risk_level}
              </span>
            )}
          </div>
        )}
      </div>

      {!simulationResult ? (
        <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl p-8 bg-[#0D1322]">
          <Flame className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300 mb-1">
            No Failure Simulation Executed Yet
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Click &ldquo;Inject Failure&rdquo; or run a quick chaos scenario from the toolbar above to simulate an actual cascade across your cloud topology.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Business Impact Metric Strip */}
          {businessImpact && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-red-400" />
                  Revenue Loss Rate
                </span>
                <div className="text-xl font-bold font-mono text-red-400">
                  ${businessImpact.total_revenue_loss_per_minute.toLocaleString()}/min
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  ${businessImpact.total_revenue_loss_per_hour.toLocaleString()}/hour estimated
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                  SLA Breach Probability
                </span>
                <div className="text-xl font-bold font-mono text-amber-300">
                  {businessImpact.sla_breach_probability_pct}%
                </div>
                <span className="text-[10px] text-slate-400">
                  {businessImpact.critical_services_failed} critical services down
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-indigo-400" />
                  Total Services Impacted
                </span>
                <div className="text-xl font-bold font-mono text-slate-100">
                  {businessImpact.total_services_impacted} services
                </div>
                <span className="text-[10px] text-slate-400">
                  across all application tiers
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-pink-400" />
                  High Revenue Nodes Down
                </span>
                <div className="text-sm font-bold font-mono text-pink-300 truncate">
                  {businessImpact.high_revenue_services_down.length > 0
                    ? businessImpact.high_revenue_services_down.join(', ')
                    : 'None'}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {businessImpact.high_revenue_services_down.length} direct revenue earners
                </span>
              </div>
            </div>
          )}

          {/* Tier Degradation Cards */}
          {businessImpact?.tier_degradation && businessImpact.tier_degradation.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Architecture Tier Degradation Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {businessImpact.tier_degradation.map((tier, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="capitalize text-slate-200">{tier.tier.replace('_', ' ')}</span>
                      <span
                        className={`font-mono ${
                          tier.degradation_pct > 50
                            ? 'text-red-400'
                            : tier.degradation_pct > 0
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {tier.degradation_pct.toFixed(0)}% degraded
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          tier.degradation_pct > 50
                            ? 'bg-red-500'
                            : tier.degradation_pct > 0
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, tier.degradation_pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{tier.healthy_nodes}/{tier.total_nodes} Healthy</span>
                      {tier.failed_nodes > 0 && <span className="text-red-400">{tier.failed_nodes} Failed</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Step-by-Step Cascade Timeline */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Step-by-Step Cascade Timeline ({frames.length} discrete frames)
              </h3>
              <div className="space-y-3">
                {frames.map((frame, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSimulationStep(idx)}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      idx === simulationStep
                        ? 'bg-[#151F33] border-indigo-500 shadow-lg shadow-indigo-500/10'
                        : 'bg-[#111827] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          idx === simulationStep
                            ? 'bg-indigo-600 text-white'
                            : 'bg-indigo-500/20 text-indigo-300'
                        }`}
                      >
                        STEP {frame.step} &bull; T+{frame.timestamp_relative_ms}ms
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400">
                          Health: <strong className="text-emerald-400">{frame.system_health_pct.toFixed(0)}%</strong>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Blast: <strong className="text-red-400">{frame.blast_radius_pct.toFixed(1)}%</strong>
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-mono">
                      {frame.event_description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Critical Paths & Broken Dependencies */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Compromised Ingress-to-DB Paths
              </h3>
              <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
                {criticalPaths.length > 0 ? (
                  <ul className="space-y-2 text-xs">
                    {criticalPaths.map((cp, idx) => (
                      <li
                        key={idx}
                        className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 font-mono text-[11px] flex items-start gap-2"
                      >
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span>{cp}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>No unmitigated critical paths broke. Circuit breakers or replicas isolated the damage.</span>
                  </div>
                )}
              </div>

              {/* Architecture SPOFs */}
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2">
                Active Graph Articulation Points
              </h3>
              <div className="space-y-2">
                {spofs.slice(0, 5).map((s, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-[#111827] border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{s.node_name}</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          s.severity === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {s.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{s.impact_reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
