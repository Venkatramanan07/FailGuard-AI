from typing import Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from backend.app.api.deps import get_db
from backend.app.models.db_models import TopologyModel
from backend.app.engine.presets import PRESET_TOPOLOGIES
from backend.app.engine.graph_builder import build_networkx_graph
from backend.app.engine.criticality_analyzer import analyze_criticality
from backend.app.schemas.analysis import CriticalityAnalysisResponse
from backend.app.core.exceptions import TopologyNotFoundError

router = APIRouter(prefix="/architecture", tags=["Architecture Analysis & Validation"])

class CriticalityRequest(BaseModel):
    topology_id: Optional[str] = Field(default=None, max_length=100)
    nodes: Optional[list[dict[str, Any]]] = Field(default=None, max_length=300)
    edges: Optional[list[dict[str, Any]]] = Field(default=None, max_length=1000)

@router.post("/criticality", response_model=CriticalityAnalysisResponse)
async def analyze_topology_criticality(
    payload: CriticalityRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Performs NetworkX graph criticality analysis:
    - Articulation points / Cut vertices (SPOFs)
    - Cut edges (Bridges)
    - Betweenness centrality & PageRank metrics
    - Critical ingress-to-storage transaction paths
    - System baseline resilience index
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
    result = analyze_criticality(G, topology_id=payload.topology_id)
    return result
