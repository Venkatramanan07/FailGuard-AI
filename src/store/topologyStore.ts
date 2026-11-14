import { create } from 'zustand';
import {
  Node,
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  addEdge,
} from '@xyflow/react';
import { Topology, NodeData, EdgeData } from '../types/graph';
import {
  SimulationResult,
  CriticalityAnalysisResponse,
  ArchitectureValidationResponse,
  RecoveryPriorityResponse,
  FailureInjection,
  TimelineFrame,
} from '../types/simulation';
import { apiService } from '../services/api';

interface TopologyState {
  currentTopology: Topology | null;
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  
  // Real Backend Analysis States
  criticality: CriticalityAnalysisResponse | null;
  validation: ArchitectureValidationResponse | null;
  recoveryPlan: RecoveryPriorityResponse | null;
  isAnalyzing: boolean;

  // Real Backend Simulation States
  injections: FailureInjection[];
  simulationResult: SimulationResult | null;
  isSimulating: boolean;
  simulationStep: number;
  isPlaying: boolean;
  playbackSpeedMs: number;

  // UI state
  activeTab: 'architecture' | 'simulations' | 'analysis' | 'recommendations';
  backendHealthy: boolean;
  errorMessage: string | null;

  // Actions
  setBackendHealthy: (healthy: boolean) => void;
  setActiveTab: (tab: 'architecture' | 'simulations' | 'analysis' | 'recommendations') => void;
  clearError: () => void;
  loadTopology: (topo: Topology) => void;
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onConnect: (connection: Connection) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  updateNodeData: (id: string, updates: Partial<NodeData>) => void;
  
  // Chaos Injections
  addInjection: (injection: FailureInjection) => void;
  removeInjection: (index: number) => void;
  clearInjections: () => void;
  
  // Real Backend Simulation & Analysis Execution
  runBackendSimulation: (scenarioName?: string) => Promise<void>;
  resetSimulation: () => void;
  setSimulationStep: (step: number) => void;
  togglePlay: () => void;
  runStaticAnalysis: () => Promise<void>;
}

