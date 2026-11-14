import pytest
import networkx as nx
from starlette.testclient import TestClient
from backend.app.main import app
from backend.app.engine.presets import PRESET_TOPOLOGIES
from backend.app.engine.graph_builder import build_networkx_graph

@pytest.fixture
def test_client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as client:
        yield client

@pytest.fixture
def ecommerce_preset():
    """Sample production-grade E-Commerce architecture data."""
    return PRESET_TOPOLOGIES[0]

@pytest.fixture
def ecommerce_graph(ecommerce_preset):
    """NetworkX directed dependency graph of the sample E-Commerce architecture."""
    return build_networkx_graph(ecommerce_preset["nodes"], ecommerce_preset["edges"])

@pytest.fixture
def cyclic_graph_data():
    """Synthetic architecture with a synchronous circular dependency."""
    nodes = [
        {"id": "service-a", "name": "Service A", "type": "service", "tier": "business_logic", "business_criticality": 6.0, "revenue_per_minute": 100.0},
        {"id": "service-b", "name": "Service B", "type": "service", "tier": "business_logic", "business_criticality": 6.0, "revenue_per_minute": 100.0},
        {"id": "service-c", "name": "Service C", "type": "service", "tier": "business_logic", "business_criticality": 6.0, "revenue_per_minute": 100.0},
    ]
    edges = [
        {"id": "e-a-b", "source": "service-a", "target": "service-b", "is_sync": True, "protocol": "http_rest"},
        {"id": "e-b-c", "source": "service-b", "target": "service-c", "is_sync": True, "protocol": "http_rest"},
        {"id": "e-c-a", "source": "service-c", "target": "service-a", "is_sync": True, "protocol": "http_rest"}, # Circular sync loop
    ]
    return {"nodes": nodes, "edges": edges}

@pytest.fixture
def disconnected_graph_data():
    """Synthetic architecture with isolated services and orphan edge."""
    nodes = [
        {"id": "node-connected-1", "name": "Connected 1", "type": "service"},
        {"id": "node-connected-2", "name": "Connected 2", "type": "service"},
        {"id": "node-isolated", "name": "Isolated Service", "type": "service"},
    ]
    edges = [
        {"id": "e-c1-c2", "source": "node-connected-1", "target": "node-connected-2", "is_sync": True},
        {"id": "e-orphan", "source": "node-connected-1", "target": "node-ghost", "is_sync": True},
    ]
    return {"nodes": nodes, "edges": edges}
