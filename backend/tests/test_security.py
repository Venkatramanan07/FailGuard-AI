import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.config import settings
from backend.app.core.exceptions import GraphSizeLimitExceededError
from backend.app.engine.graph_builder import build_networkx_graph

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# -------------------------------------------------------------
# 1. Security Headers Verification
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_security_headers_present(client):
    response = await client.get("/health")
    assert response.status_code == 200
    headers = response.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("X-XSS-Protection") == "1; mode=block"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "Content-Security-Policy" in headers
    assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]

# -------------------------------------------------------------
# 2. CORS Policy Verification
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_cors_authorized_origin(client):
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
    }
    response = await client.options("/api/v1/simulations/run", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert response.headers.get("access-control-allow-credentials") == "true"

@pytest.mark.asyncio
async def test_cors_unauthorized_origin_rejected(client):
    headers = {
        "Origin": "http://malicious-site-phishing.com",
        "Access-Control-Request-Method": "POST",
    }
    response = await client.options("/api/v1/simulations/run", headers=headers)
    # Origin should NOT be reflected in access-control-allow-origin
    allowed_origin = response.headers.get("access-control-allow-origin")
    assert allowed_origin != "http://malicious-site-phishing.com"
    assert allowed_origin != "*"

# -------------------------------------------------------------
# 3. Request Body Size Limits (413)
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_payload_too_large_rejection(client):
    # Simulate a payload claiming to be 5MB (> 2MB limit)
    oversized_headers = {
        "Content-Length": str(5 * 1024 * 1024),
        "Content-Type": "application/json"
    }
    response = await client.post(
        "/api/v1/simulations/run",
        headers=oversized_headers,
        content=b'{"test": 1}'
    )
    assert response.status_code == 413
    data = response.json()
    assert data["error"]["code"] == "PAYLOAD_TOO_LARGE"

# -------------------------------------------------------------
# 4. Graph Size Limit & DoS Prevention
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_graph_builder_node_limit_enforced():
    excessive_nodes = [
        {"id": f"node-{i}", "name": f"Service {i}"}
        for i in range(settings.MAX_GRAPH_NODES + 10)
    ]
    with pytest.raises(GraphSizeLimitExceededError) as exc_info:
        build_networkx_graph(excessive_nodes, [])
    assert exc_info.value.code == "GRAPH_SIZE_LIMIT_EXCEEDED"

@pytest.mark.asyncio
async def test_graph_builder_edge_limit_enforced():
    nodes = [{"id": "n1"}, {"id": "n2"}]
    excessive_edges = [
        {"id": f"e-{i}", "source": "n1", "target": "n2"}
        for i in range(settings.MAX_GRAPH_EDGES + 10)
    ]
    with pytest.raises(GraphSizeLimitExceededError) as exc_info:
        build_networkx_graph(nodes, excessive_edges)
    assert exc_info.value.code == "GRAPH_SIZE_LIMIT_EXCEEDED"

# -------------------------------------------------------------
# 5. Preset Topology Tampering & Deletion Protection (403)
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_preset_deletion_forbidden(client):
    # Attempting to delete a built-in benchmark preset
    response = await client.delete("/api/v1/topologies/preset-ecommerce-aws")
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "PRESET_PROTECTED"

@pytest.mark.asyncio
async def test_preset_modification_forbidden(client):
    # Attempting to overwrite a built-in benchmark preset
    response = await client.put(
        "/api/v1/topologies/preset-ecommerce-aws",
        json={"name": "Hacked Preset Name"}
    )
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "PRESET_PROTECTED"

# -------------------------------------------------------------
# 6. Information Leakage Prevention on Internal Error (500)
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_unhandled_exception_sanitized():
    # Verify global exception handler masks tracebacks
    from starlette.requests import Request
    from backend.app.core.exceptions import global_exception_handler

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/broken",
        "headers": []
    }
    request = Request(scope)
    simulated_error = ZeroDivisionError("division by zero secret database internal trace /var/secrets/key.pem")

    response = await global_exception_handler(request, simulated_error)
    assert response.status_code == 500
    import json
    data = json.loads(response.body.decode("utf-8"))
    assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
    # Ensure sensitive traceback or internal path is NOT leaked to client
    assert "secret" not in data["error"]["message"]
    assert "division by zero" not in data["error"]["message"]
    assert "correlation_id" in data["error"]

# -------------------------------------------------------------
# 7. Resilient Input Parsing Defense in Graph Builder
# -------------------------------------------------------------
def test_graph_builder_resilient_to_malicious_inputs():
    malformed_nodes = [
        {"id": None, "name": "Null ID Node"},
        {"id": "   ", "name": "Whitespace ID"},
        {"id": "None", "name": "Literal None"},
        {"id": "node<script>alert(1)</script>", "name": "XSS Probe"},  # non-alphanumeric rejected
        {
            "id": "valid-node-1",
            "name": "A" * 500,  # overly long name
            "replicas": "invalid_int",  # invalid type
            "business_criticality": "NaN",  # invalid float
            "revenue_per_minute": -500.0,  # negative revenue
            "timeout_ms": 999999999999,  # huge timeout
        }
    ]
    G = build_networkx_graph(malformed_nodes, [])

    # Only the valid node should be admitted
    assert G.number_of_nodes() == 1
    assert "valid-node-1" in G.nodes
    data = G.nodes["valid-node-1"]
    assert len(data["name"]) <= 200
    assert data["replicas"] == 1  # defaulted safely
    assert data["business_criticality"] == 5.0  # defaulted safely
    assert data["revenue_per_minute"] == 0.0  # clamped from negative
    assert data["timeout_ms"] == 300000  # clamped to max

# -------------------------------------------------------------
# 8. Rate Limiting Protection (429)
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_rate_limiting_enforced(client):
    # Rapidly fire requests to exceed simulation rate limit quota
    responses = []
    for _ in range(settings.SIMULATION_RATE_LIMIT_PER_MINUTE + 5):
        res = await client.post(
            "/api/v1/simulations/quick-blast",
            json={
                "target_node_id": "test",
                "failure_type": "NODE_CRASH",
                "nodes": [{"id": "test", "name": "Test"}],
                "edges": []
            }
        )
        responses.append(res.status_code)

    # At least one request towards the end should be throttled with 429
    assert 429 in responses
