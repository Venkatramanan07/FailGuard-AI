import { NodeHealthState } from './graph';

export type FailureType =
  | 'NODE_CRASH'
  | 'LATENCY_SPIKE'
  | 'PACKET_LOSS'
  | 'REGION_OUTAGE'
  | 'RESOURCE_EXHAUSTION'
  | 'CONNECTION_POOL_EXHAUSTION'
  | 'RETRY_STORM';

export interface FailureInjection {
  target_type: 'NODE' | 'EDGE' | 'REGION' | 'ZONE';
  target_id: string;
  failure_type: FailureType;
  parameters?: Record<string, any>;
}

export interface TimelineFrame {
  step: number;
  timestamp_relative_ms: number;
  event_description: string;
  node_states: Record<string, {
    state: NodeHealthState;
    error_rate: number;
    latency_ms: number;
    status_reason?: string;
  }>;
  edge_states: Record<string, {
    state: 'ACTIVE' | 'DEGRADED' | 'SEVERED' | 'CIRCUIT_OPEN';
    status_reason?: string;
  }>;
  system_health_pct: number;
  blast_radius_pct: number;
}

export interface TierDegradation {
  tier: string;
  total_nodes: number;
  healthy_nodes: number;
  degraded_nodes: number;
  failed_nodes: number;
  degradation_pct: number;
}

export interface BusinessImpact {
  total_revenue_loss_per_minute: number;
  total_revenue_loss_per_hour: number;
  blast_radius_pct: number;
  total_services_impacted: number;
  critical_services_failed: number;
  high_revenue_services_down: string[];
  tier_degradation: TierDegradation[];
  sla_breach_probability_pct: number;
  business_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CATASTROPHIC';
}

export interface SimulationResult {
  simulation_id: string;
  topology_id?: string;
  scenario_name: string;
  resilience_score: number;
  blast_radius_pct: number;
  total_affected_nodes: number;
  timeline_frames: TimelineFrame[];
  recommendations: string[];
  critical_path_impact: string[];
  business_impact?: BusinessImpact;
  created_at?: string;
}

export interface QuickBlastResult {
  target_node_id: string;
  blast_radius_pct: number;
  direct_dependents: string[];
  downstream_impacted: string[];
  upstream_affected: string[];
  resilience_score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendations: string[];
}

export interface ValidationIssue {
  category: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  component_id: string;
  message: string;
  recommendation: string;
}

export interface ArchitectureValidationResponse {
  is_valid: boolean;
  summary: string;
  total_nodes: number;
  total_edges: number;
  critical_issues_count: number;
  warning_issues_count: number;
  issues: ValidationIssue[];
  has_synchronous_cycles: boolean;
  cycles: string[][];
  isolated_nodes: string[];
}

export interface SPOFDetail {
  node_id: string;
  node_name: string;
  tier: string;
  cloud_provider: string;
  region: string;
  business_criticality: number;
  revenue_per_minute: number;
  severity: 'CRITICAL' | 'MEDIUM';
  impact_reason: string;
}

export interface BridgeDetail {
  edge_id: string;
  source_id: string;
  source_name: string;
  target_id: string;
  target_name: string;
  protocol: string;
  is_sync: boolean;
  impact_reason: string;
}

export interface CentralityMetrics {
  node_id: string;
  node_name: string;
  tier: string;
  betweenness_centrality: number;
  pagerank_score: number;
  in_degree: number;
  out_degree: number;
  is_spof: boolean;
}

export interface CriticalPath {
  path: string[];
  path_names: string[];
  total_baseline_latency_ms: number;
  has_circuit_breakers: boolean;
  description: string;
}

export interface CriticalityAnalysisResponse {
  topology_id?: string;
  baseline_resilience_score: number;
  spofs: SPOFDetail[];
  bridges: BridgeDetail[];
  bottlenecks: CentralityMetrics[];
  critical_paths: CriticalPath[];
  summary: string;
}

export interface RecoveryStep {
  step_order: number;
  node_id: string;
  node_name: string;
  tier: string;
  priority_score: number;
  priority_level: 'P0_IMMEDIATE' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_NORMAL';
  reason: string;
  dependencies_to_wait_for: string[];
  revenue_recovered_per_minute: number;
}

export interface ArchitecturalMitigation {
  id: string;
  title: string;
  target_component: string;
  pattern_type: string;
  description: string;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  blast_radius_reduction_pct: number;
}

export interface RecoveryPriorityResponse {
  topology_id?: string;
  total_impacted_services: number;
  topological_recovery_plan: RecoveryStep[];
  architectural_mitigations: ArchitecturalMitigation[];
  recovery_summary: string;
}
