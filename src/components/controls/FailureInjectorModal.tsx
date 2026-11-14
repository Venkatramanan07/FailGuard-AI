import React, { useState } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import { FailureType, FailureInjection } from '../../types/simulation';
import {
  Flame,
  X,
  AlertTriangle,
  Play,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const FailureInjectorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { nodes, addInjection, runBackendSimulation, isSimulating } = useTopologyStore();

  const [targetId, setTargetId] = useState<string>(nodes[0]?.id || '');
  const [failureType, setFailureType] = useState<FailureType>('NODE_CRASH');
  const [latencyAdded, setLatencyAdded] = useState<number>(3500);
  const [scenarioName, setScenarioName] = useState<string>('Chaos Injection Test');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;

    const injection: FailureInjection = {
      target_type: 'NODE',
      target_id: targetId,
      failure_type: failureType,
      parameters: {
        latency_added_ms: latencyAdded,
        duration_seconds: 60,
      },
    };

    addInjection(injection);
    onClose();
    await runBackendSimulation(scenarioName);
  };

  const selectedNode = nodes.find((n) => n.id === targetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0E1524]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Inject Failure Scenario
              </h3>
              <p className="text-xs text-slate-400">
                Run live discrete-time cascade simulation across NetworkX engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Scenario Name */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              Experiment / Scenario Name
            </label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#090D16] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. Primary DB Outage & Checkout Degradation"
              required
            />
          </div>

          {/* Target Component */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              Target Infrastructure Component
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#090D16] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [{n.data.type.toUpperCase()}] {n.data.name} ({n.data.cloud_provider} - {n.data.region})
                </option>
              ))}
            </select>
            {selectedNode && (
              <p className="mt-1 text-[11px] text-slate-400">
                Business Criticality: <span className="font-mono text-indigo-300">{selectedNode.data.business_criticality}</span> | Replicas: <span className="font-mono text-indigo-300">{selectedNode.data.replicas}</span>
              </p>
            )}
          </div>

          {/* Failure Type */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              Synthetic Failure Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'NODE_CRASH', label: 'Hard Crash (Node Down)', desc: '100% immediate packet drop & unreachability' },
                { type: 'LATENCY_SPIKE', label: 'Latency Degradation', desc: 'Simulate high thread wait & timeout cascades' },
                { type: 'CONNECTION_POOL_EXHAUSTION', label: 'Connection Pool Exhaustion', desc: 'Overwhelm socket descriptors & queues' },
                { type: 'RETRY_STORM', label: 'Cascading Retry Storm', desc: 'Simulate thundering herd without backoff' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => setFailureType(item.type as FailureType)}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    failureType === item.type
                      ? 'bg-indigo-600/10 border-indigo-500 text-indigo-200'
                      : 'bg-[#0E1524] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-xs font-semibold block text-slate-200 mb-0.5">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    {item.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Latency Input */}
          {failureType === 'LATENCY_SPIKE' && (
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Injected Latency: <span className="font-mono text-indigo-400">{latencyAdded}ms</span>
              </label>
              <input
                type="range"
                min="500"
                max="8000"
                step="250"
                value={latencyAdded}
                onChange={(e) => setLatencyAdded(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSimulating}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition shadow-lg shadow-red-600/30 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isSimulating ? 'Simulating Cascade...' : 'Inject & Run Simulation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
