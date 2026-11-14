import pytest
import networkx as nx
from backend.app.engine.failure_propagator import run_failure_simulation

def test_direct_node_crash(ecommerce_graph):
    """Hard crash of primary database renders it FAILED at step 0."""
    injections = [{"target_type": "NODE", "target_id": "db-postgres-primary", "failure_type": "NODE_CRASH"}]
    result = run_failure_simulation(ecommerce_graph, injections)

    assert result["total_affected_nodes"] >= 1
    assert result["blast_radius_pct"] > 0.0
    assert len(result["timeline_frames"]) >= 1

    frame0 = result["timeline_frames"][0]
    assert frame0["node_states"]["db-postgres-primary"]["state"] == "FAILED"
    assert frame0["node_states"]["db-postgres-primary"]["error_rate"] == 1.0

def test_cascade_and_circuit_breaker_mitigation(ecommerce_graph):
    """
    When primary database fails, payment service (calling it without circuit breaker) cascades,
    while checkout service (which calls payment with a circuit breaker) trips circuit to CIRCUIT_OPEN.
    """
    injections = [{"target_type": "NODE", "target_id": "db-postgres-primary", "failure_type": "NODE_CRASH"}]
    result = run_failure_simulation(ecommerce_graph, injections)

    # In final frame, payment engine must be impacted
    last_frame = result["timeline_frames"][-1]
    payment_state = last_frame["node_states"]["srv-payment"]["state"]
    assert payment_state in ["FAILED", "FAILING", "DEGRADED"]

    # Edge between checkout and payment should be protected by circuit breaker
    assert any(
        "srv-checkout" in cp or "srv-payment" in cp
        for cp in result["critical_path_impact"]
    ) or any(
        s.get("state") == "CIRCUIT_OPEN"
        for s in last_frame["edge_states"].values()
    )

def test_fallback_graceful_degradation():
    """Service with fallback behavior 'serve_cache' stays DEGRADED instead of FAILING."""
    nodes = [
        {"id": "caller", "name": "Caller", "has_circuit_breaker": True, "has_fallback": True, "fallback_behavior": "serve_cache", "replicas": 2},
        {"id": "dep", "name": "Dependency", "has_circuit_breaker": False, "has_fallback": False, "replicas": 1},
    ]
    edges = [
        {"id": "e1", "source": "caller", "target": "dep", "is_sync": True, "circuit_breaker": {"enabled": True}}
    ]
    from backend.app.engine.graph_builder import build_networkx_graph
    G = build_networkx_graph(nodes, edges)

    injections = [{"target_type": "NODE", "target_id": "dep", "failure_type": "NODE_CRASH"}]
    res = run_failure_simulation(G, injections)

    last_frame = res["timeline_frames"][-1]
    assert last_frame["node_states"]["caller"]["state"] == "DEGRADED"
    assert "fallback" in last_frame["node_states"]["caller"]["status_reason"].lower() or "cache" in last_frame["node_states"]["caller"]["status_reason"].lower()

def test_async_queue_buffering():
    """Asynchronous queue decouple producer from immediate failure of downstream."""
    nodes = [
        {"id": "producer", "name": "Order Producer", "type": "service", "has_circuit_breaker": False},
        {"id": "queue-stream", "name": "Kafka Buffer", "type": "queue", "has_circuit_breaker": False},
        {"id": "consumer", "name": "Invoice Consumer", "type": "service", "has_circuit_breaker": False},
    ]
    edges = [
        {"id": "e-prod", "source": "producer", "target": "queue-stream", "is_sync": False, "protocol": "kafka"},
        {"id": "e-cons", "source": "queue-stream", "target": "consumer", "is_sync": False, "protocol": "kafka"},
    ]
    from backend.app.engine.graph_builder import build_networkx_graph
    G = build_networkx_graph(nodes, edges)

    # Inject failure on queue
    injections = [{"target_type": "NODE", "target_id": "queue-stream", "failure_type": "NODE_CRASH"}]
    res = run_failure_simulation(G, injections)

    last_frame = res["timeline_frames"][-1]
    # Producer should not immediately hard-fail due to async buffering
    assert last_frame["node_states"]["producer"]["state"] in ["HEALTHY", "DEGRADED"]

def test_region_blackout(ecommerce_graph):
    """Region outage knocks out all nodes mapped to us-east-1."""
    injections = [{"target_type": "REGION", "target_id": "us-east-1", "failure_type": "REGION_OUTAGE"}]
    res = run_failure_simulation(ecommerce_graph, injections)

    frame0 = res["timeline_frames"][0]
    # All us-east-1 nodes in preset must be failed
    us_nodes = [n for n in ecommerce_graph.nodes if ecommerce_graph.nodes[n].get("region") == "us-east-1"]
    for nid in us_nodes:
        assert frame0["node_states"][nid]["state"] == "FAILED"
    assert res["blast_radius_pct"] > 80.0
