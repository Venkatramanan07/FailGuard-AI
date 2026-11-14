from typing import Any, Optional
import networkx as nx
from backend.app.schemas.analysis import (
    RecoveryPriorityResponse,
    RecoveryStep,
    ArchitecturalMitigation
)

def generate_recovery_plan(
    G: nx.DiGraph,
    node_states: dict[str, dict[str, Any]],
    topology_id: Optional[str] = None
) -> RecoveryPriorityResponse:
    """
    Computes optimal service recovery ordering and actionable architectural mitigations.
    Uses topological sorting of dependencies so foundational storage & broker layers
    recover before business logic and gateways, preventing cascading crash-loops.
    """
    failed_node_ids = set(
        nid for nid, s in node_states.items()
        if s.get("state") in ["FAILED", "FAILING", "DEGRADED", "CIRCUIT_OPEN"] and G.has_node(nid)
    )

    if not failed_node_ids:
        return RecoveryPriorityResponse(
            topology_id=topology_id,
            total_impacted_services=0,
            topological_recovery_plan=[],
            architectural_mitigations=[
                ArchitecturalMitigation(
                    id="mit-baseline",
                    title="Cluster Healthy",
                    target_component="Cluster",
                    pattern_type="BASELINE",
                    description="All services operating normally. Continue automated chaos verification.",
                    effort="LOW",
                    blast_radius_reduction_pct=0.0
                )
            ],
            recovery_summary="No recovery required: All infrastructure components are currently healthy."
        )

    recovery_steps: list[RecoveryStep] = []
    remaining_nodes = set(failed_node_ids)
    step_num = 1

    while remaining_nodes:
        # Find all nodes whose failed dependencies are already recovered
        ready_nodes = []
        for n in remaining_nodes:
            # Unrecovered dependencies that this node calls/depends on
            unrecovered_deps = [dep for dep in G.successors(n) if dep in remaining_nodes]
            if len(unrecovered_deps) == 0:
                ready_nodes.append(n)

        # If cyclic dependency exists among remaining, break cycle by picking highest priority
        if not ready_nodes:
            ready_nodes = [
                max(remaining_nodes, key=lambda x: G.nodes[x].get("business_criticality", 1.0))
            ]

        # Sort ready batch by business impact (revenue per min & business criticality)
        ready_nodes.sort(
            key=lambda x: (
                G.nodes[x].get("revenue_per_minute", 0.0),
                G.nodes[x].get("business_criticality", 1.0)
            ),
            reverse=True
        )

        for n in ready_nodes:
            nd = G.nodes[n]
            rev = nd.get("revenue_per_minute", 0.0)
            crit = nd.get("business_criticality", 5.0)
            tier = nd.get("tier", "business_logic")
            name = nd.get("name", n)

            callers_count = G.in_degree(n)
            priority_score = round(crit * 10.0 + (rev / 100.0) + callers_count * 5.0, 1)

            if crit >= 9.0 or rev >= 500.0:
                p_level = "P0_IMMEDIATE"
            elif crit >= 7.0 or rev >= 150.0:
                p_level = "P1_HIGH"
            elif crit >= 4.0:
                p_level = "P2_MEDIUM"
            else:
                p_level = "P3_NORMAL"

            # All impacted dependencies that this node depends on (that were part of the failure)
            deps_waited_for = [dep for dep in G.successors(n) if dep in failed_node_ids and dep != n]
            dep_names = [G.nodes[d].get("name", d) for d in deps_waited_for]

            reason = (
                f"Foundational component ({tier}) with {callers_count} dependent caller(s). "
                f"Recovering this unblocks upstream traffic."
                if not dep_names else
                f"Recover after dependent services ({', '.join(dep_names)}) are operational."
            )

            recovery_steps.append(RecoveryStep(
                step_order=step_num,
                node_id=n,
                node_name=name,
                tier=tier,
                priority_score=priority_score,
                priority_level=p_level,
                reason=reason,
                dependencies_to_wait_for=dep_names,
                revenue_recovered_per_minute=rev
            ))
            step_num += 1
            remaining_nodes.remove(n)

    # Generate Targeted Architectural Mitigations
    mitigations: list[ArchitecturalMitigation] = []
    seen_mitigations = set()

    for nid in failed_node_ids:
        nd = G.nodes[nid]
        name = nd.get("name", nid)
        node_type = nd.get("type", "service")

        # 1. Read Replica / Multi-AZ for single instance data stores
        if node_type == "database" and nd.get("replicas", 1) <= 1:
            key = f"db-replica-{nid}"
            if key not in seen_mitigations:
                seen_mitigations.add(key)
                mitigations.append(ArchitecturalMitigation(
                    id=key,
                    title=f"Multi-AZ Read Replica for {name}",
                    target_component=name,
                    pattern_type="READ_REPLICA",
                    description=(
                        f"Deploy an asynchronous read replica in a secondary availability zone "
                        f"with automated DNS health-check failover to eliminate SPOF."
                    ),
                    effort="MEDIUM",
                    blast_radius_reduction_pct=35.0
                ))

        # 2. Cache Layer for databases
        if node_type == "database" and not nd.get("has_fallback"):
            key = f"cache-{nid}"
            if key not in seen_mitigations:
                seen_mitigations.add(key)
                mitigations.append(ArchitecturalMitigation(
                    id=key,
                    title=f"Distributed Cache Layer in front of {name}",
                    target_component=name,
                    pattern_type="CACHE_LAYER",
                    description=(
                        f"Implement Redis/Memcached read-through cache for {name} to serve stale read requests "
                        f"during database restart or maintenance."
                    ),
                    effort="LOW",
                    blast_radius_reduction_pct=25.0
                ))

        # 3. Circuit Breaker on Callers
        for caller_id in G.predecessors(nid):
            caller_name = G.nodes[caller_id].get("name", caller_id)
            edge_data = G.get_edge_data(caller_id, nid) or {}
            cb = edge_data.get("circuit_breaker", {})
            if edge_data.get("is_sync", True) and not cb.get("enabled", False):
                key = f"cb-{caller_id}-{nid}"
                if key not in seen_mitigations:
                    seen_mitigations.add(key)
                    mitigations.append(ArchitecturalMitigation(
                        id=key,
                        title=f"Circuit Breaker: {caller_name} -> {name}",
                        target_component=caller_name,
                        pattern_type="CIRCUIT_BREAKER",
                        description=(
                            f"Wrap synchronous calls from '{caller_name}' to '{name}' in a circuit breaker. "
                            f"Trip open after 5 consecutive 5xx errors to prevent caller thread exhaustion."
                        ),
                        effort="LOW",
                        blast_radius_reduction_pct=30.0
                    ))

        # 4. Asynchronous Queue Decoupling
        if nd.get("tier") == "business_logic" and G.out_degree(nid) > 3:
            key = f"async-{nid}"
            if key not in seen_mitigations:
                seen_mitigations.add(key)
                mitigations.append(ArchitecturalMitigation(
                    id=key,
                    title=f"Decouple {name} via Event Queue",
                    target_component=name,
                    pattern_type="ASYNC_BUFFER",
                    description=(
                        f"Decouple '{name}' from secondary downstream consumers using Kafka or SQS to convert "
                        f"synchronous cascading bottlenecks into durable buffered streams."
                    ),
                    effort="MEDIUM",
                    blast_radius_reduction_pct=20.0
                ))

    summary = (
        f"Generated a {len(recovery_steps)}-step topological recovery plan. "
        f"Prioritizes restoring foundational persistence and broker tiers first, "
        f"safeguarding ${sum(s.revenue_recovered_per_minute for s in recovery_steps):,.2f}/min in potential revenue."
    )

    return RecoveryPriorityResponse(
        topology_id=topology_id,
        total_impacted_services=len(failed_node_ids),
        topological_recovery_plan=recovery_steps,
        architectural_mitigations=mitigations[:6],
        recovery_summary=summary
    )
