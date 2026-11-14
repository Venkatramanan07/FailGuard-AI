from typing import Optional, Any
from pydantic import BaseModel, Field

class FailureInjection(BaseModel):
    target_type: str = Field(default="NODE", pattern="^(NODE|EDGE|REGION|ZONE)$")
    target_id: str = Field(..., min_length=1, max_length=120)
    failure_type: str = Field(
        default="NODE_CRASH",
        pattern="^(NODE_CRASH|LATENCY_SPIKE|PACKET_LOSS|REGION_OUTAGE|RESOURCE_EXHAUSTION|CONNECTION_POOL_EXHAUSTION|RETRY_STORM)$"
    )
    parameters: dict[str, Any] = Field(default_factory=dict)

class SimulationOptions(BaseModel):
    max_propagation_depth: int = Field(default=5, ge=1, le=20)
    enable_circuit_breakers: bool = True
    enable_retry_storms: bool = True

class SimulationRunRequest(BaseModel):
    topology_id: Optional[str] = Field(default=None, max_length=100)
    scenario_name: str = Field(default="Custom Failure Simulation", max_length=200)
    injections: list[FailureInjection] = Field(..., min_length=1, max_length=20, description="1 to 20 failure injections")
    options: SimulationOptions = Field(default_factory=SimulationOptions)
    nodes: Optional[list[dict[str, Any]]] = Field(default=None, max_length=300)
    edges: Optional[list[dict[str, Any]]] = Field(default=None, max_length=1000)

class TimelineFrame(BaseModel):
    step: int
    timestamp_relative_ms: int
    event_description: str
    node_states: dict[str, dict[str, Any]]
    edge_states: dict[str, dict[str, Any]]
    system_health_pct: float
    blast_radius_pct: float

class QuickBlastRequest(BaseModel):
    target_node_id: str = Field(..., min_length=1, max_length=120)
    failure_type: str = Field(default="NODE_CRASH", max_length=50)
    nodes: list[dict[str, Any]] = Field(..., max_length=300)
    edges: list[dict[str, Any]] = Field(..., max_length=1000)

class QuickBlastResponse(BaseModel):
    target_node_id: str
    blast_radius_pct: float
    direct_dependents: list[str]
    downstream_impacted: list[str]
    upstream_affected: list[str]
    resilience_score: float
    severity: str
    recommendations: list[str]

class SimulationRunResponse(BaseModel):
    simulation_id: str
    topology_id: Optional[str] = None
    scenario_name: str
    resilience_score: float
    blast_radius_pct: float
    total_affected_nodes: int
    timeline_frames: list[TimelineFrame]
    recommendations: list[str]
    critical_path_impact: list[str]
    business_impact: Optional[dict[str, Any]] = None
    created_at: str
