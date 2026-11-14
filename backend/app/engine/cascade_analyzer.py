from typing import Any
import networkx as nx

def analyze_graph_topology(G: nx.DiGraph) -> dict[str, Any]:
    """
    Performs static graph theoretical analysis on the infrastructure topology.
    Identifies SPOFs, cyclic dependency deadlocks, bottlenecks, and baseline resilience.
    """
    total_nodes = G.number_of_nodes()
    total_edges = G.number_of_edges()

    if total_nodes == 0:
        return {
            "total_nodes": 0,
            "total_edges": 0,
            "spofs": [],
            "cycles": [],
            "bottlenecks": [],
            "baseline_resilience_score": 100.0,
            "summary": "Graph is empty."
        }

    # 1. Detect Single Points of Failure (Articulation Points on undirected graph)
    U = G.to_undirected()
    try:
        raw_cut_vertices = list(nx.articulation_points(U))
    except Exception:
        raw_cut_vertices = []

    spofs = []
    for node_id in raw_cut_vertices:
        node_data = G.nodes[node_id]
        replicas = node_data.get("replicas", 1)
        redundancy = node_data.get("redundancy_type", "none")
        has_fallback = node_data.get("has_fallback", False)

        # It's an acute SPOF if it has no redundancy / failover
        is_acute = (replicas <= 1 and redundancy == "none" and not has_fallback)
        spofs.append({
            "node_id": node_id,
            "node_name": node_data.get("name", node_id),
            "tier": node_data.get("tier", "unknown"),
            "severity": "CRITICAL" if is_acute else "MEDIUM",
            "impact_reason": (
                "Single point of failure with no redundant replicas or failover. "
                "Its failure fragments the network into disconnected partitions."
                if is_acute else
                "Structural articulation point, partially mitigated by redundancy or failover."
            )
        })

    # 2. Detect Dangerous Circular Dependencies
    try:
        # Limit to first 20 simple cycles to avoid factorial blowup in dense graphs
        raw_cycles = []
        for i, c in enumerate(nx.simple_cycles(G)):
            raw_cycles.append(c)
            if i >= 15:
                break
    except Exception:
        raw_cycles = []

    # 3. Detect Critical Bottlenecks (Betweenness Centrality)
    try:
        betweenness = nx.betweenness_centrality(G)
        sorted_bottlenecks = sorted(betweenness.items(), key=lambda x: x[1], reverse=True)[:5]
        bottlenecks = [
            {
                "node_id": nid,
                "node_name": G.nodes[nid].get("name", nid),
                "centrality_score": round(score, 3),
                "in_degree": G.in_degree(nid),
                "out_degree": G.out_degree(nid)
            }
            for nid, score in sorted_bottlenecks if score > 0.1
        ]
    except Exception:
        bottlenecks = []

    # 4. Calculate Baseline Resilience Score (0 - 100)
    redundant_nodes_count = sum(
        1 for _, d in G.nodes(data=True)
        if d.get("replicas", 1) > 1 or d.get("redundancy_type") != "none" or d.get("has_fallback")
    )
    redundancy_ratio = redundant_nodes_count / max(1, total_nodes)

    cb_edges_count = sum(
        1 for _, _, d in G.edges(data=True)
        if d.get("circuit_breaker", {}).get("enabled", False)
    )
    cb_ratio = cb_edges_count / max(1, total_edges)

    acute_spof_count = sum(1 for s in spofs if s["severity"] == "CRITICAL")
    cycles_count = len(raw_cycles)

    # Score calculation
    base_score = 70.0
    base_score += (redundancy_ratio * 20.0)
    base_score += (cb_ratio * 15.0)
    base_score -= (acute_spof_count * 12.0)
    base_score -= (cycles_count * 8.0)
    baseline_resilience_score = max(5.0, min(99.0, round(base_score, 1)))

    summary = (
        f"Analyzed {total_nodes} services and {total_edges} connections. "
        f"Found {len(spofs)} structural articulation points ({acute_spof_count} critical SPOFs) "
        f"and {cycles_count} cyclic dependency paths."
    )

    return {
        "total_nodes": total_nodes,
        "total_edges": total_edges,
        "spofs": spofs,
        "cycles": raw_cycles,
        "bottlenecks": bottlenecks,
        "baseline_resilience_score": baseline_resilience_score,
        "summary": summary
    }
