import pytest

def test_health_endpoint(test_client):
    """GET /api/v1/health returns 200 with engine metadata."""
    res = test_client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "NetworkX" in data["engine"]

def test_presets_endpoint(test_client):
    """GET /api/v1/topologies/presets returns pre-configured architectures."""
    res = test_client.get("/api/v1/topologies/presets")
    assert res.status_code == 200
    presets = res.json()
    assert len(presets) >= 1
    assert presets[0]["id"] == "preset-ecommerce-aws"
    assert len(presets[0]["nodes"]) == 12

def test_architecture_validate_endpoint(test_client, ecommerce_preset):
    """POST /api/v1/architecture/validate validates graph architecture."""
    payload = {
        "nodes": ecommerce_preset["nodes"],
        "edges": ecommerce_preset["edges"]
    }
    res = test_client.post("/api/v1/architecture/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "is_valid" in data
    assert data["total_nodes"] == 12
    assert data["total_edges"] == 12

def test_architecture_criticality_endpoint(test_client, ecommerce_preset):
    """POST /api/v1/architecture/criticality returns SPOFs and centrality."""
    payload = {
        "topology_id": "preset-ecommerce-aws"
    }
    res = test_client.post("/api/v1/architecture/criticality", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "baseline_resilience_score" in data
    assert len(data["spofs"]) > 0
    assert len(data["bottlenecks"]) > 0

def test_recovery_priorities_endpoint(test_client, ecommerce_preset):
    """POST /api/v1/architecture/recovery-priorities returns recovery sequence."""
    payload = {
        "topology_id": "preset-ecommerce-aws",
        "injections": [
            {"target_type": "NODE", "target_id": "db-postgres-primary", "failure_type": "NODE_CRASH"}
        ]
    }
    res = test_client.post("/api/v1/architecture/recovery-priorities", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "topological_recovery_plan" in data
    assert "architectural_mitigations" in data
    assert len(data["topological_recovery_plan"]) > 0

def test_simulation_run_endpoint(test_client, ecommerce_preset):
    """POST /api/v1/simulations/run executes failure simulation and returns frames + business impact."""
    payload = {
        "topology_id": "preset-ecommerce-aws",
        "scenario_name": "API Test Outage",
        "injections": [
            {"target_type": "NODE", "target_id": "db-postgres-primary", "failure_type": "NODE_CRASH"}
        ]
    }
    res = test_client.post("/api/v1/simulations/run", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "simulation_id" in data
    assert "resilience_score" in data
    assert "blast_radius_pct" in data
    assert "timeline_frames" in data
    assert "business_impact" in data
    assert data["business_impact"]["total_revenue_loss_per_minute"] >= 2500.0

def test_error_handling_topology_not_found(test_client):
    """GET /api/v1/topologies/{invalid_id} returns 404 with structured error payload."""
    res = test_client.get("/api/v1/topologies/non-existent-topo-1234")
    assert res.status_code == 404
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "TOPOLOGY_NOT_FOUND"
    assert "non-existent-topo-1234" in data["error"]["message"]

def test_error_handling_node_not_found(test_client, ecommerce_preset):
    """Injecting failure on non-existent node returns 404 with NODE_NOT_FOUND error."""
    payload = {
        "topology_id": "preset-ecommerce-aws",
        "scenario_name": "Invalid Node Test",
        "injections": [
            {"target_type": "NODE", "target_id": "ghost-service-999", "failure_type": "NODE_CRASH"}
        ]
    }
    res = test_client.post("/api/v1/simulations/run", json=payload)
    assert res.status_code == 404
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "NODE_NOT_FOUND"
    assert "ghost-service-999" in data["error"]["message"]
