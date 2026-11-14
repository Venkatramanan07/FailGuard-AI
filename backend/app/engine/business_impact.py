from typing import Any
import networkx as nx
from backend.app.schemas.analysis import (
    BusinessImpactResponse,
    TierDegradation,
    ImpactedServiceRevenue
)

def calculate_business_impact(
    G: nx.DiGraph,
    node_states: dict[str, dict[str, Any]]
) -> BusinessImpactResponse:
    """
    Calculates quantified financial, tier, and blast radius business impact
    based on the current simulation state of each node in the dependency graph.
    """
    total_nodes = G.number_of_nodes()
    if total_nodes == 0:
        return BusinessImpactResponse(
            total_revenue_loss_per_minute=0.0,
            total_revenue_loss_per_hour=0.0,
            blast_radius_pct=0.0,
            total_services_impacted=0,
            critical_services_failed=0,
            high_revenue_services_down=[],
            tier_degradation=[],
            sla_breach_probability_pct=0.0,
            business_risk_level="LOW"
        )

    total_revenue_loss_per_min = 0.0
    total_system_criticality = sum(G.nodes[n].get("business_criticality", 5.0) for n in G.nodes)
    impacted_criticality = 0.0
    services_impacted_count = 0
    critical_failed_count = 0
    high_revenue_down = []

    # Tier tracking: presentation, business_logic, data_store, infrastructure
    tier_stats: dict[str, dict[str, int]] = {
        "presentation": {"total": 0, "healthy": 0, "degraded": 0, "failed": 0},
        "business_logic": {"total": 0, "healthy": 0, "degraded": 0, "failed": 0},
        "data_store": {"total": 0, "healthy": 0, "degraded": 0, "failed": 0},
        "infrastructure": {"total": 0, "healthy": 0, "degraded": 0, "failed": 0},
    }

    for nid in G.nodes:
        nd = G.nodes[nid]
        tier = nd.get("tier", "business_logic")
        if tier not in tier_stats:
            tier_stats[tier] = {"total": 0, "healthy": 0, "degraded": 0, "failed": 0}

        tier_stats[tier]["total"] += 1
        curr_state = node_states.get(nid, {}).get("state", "HEALTHY")
        crit = nd.get("business_criticality", 5.0)
        rev_rate = nd.get("revenue_per_minute", 0.0)
        name = nd.get("name", nid)

        if curr_state in ["FAILED", "FAILING"]:
            tier_stats[tier]["failed"] += 1
            services_impacted_count += 1
            impacted_criticality += crit
            total_revenue_loss_per_min += rev_rate
            if crit >= 8.0:
                critical_failed_count += 1
            if rev_rate > 200.0:
                high_revenue_down.append(name)
        elif curr_state in ["DEGRADED", "CIRCUIT_OPEN"]:
            tier_stats[tier]["degraded"] += 1
            services_impacted_count += 1
            impacted_criticality += (crit * 0.5)
            # Partial revenue loss under degraded latency or open circuit fast-fail
            loss_factor = 0.15 if nd.get("has_fallback") else 0.45
            total_revenue_loss_per_min += (rev_rate * loss_factor)
        else:
            tier_stats[tier]["healthy"] += 1

    blast_radius_pct = round((impacted_criticality / max(1.0, total_system_criticality)) * 100, 1)
    revenue_loss_per_hour = round(total_revenue_loss_per_min * 60, 2)
    total_revenue_loss_per_min = round(total_revenue_loss_per_min, 2)

    tier_degradation_list: list[TierDegradation] = []
    for t_name, counts in tier_stats.items():
        if counts["total"] > 0:
            deg_pct = round(((counts["failed"] + 0.5 * counts["degraded"]) / counts["total"]) * 100, 1)
            tier_degradation_list.append(TierDegradation(
                tier=t_name,
                total_nodes=counts["total"],
                healthy_nodes=counts["healthy"],
                degraded_nodes=counts["degraded"],
                failed_nodes=counts["failed"],
                degradation_pct=deg_pct
            ))

    # SLA Breach Probability Estimation
    sla_breach_probability = min(99.9, round(blast_radius_pct * 1.3, 1))

    # Business risk categorization
    if blast_radius_pct > 60.0 or critical_failed_count >= 2:
        risk_level = "CATASTROPHIC"
    elif blast_radius_pct > 30.0 or critical_failed_count >= 1:
        risk_level = "HIGH"
    elif blast_radius_pct > 10.0:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return BusinessImpactResponse(
        total_revenue_loss_per_minute=total_revenue_loss_per_min,
        total_revenue_loss_per_hour=revenue_loss_per_hour,
        blast_radius_pct=blast_radius_pct,
        total_services_impacted=services_impacted_count,
        critical_services_failed=critical_failed_count,
        high_revenue_services_down=high_revenue_down,
        tier_degradation=tier_degradation_list,
        sla_breach_probability_pct=sla_breach_probability,
        business_risk_level=risk_level
    )
