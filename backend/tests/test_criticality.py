import pytest
import networkx as nx
from backend.app.engine.criticality_analyzer import analyze_criticality

def test_criticality_spof_detection(ecommerce_graph):
    """Detects articulation points in the e-commerce dependency graph."""
    res = analyze_criticality(ecommerce_graph, topology_id="preset-ecommerce-aws")

    assert len(res.spofs) > 0
    spof_ids = [s.node_id for s in res.spofs]
    # Primary DB has 1 replica and is an articulation point
    assert "db-postgres-primary" in spof_ids
    # Gateway is ingress articulation point
    assert "gw-api" in spof_ids

    # Critical SPOF severity check
    primary_db_spof = next(s for s in res.spofs if s.node_id == "db-postgres-primary")
    assert primary_db_spof.severity == "CRITICAL"
    assert primary_db_spof.business_criticality == 10.0

def test_criticality_bridges_and_centrality(ecommerce_graph):
    """Calculates betweenness centrality and PageRank for all nodes."""
    res = analyze_criticality(ecommerce_graph)

    assert len(res.bottlenecks) > 0
    # Betweenness and PageRank scores must be bounded [0, 1]
    for b in res.bottlenecks:
        assert 0.0 <= b.betweenness_centrality <= 1.0
        assert 0.0 <= b.pagerank_score <= 1.0

def test_critical_paths(ecommerce_graph):
    """Finds critical transaction paths from API Gateway to database stores."""
    res = analyze_criticality(ecommerce_graph)

    assert len(res.critical_paths) > 0
    for cp in res.critical_paths:
        assert len(cp.path) >= 2
        assert cp.path[0] == "gw-api"
        assert cp.total_baseline_latency_ms > 0

def test_baseline_resilience_scoring(ecommerce_graph):
    """Baseline resilience score is computed between 5.0 and 99.0."""
    res = analyze_criticality(ecommerce_graph)
    assert 5.0 <= res.baseline_resilience_score <= 99.0

def test_criticality_empty_graph():
    """Empty graphs are handled without runtime errors."""
    G = nx.DiGraph()
    res = analyze_criticality(G)
    assert res.baseline_resilience_score == 100.0
    assert len(res.spofs) == 0
