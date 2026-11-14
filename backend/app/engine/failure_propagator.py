from typing import Any
import copy
import networkx as nx
from backend.app.engine.business_impact import calculate_business_impact

def run_failure_simulation(
    G: nx.DiGraph,
    injections: list[dict[str, Any]],
    options: dict[str, Any] | None = None
) -> dict[str, Any]:
    """
    Simulates discrete-time cascading failure propagation across the NetworkX infrastructure graph.
    Computes step-by-step timeline frames, blast radius %, health degradation,
    financial revenue loss, and mitigation actions.
    """
    if options is None:
        options = {}

    max_steps = options.get("max_propagation_depth", 5)
    enable_circuit_breakers = options.get("enable_circuit_breakers", True)
    enable_retry_storms = options.get("enable_retry_storms", True)

    total_nodes = G.number_of_nodes()
    if total_nodes == 0:
        return {
            "resilience_score": 100.0,
            "blast_radius_pct": 0.0,
            "total_affected_nodes": 0,
            "timeline_frames": [],
            "recommendations": [],
            "critical_path_impact": [],
            "business_impact": {
                "total_revenue_loss_per_minute": 0.0,
                "total_revenue_loss_per_hour": 0.0,
                "blast_radius_pct": 0.0,
                "total_services_impacted": 0,
                "critical_services_failed": 0,
                "high_revenue_services_down": [],
                "tier_degradation": [],
                "sla_breach_probability_pct": 0.0,
                "business_risk_level": "LOW"
            }
        }

    # Total system business weight
    total_system_weight = sum(G.nodes[n].get("business_criticality", 5.0) for n in G.nodes)
    if total_system_weight <= 0:
        total_system_weight = max(1.0, float(total_nodes))

    # Working state trackers
    node_states: dict[str, dict[str, Any]] = {}
    edge_states: dict[str, dict[str, Any]] = {}

    # Initialize baseline healthy states
    for nid in G.nodes:
        nd = G.nodes[nid]
        node_states[nid] = {
            "state": "HEALTHY",
            "error_rate": float(nd.get("metrics", {}).get("error_rate", 0.0)),
            "latency_ms": float(nd.get("metrics", {}).get("latency_p99_ms", 45.0)),
            "status_reason": "Operating normally within SLA."
        }

    for u, v, ed in G.edges(data=True):
        edge_id = ed.get("id", f"{u}->{v}")
        edge_states[edge_id] = {
            "state": "ACTIVE",
            "status_reason": "Normal operational throughput."
        }

    timeline_frames = []
    recommendation_candidates = set()
    critical_path_impact = []

    # -------------------------------------------------------------
    # Step 0: Inject direct failures
    # -------------------------------------------------------------
    step0_events = []
    newly_failing_nodes = set()

    for inj in injections:
        tgt_type = inj.get("target_type", "NODE").upper()
        tgt_id = str(inj.get("target_id", ""))
        failure_type = inj.get("failure_type", "NODE_CRASH").upper()
        params = inj.get("parameters", {})

        if tgt_type == "NODE" and G.has_node(tgt_id):
            nd = G.nodes[tgt_id]
            name = nd.get("name", tgt_id)
            if failure_type == "NODE_CRASH":
                node_states[tgt_id]["state"] = "FAILED"
                node_states[tgt_id]["error_rate"] = 1.0
                node_states[tgt_id]["latency_ms"] = 0.0
                node_states[tgt_id]["status_reason"] = f"Injected hard crash: Node {name} is completely unresponsive."
                step0_events.append(f"Injected hard crash on {name}")
                newly_failing_nodes.add(tgt_id)
            elif failure_type == "LATENCY_SPIKE":
                spike = float(params.get("latency_added_ms", 3500.0))
                node_states[tgt_id]["state"] = "DEGRADED"
                node_states[tgt_id]["latency_ms"] += spike
                node_states[tgt_id]["error_rate"] = 0.15
                node_states[tgt_id]["status_reason"] = f"Latency spike (+{spike}ms) injected on {name}."
                step0_events.append(f"Latency degradation on {name}")
                newly_failing_nodes.add(tgt_id)
            elif failure_type in ["RESOURCE_EXHAUSTION", "CONNECTION_POOL_EXHAUSTION"]:
                node_states[tgt_id]["state"] = "FAILING"
                node_states[tgt_id]["error_rate"] = 0.85
                node_states[tgt_id]["status_reason"] = f"Resource & thread pool exhaustion on {name}."
                step0_events.append(f"Resource exhaustion on {name}")
                newly_failing_nodes.add(tgt_id)
            elif failure_type == "RETRY_STORM":
                node_states[tgt_id]["state"] = "DEGRADED"
                node_states[tgt_id]["error_rate"] = 0.45
                node_states[tgt_id]["status_reason"] = f"Amplified retry storm hitting {name}."
                step0_events.append(f"Retry storm on {name}")
                newly_failing_nodes.add(tgt_id)

        elif tgt_type == "REGION":
            region_name = tgt_id
            for nid in G.nodes:
                if G.nodes[nid].get("region") == region_name:
                    node_states[nid]["state"] = "FAILED"
                    node_states[nid]["error_rate"] = 1.0
                    node_states[nid]["status_reason"] = f"Regional outage in {region_name}."
                    newly_failing_nodes.add(nid)
            step0_events.append(f"Total cloud blackout in region {region_name}")

        elif tgt_type == "EDGE":
            for u, v, ed in G.edges(data=True):
                eid = ed.get("id")
                if eid == tgt_id or f"{u}->{v}" == tgt_id:
                    edge_states[eid]["state"] = "SEVERED"
                    edge_states[eid]["status_reason"] = "Network partition: connection dropped."
                    step0_events.append(f"Network partition on edge {eid}")
                    newly_failing_nodes.add(u)

    def calc_metrics(states):
        failed_weight = sum(
            G.nodes[n].get("business_criticality", 5.0)
            for n, s in states.items()
            if s["state"] in ["FAILED", "FAILING"]
        )
        degraded_weight = sum(
            G.nodes[n].get("business_criticality", 5.0)
            for n, s in states.items()
            if s["state"] in ["DEGRADED", "CIRCUIT_OPEN"]
        )
        blast_pct = round((failed_weight + 0.5 * degraded_weight) / total_system_weight * 100, 1)
        health_pct = round(max(0.0, 100.0 - blast_pct), 1)
        return blast_pct, health_pct

    b0, h0 = calc_metrics(node_states)
    timeline_frames.append({
        "step": 0,
        "timestamp_relative_ms": 0,
        "event_description": " | ".join(step0_events) if step0_events else "Simulation initialized.",
        "node_states": copy.deepcopy(node_states),
        "edge_states": copy.deepcopy(edge_states),
        "system_health_pct": h0,
        "blast_radius_pct": b0
    })

    # -------------------------------------------------------------
    # Steps 1 .. max_steps: Discrete-Time Cascade Propagation
    # -------------------------------------------------------------
    active_cascade_set = newly_failing_nodes

    for step_num in range(1, max_steps + 1):
        step_events = []
        next_cascade_set = set()

        for failing_node_id in list(active_cascade_set):
            failing_data = G.nodes[failing_node_id]
            failing_name = failing_data.get("name", failing_node_id)

            # Inbound callers (u -> failing_node_id)
            for caller_id in G.predecessors(failing_node_id):
                caller_data = G.nodes[caller_id]
                caller_name = caller_data.get("name", caller_id)
                edge_data = G.edges[caller_id, failing_node_id]
                edge_id = edge_data.get("id", f"{caller_id}->{failing_node_id}")
                is_sync = edge_data.get("is_sync", True)
                cb_config = edge_data.get("circuit_breaker", {})
                cb_enabled = enable_circuit_breakers and (cb_config.get("enabled", False) or caller_data.get("has_circuit_breaker", False))
                has_fallback = caller_data.get("has_fallback", False)
                fallback_behavior = caller_data.get("fallback_behavior", "none")

                if node_states[caller_id]["state"] == "FAILED":
                    continue

                if is_sync:
                    # Synchronous dependency failed
                    if cb_enabled:
                        edge_states[edge_id]["state"] = "CIRCUIT_OPEN"
                        edge_states[edge_id]["status_reason"] = (
                            f"Circuit Breaker TRIPPED: Failing calls to {failing_name} halted to prevent thread exhaustion."
                        )

                        if has_fallback and fallback_behavior in ["serve_cache", "graceful_degrade"]:
                            node_states[caller_id]["state"] = "DEGRADED"
                            node_states[caller_id]["status_reason"] = (
                                f"{caller_name} gracefully degraded (serving fallback/cache) while {failing_name} is down."
                            )
                            step_events.append(f"Circuit breaker isolated {failing_name} for {caller_name}; fallback engaged.")
                        else:
                            node_states[caller_id]["state"] = "DEGRADED"
                            node_states[caller_id]["error_rate"] = min(1.0, node_states[caller_id]["error_rate"] + 0.35)
                            node_states[caller_id]["status_reason"] = (
                                f"{caller_name} returning fast fail (503) due to open circuit breaker on {failing_name}."
                            )
                            step_events.append(f"Fast fail on {caller_name} via open circuit to {failing_name}.")
                    else:
                        # NO Circuit Breaker! Thread pool exhausts waiting on timeout
                        timeout = caller_data.get("timeout_ms", 2000)
                        replicas = caller_data.get("replicas", 1)

                        if replicas > 1 and caller_data.get("redundancy_type") != "none" and step_num == 1:
                            node_states[caller_id]["state"] = "DEGRADED"
                            node_states[caller_id]["latency_ms"] += (timeout * 0.5)
                            node_states[caller_id]["error_rate"] = 0.40
                            node_states[caller_id]["status_reason"] = (
                                f"Replicas absorbing partial timeout from {failing_name}, but connection pool is degrading."
                            )
                            step_events.append(f"Partial degradation on {caller_name} due to {failing_name} timeout.")
                            next_cascade_set.add(caller_id)
                        else:
                            node_states[caller_id]["state"] = "FAILING"
                            node_states[caller_id]["latency_ms"] += timeout
                            node_states[caller_id]["error_rate"] = 0.90
                            node_states[caller_id]["status_reason"] = (
                                f"Cascading failure: Thread starvation & connection timeout calling {failing_name} without circuit breaker."
                            )
                            edge_states[edge_id]["state"] = "SEVERED"
                            edge_states[edge_id]["status_reason"] = "Connection timed out."
                            step_events.append(f"Cascading failure propagated from {failing_name} to {caller_name}!")
                            next_cascade_set.add(caller_id)
                            critical_path_impact.append(f"{caller_name} -> {failing_name}")

                            recommendation_candidates.add(
                                f"Install Circuit Breaker with fallback cache between '{caller_name}' and '{failing_name}' to stop cascading thread pool exhaustion."
                            )
                else:
                    # Asynchronous dependency (e.g. Kafka / SQS queue)
                    if node_states[caller_id]["state"] == "HEALTHY":
                        node_states[caller_id]["state"] = "DEGRADED"
                        node_states[caller_id]["status_reason"] = (
                            f"Queue buffer absorbing failure of {failing_name}. Backpressure warning."
                        )
                        step_events.append(f"Async queue decoupled {caller_name} from {failing_name} failure.")

            # Also check downstream consumers if failing node was an async message queue/bus
            if failing_data.get("type") in ["queue", "broker"]:
                for consumer_id in G.successors(failing_node_id):
                    if node_states[consumer_id]["state"] != "FAILED":
                        node_states[consumer_id]["state"] = "DEGRADED"
                        node_states[consumer_id]["status_reason"] = (
                            f"Starved of incoming event stream from queue {failing_name}."
                        )
                        step_events.append(f"Event consumer {G.nodes[consumer_id].get('name', consumer_id)} starved.")
                        next_cascade_set.add(consumer_id)

        active_cascade_set = next_cascade_set
        b_step, h_step = calc_metrics(node_states)

        timeline_frames.append({
            "step": step_num,
            "timestamp_relative_ms": step_num * 500,
            "event_description": " | ".join(step_events) if step_events else "Cascade propagation stabilized.",
            "node_states": copy.deepcopy(node_states),
            "edge_states": copy.deepcopy(edge_states),
            "system_health_pct": h_step,
            "blast_radius_pct": b_step
        })

        if not active_cascade_set:
            break

    final_blast_pct, final_health_pct = calc_metrics(node_states)
    total_affected = sum(1 for s in node_states.values() if s["state"] != "HEALTHY")

    recommendations_list = list(recommendation_candidates)
    for nid, s in node_states.items():
        if s["state"] in ["FAILED", "FAILING"]:
            nd = G.nodes[nid]
            if nd.get("replicas", 1) <= 1 and nd.get("redundancy_type") == "none":
                recommendations_list.append(
                    f"Provision multi-AZ high availability replicas for single-instance service '{nd.get('name', nid)}'."
                )
            if nd.get("type") == "database" and not nd.get("has_fallback"):
                recommendations_list.append(
                    f"Deploy a distributed Redis cache layer in front of '{nd.get('name', nid)}' to handle read requests during primary DB downtime."
                )

    if not recommendations_list:
        recommendations_list.append("Architecture demonstrates high resilience against the simulated failure scenario.")

    resilience_score = max(5.0, round(100.0 - final_blast_pct, 1))

    # Calculate business impact metrics
    business_impact = calculate_business_impact(G, node_states)

    return {
        "resilience_score": resilience_score,
        "blast_radius_pct": final_blast_pct,
        "total_affected_nodes": total_affected,
        "timeline_frames": timeline_frames,
        "recommendations": recommendations_list[:5],
        "critical_path_impact": list(set(critical_path_impact)),
        "business_impact": business_impact.model_dump()
    }
