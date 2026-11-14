from typing import Any, Optional
from pydantic import BaseModel, Field

# -------------------------------------------------------------
# Architecture Validation Schemas
# -------------------------------------------------------------
class ValidationIssue(BaseModel):
    category: str = Field(..., description="E.g., CYCLE, ISOLATED_NODE, ORPHAN_EDGE, SPOF, UNPROTECTED_SYNC, CROSS_REGION")
    severity: str = Field(..., description="CRITICAL, WARNING, INFO")
    component_id: str
    message: str
    recommendation: str

class ArchitectureValidationResponse(BaseModel):
    is_valid: bool
    summary: str
    total_nodes: int
    total_edges: int
    critical_issues_count: int
    warning_issues_count: int
    issues: list[ValidationIssue]
    has_synchronous_cycles: bool
    cycles: list[list[str]]
    isolated_nodes: list[str]

# -------------------------------------------------------------
# Criticality Analysis Schemas
# -------------------------------------------------------------
class SPOFDetail(BaseModel):
    node_id: str
    node_name: str
    tier: str
    cloud_provider: str
    region: str
    business_criticality: float
    revenue_per_minute: float
    severity: str
    impact_reason: str

class BridgeDetail(BaseModel):
    edge_id: str
    source_id: str
    source_name: str
    target_id: str
    target_name: str
    protocol: str
    is_sync: bool
    impact_reason: str

class CentralityMetrics(BaseModel):
    node_id: str
    node_name: str
    tier: str
    betweenness_centrality: float
    pagerank_score: float
    in_degree: int
    out_degree: int
    is_spof: bool

class CriticalPath(BaseModel):
    path: list[str]
    path_names: list[str]
    total_baseline_latency_ms: float
    has_circuit_breakers: bool
    description: str

class CriticalityAnalysisResponse(BaseModel):
    topology_id: Optional[str] = None
    baseline_resilience_score: float
    spofs: list[SPOFDetail]
    bridges: list[BridgeDetail]
    bottlenecks: list[CentralityMetrics]
    critical_paths: list[CriticalPath]
    summary: str

# -------------------------------------------------------------
# Business Impact Schemas
# -------------------------------------------------------------
class ImpactedServiceRevenue(BaseModel):
    node_id: str
    node_name: str
    tier: str
    state: str
    base_revenue_rate_per_min: float
    estimated_revenue_loss_per_min: float
    sla_target: float
    projected_sla_breach: bool

class TierDegradation(BaseModel):
    tier: str
    total_nodes: int
    healthy_nodes: int
    degraded_nodes: int
    failed_nodes: int
    degradation_pct: float

class BusinessImpactResponse(BaseModel):
    total_revenue_loss_per_minute: float
    total_revenue_loss_per_hour: float
    blast_radius_pct: float
    total_services_impacted: int
    critical_services_failed: int
    high_revenue_services_down: list[str]
    tier_degradation: list[TierDegradation]
    sla_breach_probability_pct: float
    business_risk_level: str  # LOW, MEDIUM, HIGH, CATASTROPHIC

# -------------------------------------------------------------
# Recovery Priority Recommendations Schemas
# -------------------------------------------------------------
class RecoveryStep(BaseModel):
    step_order: int
    node_id: str
    node_name: str
    tier: str
    priority_score: float
    priority_level: str  # P0_IMMEDIATE, P1_HIGH, P2_MEDIUM, P3_NORMAL
    reason: str
    dependencies_to_wait_for: list[str]
    revenue_recovered_per_minute: float

class ArchitecturalMitigation(BaseModel):
    id: str
    title: str
    target_component: str
    pattern_type: str  # CIRCUIT_BREAKER, READ_REPLICA, CACHE_LAYER, ASYNC_BUFFER, RETRY_JITTER
    description: str
    effort: str  # LOW, MEDIUM, HIGH
    blast_radius_reduction_pct: float

class RecoveryPriorityResponse(BaseModel):
    topology_id: Optional[str] = None
    total_impacted_services: int
    topological_recovery_plan: list[RecoveryStep]
    architectural_mitigations: list[ArchitecturalMitigation]
    recovery_summary: str
