from typing import Any
import networkx as nx
from backend.app.schemas.analysis import (
    ArchitectureValidationResponse,
    ValidationIssue
)

def validate_architecture(
    G: nx.DiGraph,
    raw_edges: list[dict[str, Any]] | None = None
) -> ArchitectureValidationResponse:
    """
    Validates infrastructure topology using NetworkX graph theory algorithms:
    - Synchronous cycle detection (Johnson's simple cycles algorithm)
    - Graph connectivity & isolated components
    - Orphan edge endpoints detection
    - High-risk Single Points of Failure (SPOFs)
    - Cross-region unmitigated synchronous dependencies
    - Missing circuit breaker protections
    """
    issues: list[ValidationIssue] = []
    total_nodes = G.number_of_nodes()
    total_edges = G.number_of_edges()

    if total_nodes == 0:
        return ArchitectureValidationResponse(
            is_valid=False,
            summary="Empty graph: Architecture contains no services or nodes.",
            total_nodes=0,
            total_edges=0,
            critical_issues_count=1,
            warning_issues_count=0,
            issues=[
                ValidationIssue(
                    category="EMPTY_GRAPH",
                    severity="CRITICAL",
                    component_id="system",
                    message="Architecture topology contains zero nodes.",
                    recommendation="Add at least one service, gateway, or database component."
                )
            ],
            has_synchronous_cycles=False,
            cycles=[],
            isolated_nodes=[]
        )

    # 1. Orphan edge check (from raw edge payload if provided)
    if raw_edges:
        for e in raw_edges:
            src = str(e.get("source"))
            tgt = str(e.get("target"))
            edge_id = str(e.get("id", f"{src}->{tgt}"))
            if not G.has_node(src):
                issues.append(ValidationIssue(
                    category="ORPHAN_EDGE",
                    severity="CRITICAL",
                    component_id=edge_id,
                    message=f"Edge '{edge_id}' references non-existent source node '{src}'.",
                    recommendation=f"Define node '{src}' or remove edge '{edge_id}'."
                ))
            if not G.has_node(tgt):
                issues.append(ValidationIssue(
                    category="ORPHAN_EDGE",
                    severity="CRITICAL",
                    component_id=edge_id,
                    message=f"Edge '{edge_id}' references non-existent target node '{tgt}'.",
                    recommendation=f"Define node '{tgt}' or remove edge '{edge_id}'."
                ))

    # 2. Cycle Detection (Differentiating Synchronous vs. Asynchronous)
    # Synchronous cycles cause distributed deadlocks and cascade amplification
    sync_edges = [
        (u, v) for u, v, d in G.edges(data=True)
        if d.get("is_sync", True)
    ]
    G_sync = G.edge_subgraph(sync_edges).copy()

    sync_cycles = []
    try:
        # Find all simple cycles on the synchronous subgraph
        for c in nx.simple_cycles(G_sync):
            sync_cycles.append(c)
            issues.append(ValidationIssue(
                category="CYCLE",
                severity="CRITICAL",
                component_id=" -> ".join(c),
                message=f"Circular synchronous dependency detected: {' -> '.join(c)} -> {c[0]}.",
                recommendation="Break the synchronous dependency cycle by introducing an asynchronous message queue (e.g., Kafka/SQS) or event-driven callbacks."
            ))
            if len(sync_cycles) >= 10:
                break
    except Exception:
        pass

    # 3. Isolated / Disconnected Services
    isolated_nodes = []
    for node_id in G.nodes:
        in_deg = G.in_degree(node_id)
        out_deg = G.out_degree(node_id)
        if in_deg == 0 and out_deg == 0:
            isolated_nodes.append(node_id)
            node_name = G.nodes[node_id].get("name", node_id)
            issues.append(ValidationIssue(
                category="ISOLATED_NODE",
                severity="WARNING",
                component_id=node_id,
                message=f"Service '{node_name}' ({node_id}) is completely isolated with no incoming or outgoing connections.",
                recommendation="Connect this service to its dependencies or remove it from the active architecture canvas."
            ))

    # 4. Single Points of Failure (Articulation Points on Undirected Projection)
    U = G.to_undirected()
    try:
        cut_vertices = list(nx.articulation_points(U))
    except Exception:
        cut_vertices = []

    for spof_id in cut_vertices:
        nd = G.nodes[spof_id]
        replicas = nd.get("replicas", 1)
        redundancy = nd.get("redundancy_type", "none")
        has_fb = nd.get("has_fallback", False)
        node_name = nd.get("name", spof_id)

        if replicas <= 1 and redundancy == "none" and not has_fb:
            issues.append(ValidationIssue(
                category="SPOF",
                severity="CRITICAL",
                component_id=spof_id,
                message=f"'{node_name}' is a Single Point of Failure with 1 replica and no redundancy/fallback.",
                recommendation=f"Provision multi-AZ replicas ({node_name}) or configure active-active failover."
            ))

    # 5. Cross-Region Synchronous Calls without Protection
    for u, v, d in G.edges(data=True):
        if d.get("is_sync", True):
            u_region = G.nodes[u].get("region", "us-east-1")
            v_region = G.nodes[v].get("region", "us-east-1")
            cb = d.get("circuit_breaker", {})
            cb_enabled = cb.get("enabled", False)

            if u_region != v_region and not cb_enabled:
                u_name = G.nodes[u].get("name", u)
                v_name = G.nodes[v].get("name", v)
                edge_id = d.get("id", f"{u}->{v}")
                issues.append(ValidationIssue(
                    category="CROSS_REGION",
                    severity="WARNING",
                    component_id=edge_id,
                    message=f"Synchronous cross-region dependency: '{u_name}' ({u_region}) calls '{v_name}' ({v_region}) with no circuit breaker.",
                    recommendation="Add a circuit breaker and fallback caching to insulate against cross-region WAN latency spikes and fiber cuts."
                ))

    # 6. Database / Third-Party Calls Without Circuit Protection
    for u, v, d in G.edges(data=True):
        if d.get("is_sync", True):
            v_type = G.nodes[v].get("type", "service")
            cb_enabled = d.get("circuit_breaker", {}).get("enabled", False) or G.nodes[u].get("has_circuit_breaker", False)

            if v_type in ["database", "third_party"] and not cb_enabled:
                u_name = G.nodes[u].get("name", u)
                v_name = G.nodes[v].get("name", v)
                edge_id = d.get("id", f"{u}->{v}")
                issues.append(ValidationIssue(
                    category="UNPROTECTED_SYNC",
                    severity="WARNING",
                    component_id=edge_id,
                    message=f"Synchronous dependency on external/storage tier '{v_name}' from '{u_name}' has no circuit breaker.",
                    recommendation=f"Enable circuit breaker pattern on edge '{edge_id}' to prevent connection pool exhaustion."
                ))

    critical_count = sum(1 for i in issues if i.severity == "CRITICAL")
    warning_count = sum(1 for i in issues if i.severity == "WARNING")
    is_valid = (critical_count == 0)

    summary = (
        f"Validation passed: Architecture is structurally sound with {warning_count} warning(s)."
        if is_valid else
        f"Validation failed: Detected {critical_count} critical architectural flaw(s) and {warning_count} warning(s)."
    )

    return ArchitectureValidationResponse(
        is_valid=is_valid,
        summary=summary,
        total_nodes=total_nodes,
        total_edges=total_edges,
        critical_issues_count=critical_count,
        warning_issues_count=warning_count,
        issues=issues,
        has_synchronous_cycles=len(sync_cycles) > 0,
        cycles=sync_cycles,
        isolated_nodes=isolated_nodes
    )
