from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict

class NodeMetrics(BaseModel):
    error_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Error rate between 0.0 and 1.0")
    latency_p99_ms: float = Field(default=45.0, ge=0.0, le=300000.0, description="99th percentile latency in milliseconds")
    current_load_pct: float = Field(default=30.0, ge=0.0, le=100.0, description="CPU/thread load percentage")
    throughput_rps: float = Field(default=120.0, ge=0.0, le=1000000.0, description="Requests per second processed")

class RetryPolicy(BaseModel):
    max_retries: int = Field(default=3, ge=0, le=10)
    backoff: str = Field(default="exponential", pattern="^(exponential|fixed|none)$")

class NodePosition(BaseModel):
    x: float = Field(default=0.0, ge=-50000.0, le=50000.0)
    y: float = Field(default=0.0, ge=-50000.0, le=50000.0)

class NodeSchema(BaseModel):
    id: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_\-\.:]+$", description="Alphanumeric identifier")
    type: str = Field(default="service", max_length=50, description="Node type")
    name: str = Field(..., min_length=1, max_length=200, description="Display name for the service")
    tier: str = Field(default="business_logic", max_length=50)
    cloud_provider: str = Field(default="aws", max_length=50)
    region: str = Field(default="us-east-1", max_length=50)
    zone: Optional[str] = Field(default="us-east-1a", max_length=50)
    replicas: int = Field(default=1, ge=1, le=1000, description="Number of active container/VM instances")
    redundancy_type: str = Field(default="none", max_length=50)
    has_circuit_breaker: bool = Field(default=False)
    has_fallback: bool = Field(default=False)
    fallback_behavior: str = Field(default="none", max_length=50)
    timeout_ms: int = Field(default=2000, ge=50, le=300000)
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)
    business_criticality: float = Field(default=5.0, ge=1.0, le=10.0)
    revenue_per_minute: float = Field(default=0.0, ge=0.0, le=100000000.0)
    sla_target: float = Field(default=0.999, ge=0.9, le=0.99999)
    state: str = Field(default="HEALTHY", max_length=30)
    metrics: NodeMetrics = Field(default_factory=NodeMetrics)
    position: NodePosition = Field(default_factory=NodePosition)
    data: Optional[dict[str, Any]] = None

class CircuitBreakerConfig(BaseModel):
    enabled: bool = False
    failure_threshold_pct: float = Field(default=50.0, ge=1.0, le=100.0)
    reset_timeout_seconds: int = Field(default=30, ge=1, le=3600)

class EdgeSchema(BaseModel):
    id: str = Field(..., min_length=1, max_length=120)
    source: str = Field(..., min_length=1, max_length=100)
    target: str = Field(..., min_length=1, max_length=100)
    protocol: str = Field(default="http_rest", max_length=50)
    is_sync: bool = Field(default=True)
    circuit_breaker: CircuitBreakerConfig = Field(default_factory=CircuitBreakerConfig)
    health_threshold_ms: int = Field(default=1000, ge=10, le=300000)
    traffic_weight_pct: int = Field(default=100, ge=1, le=100)
    timeout_ms: int = Field(default=2000, ge=50, le=300000)
    max_retries: int = Field(default=3, ge=0, le=10)
    state: str = Field(default="ACTIVE", max_length=30)
    data: Optional[dict[str, Any]] = None

class TopologyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(default="", max_length=2000)
    category: Optional[str] = Field(default="custom", max_length=100)
    tags: list[str] = Field(default_factory=list, max_length=50)
    nodes: list[NodeSchema] = Field(..., max_length=300, description="Max 300 nodes per topology")
    edges: list[EdgeSchema] = Field(..., max_length=1000, description="Max 1000 edges per topology")
    meta: Optional[dict[str, Any]] = Field(default_factory=dict)

class TopologyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    category: Optional[str] = Field(default=None, max_length=100)
    tags: Optional[list[str]] = Field(default=None, max_length=50)
    nodes: Optional[list[NodeSchema]] = Field(default=None, max_length=300)
    edges: Optional[list[EdgeSchema]] = Field(default=None, max_length=1000)
    meta: Optional[dict[str, Any]] = None

class TopologyResponse(BaseModel):
    id: str
    name: str
    description: str
    category: str
    is_preset: int
    tags: list[str]
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    meta: dict[str, Any]
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)
