import React from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import {
  ShieldAlert,
  Activity,
  Flame,
  CheckCircle,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';

export const OverviewCards: React.FC = () => {
  const {
    nodes,
    criticality,
    simulationResult,
    simulationStep,
  } = useTopologyStore();

  const totalServices = nodes.length;
  const healthyCount = nodes.filter((n) => n.data.state === 'HEALTHY').length;
  const degradedCount = nodes.filter(
    (n) => n.data.state === 'DEGRADED' || n.data.state === 'CIRCUIT_OPEN'
  ).length;
  const failedCount = nodes.filter(
    (n) => n.data.state === 'FAILED' || n.data.state === 'FAILING'
  ).length;

  const currentFrame = simulationResult?.timeline_frames?.[simulationStep];

  const resilienceScore = currentFrame
    ? (simulationResult?.resilience_score ?? 100)
    : (criticality?.baseline_resilience_score ?? 100);

  const blastRadius = currentFrame
    ? currentFrame.blast_radius_pct
    : (simulationResult?.blast_radius_pct ?? 0.0);

  const spofs = criticality?.spofs ?? [];
  const spofCount = spofs.length;
  const acuteSpofCount = spofs.filter((s) => s.severity === 'CRITICAL').length;
  const bridgesCount = criticality?.bridges?.length ?? 0;

  const revenueLossPerMin = simulationResult?.business_impact?.total_revenue_loss_per_minute ?? 0;
  const riskLevel = simulationResult?.business_impact?.business_risk_level;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-[#0B0F19]/90 border-b border-slate-800">
      {/* 1. Resilience Score Card */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#111827] border border-slate-800/80 shadow-md">
        <div
          className={`p-2.5 rounded-xl border ${
            resilienceScore > 75
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : resilienceScore > 50
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-400 block">
            Resilience Score
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-100">
              {resilienceScore.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">/ 100</span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            {currentFrame ? `Step ${simulationStep} active` : `Baseline ${criticality ? 'computed' : 'loading'}`}
          </span>
        </div>
      </div>

      {/* 2. Blast Radius & Business Loss Card */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#111827] border border-slate-800/80 shadow-md">
        <div
          className={`p-2.5 rounded-xl border ${
            blastRadius > 40
              ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'
              : blastRadius > 10
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
          }`}
        >
          <Flame className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-400 block">
            Simulated Blast Radius
          </span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-xl font-bold font-mono ${
                blastRadius > 30 ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {blastRadius.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-400">capacity</span>
          </div>
          <span className="text-[10px] font-mono text-amber-400/90 block truncate">
            {revenueLossPerMin > 0 ? (
              `-$${revenueLossPerMin.toLocaleString()}/min`
            ) : riskLevel ? (
              `Risk: ${riskLevel}`
            ) : (
              '0% quiescent'
            )}
          </span>
        </div>
      </div>

      {/* 3. SPOFs & Bridges Detected */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#111827] border border-slate-800/80 shadow-md">
        <div
          className={`p-2.5 rounded-xl border ${
            acuteSpofCount > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
        >
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-400 block">
            Single Points of Failure
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-100">
              {spofCount}
            </span>
            <span className="text-[10px] text-amber-400 font-medium">
              ({acuteSpofCount} critical)
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            {bridgesCount} cut bridge edges
          </span>
        </div>
      </div>

      {/* 4. Active Service Health Indicator */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#111827] border border-slate-800/80 shadow-md">
        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300">
          <CheckCircle className="w-5 h-5" />
        </div>
        <div className="w-full">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">
            Service Health ({totalServices} total)
          </span>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {healthyCount} OK
            </span>
            {degradedCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                {degradedCount} Degraded
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-red-400 font-semibold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                {failedCount} Down
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
            {failedCount === 0 && degradedCount === 0 ? 'All systems nominal' : `${failedCount + degradedCount} impacted`}
          </span>
        </div>
      </div>
    </div>
  );
};
