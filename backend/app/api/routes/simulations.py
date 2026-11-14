from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.api.deps import get_db
from backend.app.models.db_models import SimulationRunModel, TopologyModel
from backend.app.schemas.simulation import (
    SimulationRunRequest,
    SimulationRunResponse,
    QuickBlastRequest,
    QuickBlastResponse
)
from backend.app.engine.presets import PRESET_TOPOLOGIES
from backend.app.engine.graph_builder import build_networkx_graph
from backend.app.engine.failure_propagator import run_failure_simulation
from backend.app.core.exceptions import TopologyNotFoundError, NodeNotFoundError

router = APIRouter(prefix="/simulations", tags=["Simulations"])

@router.post("/run", response_model=SimulationRunResponse)
async def execute_simulation(payload: SimulationRunRequest, db: AsyncSession = Depends(get_db)):
    """
    Executes a discrete-time cascading failure simulation using the NetworkX graph engine.
    Computes step-by-step timeline frames, blast radius, health degradation, financial revenue loss, and mitigation actions.
    Supports both saved topologies and active live canvas drafts.
    """
    nodes_data = payload.nodes
    edges_data = payload.edges

    # If nodes/edges not provided inline, load from topology
    if not nodes_data and payload.topology_id:
        for preset in PRESET_TOPOLOGIES:
            if preset["id"] == payload.topology_id:
                nodes_data = preset.get("nodes", [])
                edges_data = preset.get("edges", [])
                break

        if not nodes_data:
            result = await db.execute(select(TopologyModel).where(TopologyModel.id == payload.topology_id))
            topo = result.scalar_one_or_none()
            if not topo:
                raise TopologyNotFoundError(payload.topology_id)
            nodes_data = topo.nodes
            edges_data = topo.edges

    if not nodes_data:
        raise TopologyNotFoundError("No nodes provided for simulation")

    # Build NetworkX directed graph
    G = build_networkx_graph(nodes_data, edges_data or [])

    # Validate target node exists for node injections
    for inj in payload.injections:
        if inj.target_type == "NODE" and not G.has_node(inj.target_id):
            raise NodeNotFoundError(inj.target_id, topology_id=payload.topology_id)

    # Run discrete-time simulation
    injections_dicts = [inj.model_dump() for inj in payload.injections]
    sim_result = run_failure_simulation(
        G,
        injections=injections_dicts,
        options=payload.options.model_dump()
    )

    # Persist simulation run
    sim_record = SimulationRunModel(
        topology_id=payload.topology_id or "live-canvas",
        scenario_name=payload.scenario_name,
        injections=injections_dicts,
        resilience_score=sim_result["resilience_score"],
        blast_radius_pct=sim_result["blast_radius_pct"],
        total_affected_nodes=sim_result["total_affected_nodes"],
        timeline_frames=sim_result["timeline_frames"],
        recommendations=sim_result["recommendations"]
    )
    db.add(sim_record)
    await db.commit()
    await db.refresh(sim_record)

    return SimulationRunResponse(
        simulation_id=sim_record.id,
        topology_id=sim_record.topology_id,
        scenario_name=sim_record.scenario_name,
        resilience_score=sim_result["resilience_score"],
        blast_radius_pct=sim_result["blast_radius_pct"],
        total_affected_nodes=sim_result["total_affected_nodes"],
        timeline_frames=sim_result["timeline_frames"],
        recommendations=sim_result["recommendations"],
        critical_path_impact=sim_result["critical_path_impact"],
        business_impact=sim_result.get("business_impact"),
        created_at=sim_record.created_at.isoformat()
    )

@router.post("/quick-blast", response_model=QuickBlastResponse)
async def quick_blast_analysis(payload: QuickBlastRequest):
    """
    Computes single-node instant blast radius and affected upstream/downstream dependencies.
    Used for instant node inspection without saving a full simulation run.
    """
    G = build_networkx_graph(payload.nodes, payload.edges)
    target = payload.target_node_id

    if not G.has_node(target):
        raise NodeNotFoundError(target)

    # Inbound callers (upstream services that call this target)
    direct_callers = list(G.predecessors(target))
    # Downstream dependencies (services this target calls)
    downstream_dependencies = list(G.successors(target))

    # All upstream reachable ancestors (all services that directly or indirectly call target)
    try:
        import networkx as nx
        ancestors = list(nx.ancestors(G, target))
    except Exception:
        ancestors = direct_callers

    total_weight = sum(G.nodes[n].get("business_criticality", 5.0) for n in G.nodes)
    impacted_nodes = set([target] + direct_callers)
    impacted_weight = sum(G.nodes[n].get("business_criticality", 5.0) for n in impacted_nodes if G.has_node(n))

    blast_radius_pct = round((impacted_weight / max(1.0, total_weight)) * 100, 1)
    resilience_score = max(10.0, round(100.0 - blast_radius_pct, 1))

    target_name = G.nodes[target].get("name", target)
    recommendations = []
    if not G.nodes[target].get("has_circuit_breaker"):
        recommendations.append(f"Implement circuit breaker pattern for callers of '{target_name}'.")
    if G.nodes[target].get("replicas", 1) <= 1:
        recommendations.append(f"Scale '{target_name}' to at least 2 replicas across multiple availability zones.")

    return QuickBlastResponse(
        target_node_id=target,
        blast_radius_pct=blast_radius_pct,
        direct_dependents=direct_callers,
        downstream_impacted=downstream_dependencies,
        upstream_affected=ancestors,
        resilience_score=resilience_score,
        severity="HIGH" if blast_radius_pct > 40 else ("MEDIUM" if blast_radius_pct > 15 else "LOW"),
        recommendations=recommendations or ["Node has adequate redundancy and isolation."]
    )

@router.get("/{simulation_id}")
async def get_simulation(simulation_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve detailed playback frames and metrics of a previous simulation run."""
    result = await db.execute(select(SimulationRunModel).where(SimulationRunModel.id == simulation_id))
    sim = result.scalar_one_or_none()
    if not sim:
        raise TopologyNotFoundError(f"Simulation run '{simulation_id}' not found")

    return {
        "simulation_id": sim.id,
        "topology_id": sim.topology_id,
        "scenario_name": sim.scenario_name,
        "injections": sim.injections,
        "resilience_score": sim.resilience_score,
        "blast_radius_pct": sim.blast_radius_pct,
        "total_affected_nodes": sim.total_affected_nodes,
        "timeline_frames": sim.timeline_frames,
        "recommendations": sim.recommendations,
        "created_at": sim.created_at.isoformat() if sim.created_at else None
    }
