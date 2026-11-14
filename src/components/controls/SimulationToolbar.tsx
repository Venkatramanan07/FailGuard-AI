import React, { useEffect, useState } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Flame,
  Activity,
  Zap,
} from 'lucide-react';
import { FailureInjectorModal } from './FailureInjectorModal';

export const SimulationToolbar: React.FC = () => {
  const {
    simulationResult,
    simulationStep,
    setSimulationStep,
    isPlaying,
    togglePlay,
    resetSimulation,
    runBackendSimulation,
    isSimulating,
    addInjection,
    nodes,
  } = useTopologyStore();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const frames = simulationResult?.timeline_frames || [];
  const currentFrame = frames[simulationStep];
  const maxStep = Math.max(0, frames.length - 1);

  // Auto-play timeline timer
  useEffect(() => {
    let timer: any = null;
    if (isPlaying && frames.length > 0) {
      timer = setInterval(() => {
        if (simulationStep < maxStep) {
          setSimulationStep(simulationStep + 1);
        } else {
          togglePlay(); // stop at end
        }
      }, 1500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, simulationStep, maxStep, frames.length, setSimulationStep, togglePlay]);

  const handleQuickChaos = async (nodeKeyword: string, failureType: any) => {
    // Find node matching keyword (e.g. "db-postgres-primary" or "gateway" or "auth")
    const target = nodes.find(
      (n) => n.id.includes(nodeKeyword) || n.data.type.includes(nodeKeyword)
    );
    if (!target) return;

    addInjection({
      target_type: 'NODE',
      target_id: target.id,
      failure_type: failureType,
      parameters: { latency_added_ms: 3500 },
    });

    await runBackendSimulation(`Quick Chaos: ${target.data.name}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0F1626] border-b border-slate-800 text-xs">
        {/* Left: Quick Injection & Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white font-medium shadow-md shadow-red-600/20 transition"
          >
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>Inject Failure</span>
          </button>

          {/* Quick 1-Click Scenarios */}
          <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <span className="text-[11px] text-slate-400">Quick Chaos:</span>
            <button
              onClick={() => handleQuickChaos('postgres', 'NODE_CRASH')}
              disabled={isSimulating}
              className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700/60 transition"
            >
              ⚡ Crash Primary DB
            </button>
            <button
              onClick={() => handleQuickChaos('auth', 'LATENCY_SPIKE')}
              disabled={isSimulating}
              className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700/60 transition"
            >
              ⏱ Auth Latency (+3.5s)
            </button>
            <button
              onClick={() => handleQuickChaos('payment', 'RETRY_STORM')}
              disabled={isSimulating}
              className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700/60 transition"
            >
              🌪 Payment Retry Storm
            </button>
          </div>
        </div>

        {/* Center: Timeline Scrubber */}
        {frames.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-[#090D16] p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setSimulationStep(Math.max(0, simulationStep - 1))}
                disabled={simulationStep === 0}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-40"
                title="Step backward"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={togglePlay}
                className="p-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                title={isPlaying ? 'Pause' : 'Play timeline'}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
              </button>

              <button
                onClick={() => setSimulationStep(Math.min(maxStep, simulationStep + 1))}
                disabled={simulationStep >= maxStep}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-40"
                title="Step forward"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={resetSimulation}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title="Reset simulation to healthy"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center gap-1.5">
              {frames.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => setSimulationStep(idx)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                    idx === simulationStep
                      ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                      : idx < simulationStep
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  T+{f.timestamp_relative_ms}ms
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right: Cascade Status Description */}
        <div className="flex items-center gap-2 max-w-sm truncate text-right">
          {currentFrame ? (
            <span className="text-[11px] text-amber-300 font-mono truncate" title={currentFrame.event_description}>
              📢 {currentFrame.event_description}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">
              {isSimulating ? 'Computing NetworkX cascade...' : 'Ready for simulation'}
            </span>
          )}
        </div>
      </div>

      <FailureInjectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
