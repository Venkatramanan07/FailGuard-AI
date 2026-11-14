import React, { useEffect, useState } from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import { apiService } from '../../services/api';
import { Topology } from '../../types/graph';
import {
  Shield,
  Layers,
  Activity,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentTopology,
    loadTopology,
    runStaticAnalysis,
    isAnalyzing,
    backendHealthy,
    setBackendHealthy,
  } = useTopologyStore();

  const [presets, setPresets] = useState<Topology[]>([]);

  useEffect(() => {
    // Check backend health and fetch presets
    const init = async () => {
      try {
        const health = await apiService.checkHealth();
        if (health.status === 'healthy') {
          setBackendHealthy(true);
        }
        const data = await apiService.getPresets();
        setPresets(data);
        if (data.length > 0 && !currentTopology) {
          loadTopology(data[0]); // Load first preset by default
        }
      } catch (err) {
        console.warn('Backend connecting...', err);
        setBackendHealthy(false);
      }
    };
    init();
    const interval = setInterval(init, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleExportJson = () => {
    if (!currentTopology) return;
    const blob = new Blob([JSON.stringify(currentTopology, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failguard-${currentTopology.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="h-14 px-4 bg-[#0B0F19] border-b border-slate-800 flex items-center justify-between select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">
              FailGuard <span className="text-indigo-400">AI</span>
            </h1>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              v1.0-alpha
            </span>
          </div>
          <p className="text-[10px] text-slate-400 hidden sm:block">
            Cloud-Agnostic Infrastructure Failure Simulation & Blast Radius Engine
          </p>
        </div>
      </div>

      {/* Preset Architecture Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-[#111827] px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400 text-[11px] hidden md:inline">Architecture:</span>
          <select
            value={currentTopology?.id || ''}
            onChange={(e) => {
              const selected = presets.find((p) => p.id === e.target.value);
              if (selected) loadTopology(selected);
            }}
            className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer text-xs"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#111827] text-slate-200">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Static Analysis Trigger */}
        <button
          onClick={() => runStaticAnalysis()}
          disabled={isAnalyzing}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs transition"
          title="Run NetworkX graph algorithms to detect SPOFs and cycles"
        >
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isAnalyzing ? 'Analyzing Graph...' : 'Analyze SPOFs'}</span>
        </button>

        {/* Export JSON */}
        <button
          onClick={handleExportJson}
          className="p-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          title="Export topology JSON"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Live Backend Connection Indicator */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono border"
          style={{
            backgroundColor: backendHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: backendHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            color: backendHealthy ? '#34D399' : '#F87171',
          }}
          title={backendHealthy ? 'FastAPI & NetworkX engine connected' : 'Connecting to FastAPI backend...'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              backendHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
            }`}
          />
          <span className="hidden sm:inline">
            {backendHealthy ? 'ENGINE: LIVE' : 'CONNECTING'}
          </span>
        </div>
      </div>
    </header>
  );
};
