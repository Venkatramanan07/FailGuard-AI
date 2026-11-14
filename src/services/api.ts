import { Topology } from '../types/graph';
import {
  SimulationResult,
  QuickBlastResult,
  FailureInjection,
  ArchitectureValidationResponse,
  CriticalityAnalysisResponse,
  RecoveryPriorityResponse,
} from '../types/simulation';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, any>;
  constructor(message: string, status: number, code?: string, details?: Record<string, any>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.text();
    let msg = `API Error ${res.status}: ${res.statusText}`;
    let code: string | undefined;
    let details: Record<string, any> | undefined;

    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error) {
        msg = parsed.error.message || msg;
        code = parsed.error.code;
        details = parsed.error.details;
      } else if (parsed.detail) {
        msg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
      }
    } catch (_) {}
    throw new ApiError(msg, res.status, code, details);
  }
  return res.json() as Promise<T>;
}

export const apiService = {
  async checkHealth(): Promise<{ status: string; engine: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse(res);
  },

  async getPresets(): Promise<Topology[]> {
    const res = await fetch(`${API_BASE}/topologies/presets`);
    return handleResponse(res);
  },

  async getTopologies(): Promise<Topology[]> {
    const res = await fetch(`${API_BASE}/topologies`);
    return handleResponse(res);
  },

  async getTopology(id: string): Promise<Topology> {
    const res = await fetch(`${API_BASE}/topologies/${id}`);
    return handleResponse(res);
  },

  async createTopology(data: Partial<Topology>): Promise<Topology> {
    const res = await fetch(`${API_BASE}/topologies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async validateArchitecture(payload: {
    topology_id?: string;
    nodes?: any[];
    edges?: any[];
  }): Promise<ArchitectureValidationResponse> {
    const res = await fetch(`${API_BASE}/architecture/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async analyzeCriticality(payload: {
    topology_id?: string;
    nodes?: any[];
    edges?: any[];
  }): Promise<CriticalityAnalysisResponse> {
    const res = await fetch(`${API_BASE}/architecture/criticality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getRecoveryPriorities(payload: {
    topology_id?: string;
    nodes?: any[];
    edges?: any[];
    injections?: FailureInjection[];
  }): Promise<RecoveryPriorityResponse> {
    const res = await fetch(`${API_BASE}/architecture/recovery-priorities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async runSimulation(payload: {
    topology_id?: string;
    scenario_name: string;
    injections: FailureInjection[];
    nodes?: any[];
    edges?: any[];
    options?: {
      max_propagation_depth?: number;
      enable_circuit_breakers?: boolean;
      enable_retry_storms?: boolean;
    };
  }): Promise<SimulationResult> {
    const res = await fetch(`${API_BASE}/simulations/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async runQuickBlast(payload: {
    target_node_id: string;
    failure_type: string;
    nodes: any[];
    edges: any[];
  }): Promise<QuickBlastResult> {
    const res = await fetch(`${API_BASE}/simulations/quick-blast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },
};
