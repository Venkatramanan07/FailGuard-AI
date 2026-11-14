import React from 'react';
import { useTopologyStore } from '../../store/topologyStore';
import {
  Network,
  Activity,
  ShieldAlert,
  Wrench,
  Server,
  Database,
  Globe,
  Radio,
  Zap,
  PlusCircle,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, nodes, onNodesChange } = useTopologyStore();

  const handleAddNode = (type: string, name: string) => {
    const id = `node-${type}-${Date.now().toString().slice(-4)}`;
    const newNode: any = {
      id,
      type: type === 'cache' ? 'cache' : type,
      position: { x: 250 + Math.random() * 200, y: 150 + Math.random() * 200 },
      data: {
        id,
        name,
        type,
        tier: type === 'database' || type === 'cache' ? 'data_store' : 'business_logic',
        cloud_provider: 'aws',
        region: 'us-east-1',
        zone: 'us-east-1a',
        replicas: 1,
        redundancy_type: 'none',
        has_circuit_breaker: false,
        has_fallback: false,
        timeout_ms: 2000,
        business_criticality: 5.0,
        state: 'HEALTHY',
        metrics: { error_rate: 0.0, latency_p99_ms: 25.0, current_load_pct: 20.0 },
      },
    };

    onNodesChange([{ type: 'add', item: newNode }]);
  };

  return (
    <aside className="w-16 md:w-56 bg-[#0E1422] border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      {/* Navigation Links */}
      <div className="p-2 space-y-1">
        <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase hidden md:block">
          Navigation
        </div>

        <button
          onClick={() => setActiveTab('architecture')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
            activeTab === 'architecture'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Architecture Canvas"
        >
          <Network className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">Architecture Canvas</span>
        </button>

        <button
          onClick={() => setActiveTab('analysis')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
            activeTab === 'analysis'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Impact Analysis"
        >
          <Activity className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">Impact Analysis</span>
        </button>

        <button
          onClick={() => setActiveTab('simulations')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
            activeTab === 'simulations'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="SPOF & Bottlenecks"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">SPOF & Bottlenecks</span>
        </button>

        <button
          onClick={() => setActiveTab('recommendations')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
            activeTab === 'recommendations'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Recovery Fixes"
        >
          <Wrench className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">Recovery Plan</span>
        </button>
      </div>

      {/* Component Palette (Add Node) */}
      <div className="p-2 border-t border-slate-800 hidden md:block">
        <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Component Palette
        </div>

        <div className="space-y-1">
          <button
            onClick={() => handleAddNode('service', 'New Microservice')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-[#151F32] hover:text-slate-100 transition border border-transparent hover:border-slate-800"
          >
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>Microservice</span>
            </div>
            <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => handleAddNode('database', 'New Database')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-[#151F32] hover:text-slate-100 transition border border-transparent hover:border-slate-800"
          >
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Database Instance</span>
            </div>
            <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => handleAddNode('cache', 'Redis Cache')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-[#151F32] hover:text-slate-100 transition border border-transparent hover:border-slate-800"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-pink-400" />
              <span>In-Memory Cache</span>
            </div>
            <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => handleAddNode('queue', 'Kafka Topic')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-[#151F32] hover:text-slate-100 transition border border-transparent hover:border-slate-800"
          >
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-violet-400" />
              <span>Message Broker</span>
            </div>
            <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => handleAddNode('gateway', 'Edge Ingress')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-[#151F32] hover:text-slate-100 transition border border-transparent hover:border-slate-800"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>API Gateway</span>
            </div>
            <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[10px] text-slate-400 hidden md:block">
        <p className="font-mono text-slate-400">Nodes on canvas: {nodes.length}</p>
        <p className="text-slate-400">Click node to inspect blast radius</p>
      </div>
    </aside>
  );
};
