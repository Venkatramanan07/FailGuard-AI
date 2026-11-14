import re
from typing import Any
import networkx as nx
from backend.app.core.config import settings
from backend.app.core.exceptions import GraphSizeLimitExceededError

SAFE_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.:>]+$")

def _safe_str(val: Any, default: str = "", max_len: int = 200) -> str:
    if val is None:
        return default
    s = str(val).strip()
    return s[:max_len] if len(s) > max_len else s

def _safe_int(val: Any, default: int, min_val: int, max_val: int) -> int:
    try:
        n = int(val)
        return max(min_val, min(n, max_val))
    except (ValueError, TypeError):
        return default

def _safe_float(val: Any, default: float, min_val: float, max_val: float) -> float:
    try:
        f = float(val)
        if f != f:  # NaN check
            return default
        return max(min_val, min(f, max_val))
    except (ValueError, TypeError):
        return default

def build_networkx_graph(nodes_data: list[dict[str, Any]], edges_data: list[dict[str, Any]]) -> nx.DiGraph:
    """
    Constructs a NetworkX DiGraph from React Flow / JSON node & edge definitions.
    Enforces architectural security bounds, size quotas, and resilient type casting.
    Directed edge (u, v) indicates that u depends on v (u is the caller, v is the provider).
    """
    if len(nodes_data) > settings.MAX_GRAPH_NODES:
        raise GraphSizeLimitExceededError(len(nodes_data), settings.MAX_GRAPH_NODES, "nodes")

    if len(edges_data) > settings.MAX_GRAPH_EDGES:
        raise GraphSizeLimitExceededError(len(edges_data), settings.MAX_GRAPH_EDGES, "edges")

    G = nx.DiGraph()

    for node in nodes_data:
        raw_id = node.get("id")
        if raw_id is None or str(raw_id).strip() == "" or str(raw_id).strip().lower() == "none":
            continue

        node_id = str(raw_id).strip()
        if not SAFE_ID_REGEX.match(node_id):
            continue

        # Extract attributes with resilient fallbacks
        data = node.get("data", {}) if isinstance(node.get("data"), dict) else {}
        node_type = _safe_str(node.get("type") or data.get("type", "service"), "service", 50)
        node_name = _safe_str(node.get("name") or data.get("name") or data.get("label", node_id), node_id, 200)

        G.add_node(
            node_id,
            id=node_id,
            name=node_name,
            type=node_type,
            tier=_safe_str(node.get("tier") or data.get("tier", "business_logic"), "business_logic", 50),
            cloud_provider=_safe_str(node.get("cloud_provider") or data.get("cloud_provider", "aws"), "aws", 50),
            region=_safe_str(node.get("region") or data.get("region", "us-east-1"), "us-east-1", 50),
            zone=_safe_str(node.get("zone") or data.get("zone", "us-east-1a"), "us-east-1a", 50),
            replicas=_safe_int(node.get("replicas") or data.get("replicas", 1), 1, 1, 1000),
            redundancy_type=_safe_str(node.get("redundancy_type") or data.get("redundancy_type", "none"), "none", 50),
            has_circuit_breaker=bool(node.get("has_circuit_breaker") or data.get("has_circuit_breaker", False)),
            has_fallback=bool(node.get("has_fallback") or data.get("has_fallback", False)),
            fallback_behavior=_safe_str(node.get("fallback_behavior") or data.get("fallback_behavior", "none"), "none", 50),
            timeout_ms=_safe_int(node.get("timeout_ms") or data.get("timeout_ms", 2000), 2000, 10, 300000),
            retry_policy=node.get("retry_policy") or data.get("retry_policy", {"max_retries": 3, "backoff": "exponential"}),
            business_criticality=_safe_float(node.get("business_criticality") or data.get("business_criticality", 5.0), 5.0, 1.0, 10.0),
            revenue_per_minute=_safe_float(node.get("revenue_per_minute") or data.get("revenue_per_minute", 0.0), 0.0, 0.0, 100000000.0),
            sla_target=_safe_float(node.get("sla_target") or data.get("sla_target", 0.999), 0.999, 0.5, 0.99999),
            state=_safe_str(node.get("state") or data.get("state", "HEALTHY"), "HEALTHY", 30),
            metrics=node.get("metrics") or data.get("metrics", {"error_rate": 0.0, "latency_p99_ms": 45, "current_load_pct": 25, "throughput_rps": 120.0}),
            position=node.get("position", {"x": 0, "y": 0})
        )

    for edge in edges_data:
        raw_src = edge.get("source")
        raw_tgt = edge.get("target")
        if not raw_src or not raw_tgt:
            continue

        src = str(raw_src).strip()
        tgt = str(raw_tgt).strip()

        # Ensure endpoints exist
        if not G.has_node(src) or not G.has_node(tgt):
            continue

        raw_id = edge.get("id") or f"{src}->{tgt}"
        edge_id = _safe_str(raw_id, f"{src}->{tgt}", 120)

        data = edge.get("data", {}) if isinstance(edge.get("data"), dict) else {}
        cb = edge.get("circuit_breaker") or data.get("circuit_breaker", {"enabled": False, "failure_threshold_pct": 50})

        G.add_edge(
            src,
            tgt,
            id=edge_id,
            protocol=_safe_str(edge.get("protocol") or data.get("protocol", "http_rest"), "http_rest", 50),
            is_sync=bool(edge.get("is_sync", data.get("is_sync", True))),
            circuit_breaker=cb,
            health_threshold_ms=_safe_int(edge.get("health_threshold_ms") or data.get("health_threshold_ms", 1000), 1000, 10, 300000),
            traffic_weight_pct=_safe_int(edge.get("traffic_weight_pct") or data.get("traffic_weight_pct", 100), 100, 1, 100),
            timeout_ms=_safe_int(edge.get("timeout_ms") or data.get("timeout_ms", 2000), 2000, 10, 300000),
            max_retries=_safe_int(edge.get("max_retries") or data.get("max_retries", 3), 3, 0, 10),
            state=_safe_str(edge.get("state") or data.get("state", "ACTIVE"), "ACTIVE", 30)
        )

    return G
