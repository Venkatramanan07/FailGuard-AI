from typing import Any, Optional
import networkx as nx
from backend.app.schemas.analysis import (
    CriticalityAnalysisResponse,
    SPOFDetail,
    BridgeDetail,
    CentralityMetrics,
    CriticalPath
)

def analyze_criticality(G: nx.DiGraph, topology_id: Optional[str] = None) -> CriticalityAnalysisResponse:
    """
    Performs comprehensive graph-theoretic criticality and bottleneck analysis:
    - Cut vertices (SPOFs) via Tarjan's bridge/articulation points algorithm
    - Cut edges (Bridges)
    - Single-instance un-replicated persistence stores
    - Betweenness centrality & PageRank scoring
    - In-degree & Out-degree dependencies
    - Longest synchronous critical latency paths
    - System baseline resilience index
    """
    total_nodes = G.number_of_nodes()
    total_edges = G.number_of_edges()

    if total_nodes == 0:
        return CriticalityAnalysisResponse(
            topology_id=topology_id,
            baseline_resilience_score=100.0,
            spofs=[],
            bridges=[],
            bottlenecks=[],
            critical_paths=[],
            summary="Empty graph: No components to analyze."
        )

    # 1. Articulation Points & Architectural SPOFs
    U = G.to_undirected()
    try:
        raw_cut_vertices = set(nx.articulation_points(U))
    except Exception:
        raw_cut_vertices = set()

    # In distributed systems, single-instance un-replicated databases are functional SPOFs
    # even when topological leaves (degree 1)
    spof_node_ids = set(raw_cut_vertices)
    for nid in G.nodes:
        nd = G.nodes[nid]
        if nd.get("type") in ["database", "third_party"] and nd.get("replicas", 1) <= 1 and nd.get("redundancy_type") == "none":
            spof_node_ids.add(nid)

    spofs: list[SPOFDetail] = []
    for nid in spof_node_ids:
        nd = G.nodes[nid]
        replicas = nd.get("replicas", 1)
        redundancy = nd.get("redundancy_type", "none")
        has_fb = nd.get("has_fallback", False)
        is_acute = (replicas <= 1 and redundancy == "none" and not has_fb)

        spofs.append(SPOFDetail(
            node_id=nid,
            node_name=nd.get("name", nid),
            tier=nd.get("tier", "unknown"),
            cloud_provider=nd.get("cloud_provider", "aws"),
            region=nd.get("region", "us-east-1"),
            business_criticality=nd.get("business_criticality", 5.0),
            revenue_per_minute=nd.get("revenue_per_minute", 0.0),
            severity="CRITICAL" if is_acute else "MEDIUM",
            impact_reason=(
                "Single point of failure with no redundant replicas or failover. "
                "Its failure fragments the network or knocks out downstream transactional capabilities."
                if is_acute else
                "Structural articulation point, partially mitigated by redundancy or failover."
            )
        ))

    # Sort SPOFs by acute severity, then business criticality, then revenue
    spofs.sort(key=lambda s: (s.severity == "CRITICAL", s.business_criticality, s.revenue_per_minute), reverse=True)

    # 2. Bridges (Cut Edges)
    try:
        raw_bridges = list(nx.bridges(U))
    except Exception:
        raw_bridges = []

    bridges: list[BridgeDetail] = []
    for u, v in raw_bridges:
        edge_data = G.get_edge_data(u, v) or G.get_edge_data(v, u) or {}
        edge_id = edge_data.get("id", f"{u}->{v}")
        src_name = G.nodes[u].get("name", u)
        tgt_name = G.nodes[v].get("name", v)

        bridges.append(BridgeDetail(
            edge_id=edge_id,
            source_id=u,
            source_name=src_name,
            target_id=v,
            target_name=tgt_name,
            protocol=edge_data.get("protocol", "http_rest"),
            is_sync=edge_data.get("is_sync", True),
            impact_reason="Structural bridge: Severing this edge isolates downstream services."
        ))

    # 3. Centrality Metrics (Betweenness & PageRank)
    try:
        betweenness = nx.betweenness_centrality(G)
    except Exception:
        betweenness = {n: 0.0 for n in G.nodes}

    try:
        pagerank = nx.pagerank(G, alpha=0.85)
    except Exception:
        pagerank = {n: 0.0 for n in G.nodes}

    bottlenecks: list[CentralityMetrics] = []
    for nid in G.nodes:
        nd = G.nodes[nid]
        bottlenecks.append(CentralityMetrics(
            node_id=nid,
            node_name=nd.get("name", nid),
            tier=nd.get("tier", "business_logic"),
            betweenness_centrality=round(betweenness.get(nid, 0.0), 4),
            pagerank_score=round(pagerank.get(nid, 0.0), 4),
            in_degree=G.in_degree(nid),
            out_degree=G.out_degree(nid),
            is_spof=(nid in spof_node_ids)
        ))

    bottlenecks.sort(key=lambda b: (b.betweenness_centrality, b.pagerank_score), reverse=True)

    # 4. Critical Ingress-to-Storage Synchronous Paths
    gateways = [n for n in G.nodes if G.nodes[n].get("type") == "gateway" or G.in_degree(n) == 0]
    data_stores = [n for n in G.nodes if G.nodes[n].get("type") in ["database", "third_party"]]

    critical_paths: list[CriticalPath] = []
    for gw in gateways:
        for ds in data_stores:
            try:
                for p in nx.all_simple_paths(G, source=gw, target=ds, cutoff=6):
                    total_latency = 0.0
                    all_cb = True
                    for i in range(len(p) - 1):
                        ed = G.get_edge_data(p[i], p[i+1]) or {}
                        total_latency += ed.get("health_threshold_ms", 100)
                        if not ed.get("circuit_breaker", {}).get("enabled", False):
                            all_cb = False

                    names = [G.nodes[n].get("name", n) for n in p]
                    critical_paths.append(CriticalPath(
                        path=p,
                        path_names=names,
                        total_baseline_latency_ms=total_latency,
                        has_circuit_breakers=all_cb,
                        description=f"Critical path from '{names[0]}' to '{names[-1]}' across {len(p)} hops."
                    ))
                    if len(critical_paths) >= 5:
                        break
            except Exception:
                pass

    # 5. Baseline Resilience Score Calculation
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

    acute_spof_count = sum(1 for s in spofs if s.severity == "CRITICAL")

    base_score = 75.0
    base_score += (redundancy_ratio * 20.0)
    base_score += (cb_ratio * 15.0)
    base_score -= (acute_spof_count * 10.0)
    baseline_resilience_score = max(5.0, min(99.0, round(base_score, 1)))

    summary = (
        f"Criticality analysis evaluated {total_nodes} nodes and {total_edges} edges. "
        f"Identified {len(spofs)} SPOF(s) ({acute_spof_count} acute), {len(bridges)} bridge(s), "
        f"and {len(critical_paths)} core transaction paths."
    )

    return CriticalityAnalysisResponse(
        topology_id=topology_id,
        baseline_resilience_score=baseline_resilience_score,
        spofs=spofs,
        bridges=bridges,
        bottlenecks=bottlenecks[:10],
        critical_paths=critical_paths[:5],
        summary=summary
    )
