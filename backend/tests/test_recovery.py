import pytest
from backend.app.engine.recovery_prioritizer import generate_recovery_plan

def test_recovery_plan_healthy_cluster(ecommerce_graph):
    """When graph is healthy, recovery plan correctly reports 0 impacted services."""
    node_states = {n: {"state": "HEALTHY"} for n in ecommerce_graph.nodes}
    res = generate_recovery_plan(ecommerce_graph, node_states)

    assert res.total_impacted_services == 0
    assert len(res.topological_recovery_plan) == 0

def test_recovery_plan_topological_sequencing(ecommerce_graph):
    """
    When both PostgreSQL Primary and Payment Engine are down:
    PostgreSQL Primary (the dependency) MUST be scheduled for recovery
    BEFORE Payment Engine (the caller), ensuring reverse topological safety.
    """
    node_states = {n: {"state": "HEALTHY"} for n in ecommerce_graph.nodes}
    node_states["db-postgres-primary"] = {"state": "FAILED"}
    node_states["srv-payment"] = {"state": "FAILED"}

    res = generate_recovery_plan(ecommerce_graph, node_states)

    assert res.total_impacted_services == 2
    assert len(res.topological_recovery_plan) == 2

    step1 = res.topological_recovery_plan[0]
    step2 = res.topological_recovery_plan[1]

    # db-postgres-primary must be step 1
    assert step1.node_id == "db-postgres-primary"
    assert step2.node_id == "srv-payment"
    assert "PostgreSQL Primary (Payments)" in step2.dependencies_to_wait_for

def test_recovery_mitigations_generation(ecommerce_graph):
    """Generates concrete architectural mitigations for unmitigated failure points."""
    node_states = {n: {"state": "HEALTHY"} for n in ecommerce_graph.nodes}
    node_states["db-postgres-primary"] = {"state": "FAILED"}

    res = generate_recovery_plan(ecommerce_graph, node_states)

    assert len(res.architectural_mitigations) > 0
    pattern_types = [m.pattern_type for m in res.architectural_mitigations]
    # Expect read replica and/or cache layer recommendations for the database
    assert "READ_REPLICA" in pattern_types or "CACHE_LAYER" in pattern_types
