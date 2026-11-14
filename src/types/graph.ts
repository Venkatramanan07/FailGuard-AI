export type NodeHealthState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'FAILING'
  | 'FAILED'
  | 'CIRCUIT_OPEN'
  | 'ISOLATED';

export type NodeType =
  | 'service'
  | 'database'
  | 'cache'
  | 'queue'
  | 'gateway'
  | 'third_party'
  | 'region_zone';

export type CloudProvider = 'aws' | 'gcp' | 'azure' | 'hybrid' | 'on_prem';

export interface NodeMetrics {
  error_rate: number;
  latency_p99_ms: number;
  current_load_pct: number;
}

export interface RetryPolicy {
  max_retries: number;
  backoff: 'exponential' | 'fixed' | 'none';
}

export interface NodeData extends Record<string, unknown> {
  id: string;
  name: string;
  type: NodeType;
  tier: 'presentation' | 'business_logic' | 'data_store' | 'infrastructure';
  cloud_provider: CloudProvider;
  region: string;
  zone?: string;
  replicas: number;
  redundancy_type: 'none' | 'active_active' | 'active_passive' | 'multi_az';
  has_circuit_breaker: boolean;
  has_fallback: boolean;
  fallback_behavior?: 'serve_cache' | 'graceful_degrade' | 'fail_fast' | 'none';
  timeout_ms: number;
  retry_policy?: RetryPolicy;
  business_criticality: number;
  state: NodeHealthState;
  metrics: NodeMetrics;
  status_reason?: string;
}

export interface EdgeData extends Record<string, unknown> {
  id: string;
  source: string;
  target: string;
  protocol: 'http_rest' | 'grpc' | 'graphql' | 'sql' | 'amqp' | 'kafka' | 'tcp';
  is_sync: boolean;
  circuit_breaker: {
    enabled: boolean;
    failure_threshold_pct?: number;
    reset_timeout_seconds?: number;
  };
  health_threshold_ms: number;
  traffic_weight_pct: number;
  state: 'ACTIVE' | 'DEGRADED' | 'SEVERED' | 'CIRCUIT_OPEN';
  status_reason?: string;
}

export interface Topology {
  id: string;
  name: string;
  description: string;
  category: string;
  is_preset: number;
  tags: string[];
  nodes: any[];
  edges: any[];
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}
