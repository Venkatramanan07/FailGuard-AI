from typing import Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from backend.app.api.deps import get_db
from backend.app.models.db_models import TopologyModel
from backend.app.engine.presets import PRESET_TOPOLOGIES
from backend.app.engine.graph_builder import build_networkx_graph
from backend.app.engine.failure_propagator import run_failure_simulation
from backend.app.engine.recovery_prioritizer import generate_recovery_plan
from backend.app.schemas.analysis import RecoveryPriorityResponse
from backend.app.schemas.simulation import FailureInjection
from backend.app.core.exceptions import TopologyNotFoundError

router = APIRouter(prefix="/architecture", tags=["Architecture Analysis & Validation"])

class RecoveryPlanRequest(BaseModel):
    topology_id: Optional[str] = Field(default=None, max_length=100)
    nodes: Optional[list[dict[str, Any]]] = Field(default=None, max_length=300)
    edges: Optional[list[dict[str, Any]]] = Field(default=None, max_length=1000)
    injections: list[FailureInjection] = Field(default_factory=list, max_length=20)

@router.post("/recovery-priorities", response_model=RecoveryPriorityResponse)
async def get_recovery_priorities(
    payload: RecoveryPlanRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Computes topological recovery sequencing and architectural mitigations
    for impacted services in the dependency graph.
    """
    nodes_data = payload.nodes
    edges_data = payload.edges

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

    nodes_data = nodes_data or []
    edges_data = edges_data or []

    G = build_networkx_graph(nodes_data, edges_data)

    # If failure injections are specified, simulate to find impacted states
    injections = [inj.model_dump() for inj in payload.injections]
    if injections:
        sim_res = run_failure_simulation(G, injections)
        last_frame = sim_res["timeline_frames"][-1] if sim_res["timeline_frames"] else {}
        node_states = last_frame.get("node_states", {})
    else:
        # Default: check current node states or mock leaf/spof failure if graph is healthy
        node_states = {n: {"state": G.nodes[n].get("state", "HEALTHY")} for n in G.nodes}
        # If all nodes are healthy, pick the primary data store / SPOF to demonstrate plan
        if all(s["state"] == "HEALTHY" for s in node_states.values()) and G.number_of_nodes() > 0:
            spof_cand = [n for n in G.nodes if G.nodes[n].get("type") in ["database", "service"]]
            if spof_cand:
                sim_res = run_failure_simulation(G, [{"target_type": "NODE", "target_id": spof_cand[0], "failure_type": "NODE_CRASH"}])
                last_frame = sim_res["timeline_frames"][-1]
                node_states = last_frame.get("node_states", {})

    recovery_plan = generate_recovery_plan(G, node_states, topology_id=payload.topology_id)
    return recovery_plan
