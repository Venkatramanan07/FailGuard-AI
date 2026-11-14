import pytest
import networkx as nx
from backend.app.engine.graph_builder import build_networkx_graph
from backend.app.engine.architecture_validator import validate_architecture

def test_validation_ecommerce_preset(ecommerce_preset, ecommerce_graph):
    """The sample e-commerce preset is a valid DAG with expected architectural warnings."""
    res = validate_architecture(ecommerce_graph, raw_edges=ecommerce_preset["edges"])
    assert res.total_nodes == 12
    assert res.total_edges == 12
    assert res.has_synchronous_cycles is False
    assert len(res.cycles) == 0
    assert len(res.isolated_nodes) == 0

def test_synchronous_cycle_detection(cyclic_graph_data):
    """Circular synchronous dependencies are detected and flagged as CRITICAL."""
    G = build_networkx_graph(cyclic_graph_data["nodes"], cyclic_graph_data["edges"])
    res = validate_architecture(G, raw_edges=cyclic_graph_data["edges"])
    assert res.has_synchronous_cycles is True
    assert len(res.cycles) > 0
    assert res.is_valid is False
    assert res.critical_issues_count >= 1

    cycle_issues = [i for i in res.issues if i.category == "CYCLE"]
    assert len(cycle_issues) >= 1
    assert cycle_issues[0].severity == "CRITICAL"
    assert "Circular synchronous dependency" in cycle_issues[0].message

def test_isolated_node_detection(disconnected_graph_data):
    """Disconnected services are identified with WARNING severity."""
    G = build_networkx_graph(disconnected_graph_data["nodes"], disconnected_graph_data["edges"])
    res = validate_architecture(G, raw_edges=disconnected_graph_data["edges"])
    assert "node-isolated" in res.isolated_nodes
    isolated_issues = [i for i in res.issues if i.category == "ISOLATED_NODE"]
    assert len(isolated_issues) == 1
    assert isolated_issues[0].component_id == "node-isolated"

def test_orphan_edge_detection(disconnected_graph_data):
    """Edges referencing non-existent nodes are caught and reported as CRITICAL."""
    G = build_networkx_graph(disconnected_graph_data["nodes"], disconnected_graph_data["edges"])
    res = validate_architecture(G, raw_edges=disconnected_graph_data["edges"])
    orphan_issues = [i for i in res.issues if i.category == "ORPHAN_EDGE"]
    assert len(orphan_issues) >= 1
    assert "node-ghost" in orphan_issues[0].message

def test_cross_region_unprotected_sync_detection():
    """Cross-region synchronous calls without circuit breakers trigger warnings."""
    nodes = [
        {"id": "service-us", "name": "US Ingress", "region": "us-east-1", "has_circuit_breaker": False},
        {"id": "service-eu", "name": "EU Backend", "region": "eu-west-1", "has_circuit_breaker": False},
    ]
    edges = [
        {"id": "e-cross-region", "source": "service-us", "target": "service-eu", "is_sync": True, "circuit_breaker": {"enabled": False}},
    ]
    G = build_networkx_graph(nodes, edges)
    res = validate_architecture(G, raw_edges=edges)
    cross_issues = [i for i in res.issues if i.category == "CROSS_REGION"]
    assert len(cross_issues) == 1
    assert "Cross-region" in cross_issues[0].message or "cross-region" in cross_issues[0].message

def test_empty_graph_validation():
    """Empty graphs are handled safely without exceptions."""
    G = nx.DiGraph()
    res = validate_architecture(G, raw_edges=[])
    assert res.is_valid is False
    assert res.total_nodes == 0
    assert res.critical_issues_count == 1
