import React from 'react';
import { useTopologyStore } from './store/topologyStore';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { InspectorDrawer } from './components/layout/InspectorDrawer';
import { OverviewCards } from './components/analytics/OverviewCards';
import { SimulationToolbar } from './components/controls/SimulationToolbar';
import { TopologyCanvas } from './components/canvas/TopologyCanvas';
import { ImpactAnalysisPanel } from './components/analytics/ImpactAnalysisPanel';
import { SpofPanel } from './components/analytics/SpofPanel';
import { RecommendationsPanel } from './components/analytics/RecommendationsPanel';
import { AlertCircle, X } from 'lucide-react';

export const App: React.FC = () => {
  const { activeTab, selectedNodeId, selectedEdgeId, errorMessage } = useTopologyStore();

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0F19] text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Header */}
      <Header />

      {/* Overview Metric Cards */}
      <OverviewCards />

      {/* Simulation Controls Toolbar */}
      <SimulationToolbar />

      {/* Error Toast if backend or simulation errors */}
      {errorMessage && (
        <div className="bg-red-950/90 border-b border-red-500/50 px-4 py-2 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Sidebar & Palette */}
        <Sidebar />

        {/* Center Tabbed Workspace */}
        <main className="flex-1 h-full relative overflow-hidden bg-[#090D16]">
          {activeTab === 'architecture' && <TopologyCanvas />}
          {activeTab === 'analysis' && <ImpactAnalysisPanel />}
          {activeTab === 'simulations' && <SpofPanel />}
          {activeTab === 'recommendations' && <RecommendationsPanel />}
        </main>

        {/* Right Inspector Drawer (renders when node/edge clicked) */}
        {(selectedNodeId || selectedEdgeId) && <InspectorDrawer />}
      </div>
    </div>
  );
};

export default App;
