import pytest
import networkx as nx
from backend.app.engine.business_impact import calculate_business_impact

def test_business_impact_healthy_cluster(ecommerce_graph):
    """When all services are healthy, revenue loss is zero and risk is LOW."""
    node_states = {n: {"state": "HEALTHY"} for n in ecommerce_graph.nodes}
    impact = calculate_business_impact(ecommerce_graph, node_states)

    assert impact.total_revenue_loss_per_minute == 0.0
    assert impact.total_revenue_loss_per_hour == 0.0
    assert impact.blast_radius_pct == 0.0
    assert impact.total_services_impacted == 0
    assert impact.business_risk_level == "LOW"

def test_business_impact_high_revenue_failure(ecommerce_graph):
    """
    Failing the primary payment database (revenue_per_minute = 2500) and payment engine
    calculates accurate financial loss rates and marks risk as HIGH or CATASTROPHIC.
    """
    node_states = {n: {"state": "HEALTHY"} for n in ecommerce_graph.nodes}
    node_states["db-postgres-primary"] = {"state": "FAILED"}
    node_states["srv-payment"] = {"state": "FAILING"}

    impact = calculate_business_impact(ecommerce_graph, node_states)

    assert impact.total_revenue_loss_per_minute >= 2500.0
    assert impact.total_revenue_loss_per_hour == round(impact.total_revenue_loss_per_minute * 60, 2)
    assert impact.critical_services_failed >= 2
    assert "PostgreSQL Primary (Payments)" in impact.high_revenue_services_down
    assert impact.business_risk_level in ["HIGH", "CATASTROPHIC"]

def test_business_impact_tier_breakdown(ecommerce_graph):
    """Tier degradation correctly categorizes presentation, business_logic, and data_store."""
    node_states = {n: {"state": "HEALTHY"} for n in ecommerce_graph.nodes}
    node_states["db-postgres-primary"] = {"state": "FAILED"}

    impact = calculate_business_impact(ecommerce_graph, node_states)
    data_store_tier = next((t for t in impact.tier_degradation if t.tier == "data_store"), None)

    assert data_store_tier is not None
    assert data_store_tier.failed_nodes == 1
    assert data_store_tier.degradation_pct > 0.0

def test_business_impact_empty_graph():
    """Empty graphs return safe zeroed business metrics."""
    G = nx.DiGraph()
    impact = calculate_business_impact(G, {})
    assert impact.total_revenue_loss_per_minute == 0.0
    assert impact.blast_radius_pct == 0.0
    assert impact.business_risk_level == "LOW"