export const useTopologyStore = create<TopologyState>((set, get) => ({
  currentTopology: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,

  criticality: null,
  validation: null,
  recoveryPlan: null,
  isAnalyzing: false,

  injections: [],
  simulationResult: null,
  isSimulating: false,
  simulationStep: 0,
  isPlaying: false,
  playbackSpeedMs: 1500,

  activeTab: 'architecture',
  backendHealthy: false,
  errorMessage: null,

  setBackendHealthy: (backendHealthy) => set({ backendHealthy }),
  setActiveTab: (activeTab) => set({ activeTab }),
  clearError: () => set({ errorMessage: null }),

  loadTopology: (topo: Topology) => {
    const rfNodes: Node<NodeData>[] = topo.nodes.map((n: any) => ({
      id: n.id,
      type: n.type || 'service',
      position: n.position || { x: 100, y: 100 },
      data: {
        id: n.id,
        name: n.name || n.id,
        type: n.type || 'service',
        tier: n.tier || 'business_logic',
        cloud_provider: n.cloud_provider || 'aws',
        region: n.region || 'us-east-1',
        zone: n.zone || 'us-east-1a',
        replicas: n.replicas ?? 1,
        redundancy_type: n.redundancy_type || 'none',
        has_circuit_breaker: Boolean(n.has_circuit_breaker),
        has_fallback: Boolean(n.has_fallback),
        fallback_behavior: n.fallback_behavior || 'none',
        timeout_ms: n.timeout_ms || 2000,
        retry_policy: n.retry_policy,
        business_criticality: n.business_criticality || 5.0,
        revenue_per_minute: n.revenue_per_minute || 0.0,
        sla_target: n.sla_target || 0.999,
        state: 'HEALTHY',
        metrics: n.metrics || { error_rate: 0.0, latency_p99_ms: 35.0, current_load_pct: 30.0 },
      },
    }));

    const rfEdges: Edge<EdgeData>[] = topo.edges.map((e: any) => ({
      id: e.id || `${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
      type: 'custom',
      animated: true,
      data: {
        id: e.id || `${e.source}->${e.target}`,
        source: e.source,
        target: e.target,
        protocol: e.protocol || 'http_rest',
        is_sync: e.is_sync ?? true,
        circuit_breaker: e.circuit_breaker || { enabled: false },
        health_threshold_ms: e.health_threshold_ms || 1000,
        traffic_weight_pct: e.traffic_weight_pct || 100,
        timeout_ms: e.timeout_ms || 2000,
        state: 'ACTIVE',
      },
    }));

    set({
      currentTopology: topo,
      nodes: rfNodes,
      edges: rfEdges,
      selectedNodeId: null,
      selectedEdgeId: null,
      simulationResult: null,
      simulationStep: 0,
      isPlaying: false,
      injections: [],
      criticality: null,
      validation: null,
      recoveryPlan: null,
      errorMessage: null,
    });

    // Automatically trigger comprehensive backend graph analysis on load
    get().runStaticAnalysis();
  },

  onNodesChange: (changes: any[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes as any) as any,
    });
  },

  onEdgesChange: (changes: any[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges as any) as any,
    });
  },

  onConnect: (connection: Connection) => {
    const newEdge: Edge<EdgeData> = {
      ...connection,
      id: `e-${connection.source}-${connection.target}`,
      type: 'custom',
      animated: true,
      data: {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        protocol: 'http_rest',
        is_sync: true,
        circuit_breaker: { enabled: false },
        health_threshold_ms: 1000,
        traffic_weight_pct: 100,
        timeout_ms: 2000,
        state: 'ACTIVE',
      },
    };
    set({
      edges: addEdge(newEdge as any, get().edges as any) as any,
    });
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  updateNodeData: (id, updates) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, ...updates },
          };
        }
        return node;
      }),
    });
  },

  addInjection: (injection) => {
    set((state) => ({
      injections: [...state.injections, injection],
    }));
  },

  removeInjection: (index) => {
    set((state) => ({
      injections: state.injections.filter((_, i) => i !== index),
    }));
  },

  clearInjections: () => set({ injections: [] }),

  runStaticAnalysis: async () => {
    const { currentTopology, nodes, edges } = get();
    set({ isAnalyzing: true, errorMessage: null });

    const backendNodes = nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      name: n.data.name,
      tier: n.data.tier,
      cloud_provider: n.data.cloud_provider,
      region: n.data.region,
      zone: n.data.zone,
      replicas: n.data.replicas,
      redundancy_type: n.data.redundancy_type,
      has_circuit_breaker: n.data.has_circuit_breaker,
      has_fallback: n.data.has_fallback,
      fallback_behavior: n.data.fallback_behavior,
      timeout_ms: n.data.timeout_ms,
      business_criticality: n.data.business_criticality,
      revenue_per_minute: n.data.revenue_per_minute,
      sla_target: n.data.sla_target,
      state: n.data.state,
      metrics: n.data.metrics,
      position: n.position,
    }));

    const backendEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      protocol: e.data?.protocol || 'http_rest',
      is_sync: e.data?.is_sync ?? true,
      circuit_breaker: e.data?.circuit_breaker || { enabled: false },
      health_threshold_ms: e.data?.health_threshold_ms || 1000,
      traffic_weight_pct: e.data?.traffic_weight_pct || 100,
      timeout_ms: e.data?.timeout_ms || 2000,
      state: e.data?.state || 'ACTIVE',
    }));

    try {
      const [critRes, valRes, recRes] = await Promise.all([
        apiService.analyzeCriticality({
          topology_id: currentTopology?.id,
          nodes: backendNodes.length > 0 ? backendNodes : undefined,
          edges: backendEdges.length > 0 ? backendEdges : undefined,
        }),
        apiService.validateArchitecture({
          topology_id: currentTopology?.id,
          nodes: backendNodes.length > 0 ? backendNodes : undefined,
          edges: backendEdges.length > 0 ? backendEdges : undefined,
        }),
        apiService.getRecoveryPriorities({
          topology_id: currentTopology?.id,
          nodes: backendNodes.length > 0 ? backendNodes : undefined,
          edges: backendEdges.length > 0 ? backendEdges : undefined,
        }),
      ]);

      set({
        criticality: critRes,
        validation: valRes,
        recoveryPlan: recRes,
        isAnalyzing: false,
      });
    } catch (err: any) {
      console.error('Static analysis failed:', err);
      set({ isAnalyzing: false, errorMessage: err.message });
    }
  },

  runBackendSimulation: async (scenarioName = 'Chaos Failure Experiment') => {
    const { currentTopology, nodes, edges, injections } = get();
    if (injections.length === 0) {
      set({ errorMessage: 'Please configure at least one failure injection before running.' });
      return;
    }

    set({ isSimulating: true, errorMessage: null });

    const backendNodes = nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      name: n.data.name,
      tier: n.data.tier,
      cloud_provider: n.data.cloud_provider,
      region: n.data.region,
      zone: n.data.zone,
      replicas: n.data.replicas,
      redundancy_type: n.data.redundancy_type,
      has_circuit_breaker: n.data.has_circuit_breaker,
      has_fallback: n.data.has_fallback,
      fallback_behavior: n.data.fallback_behavior,
      timeout_ms: n.data.timeout_ms,
      business_criticality: n.data.business_criticality,
      revenue_per_minute: n.data.revenue_per_minute,
      sla_target: n.data.sla_target,
      state: n.data.state,
      metrics: n.data.metrics,
      position: n.position,
    }));

    const backendEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      protocol: e.data?.protocol || 'http_rest',
      is_sync: e.data?.is_sync ?? true,
      circuit_breaker: e.data?.circuit_breaker || { enabled: false },
      health_threshold_ms: e.data?.health_threshold_ms || 1000,
      traffic_weight_pct: e.data?.traffic_weight_pct || 100,
      timeout_ms: e.data?.timeout_ms || 2000,
      state: e.data?.state || 'ACTIVE',
    }));

    try {
      // 1. Run discrete-time simulation on backend
      const result = await apiService.runSimulation({
        topology_id: currentTopology?.id,
        scenario_name: scenarioName,
        injections,
        nodes: backendNodes,
        edges: backendEdges,
      });

      // 2. Fetch specific recovery plan for this simulated cascade
      const recPlan = await apiService.getRecoveryPriorities({
        topology_id: currentTopology?.id,
        nodes: backendNodes,
        edges: backendEdges,
        injections,
      });

      // Update state with live calculated results
      set({
        simulationResult: result,
        recoveryPlan: recPlan,
        isSimulating: false,
        simulationStep: 0,
        isPlaying: false,
      });

      // Visually apply Step 0 frame to active canvas
      if (result.timeline_frames.length > 0) {
        get().setSimulationStep(0);
      }
    } catch (err: any) {
      console.error('Simulation execution failed:', err);
      set({
        isSimulating: false,
        errorMessage: `Simulation failed: ${err.message}`,
      });
    }
  },

  setSimulationStep: (stepIndex: number) => {
    const { simulationResult, nodes, edges } = get();
    if (!simulationResult || !simulationResult.timeline_frames[stepIndex]) return;

    const frame: TimelineFrame = simulationResult.timeline_frames[stepIndex];

    const updatedNodes = nodes.map((n) => {
      const stateUpdate = frame.node_states[n.id];
      if (stateUpdate) {
        return {
          ...n,
          data: {
            ...n.data,
            state: stateUpdate.state,
            status_reason: stateUpdate.status_reason,
            metrics: {
              ...n.data.metrics,
              error_rate: stateUpdate.error_rate,
              latency_p99_ms: stateUpdate.latency_ms,
            },
          },
        };
      }
      return n;
    });

    const updatedEdges = edges.map((e) => {
      const edgeUpdate = frame.edge_states[e.id];
      if (edgeUpdate) {
        return {
          ...e,
          data: {
            ...e.data!,
            state: edgeUpdate.state,
            status_reason: edgeUpdate.status_reason,
          },
        };
      }
      return e;
    });

    set({
      simulationStep: stepIndex,
      nodes: updatedNodes,
      edges: updatedEdges,
    });
  },

  resetSimulation: () => {
    const { currentTopology } = get();
    if (currentTopology) {
      get().loadTopology(currentTopology);
    }
  },

  togglePlay: () => {
    const { isPlaying } = get();
    set({ isPlaying: !isPlaying });
  },
}));
