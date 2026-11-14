from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.api.deps import get_db
from backend.app.models.db_models import TopologyModel
from backend.app.schemas.topology import (
    TopologyCreate,
    TopologyUpdate
)
from backend.app.engine.presets import PRESET_TOPOLOGIES
from backend.app.engine.graph_builder import build_networkx_graph
from backend.app.engine.cascade_analyzer import analyze_graph_topology
from backend.app.core.exceptions import TopologyNotFoundError, PresetProtectedError

router = APIRouter(prefix="/topologies", tags=["Topologies"])

@router.get("/presets")
async def get_presets():
    """Retrieve pre-configured industry benchmark architectures."""
    return PRESET_TOPOLOGIES

@router.get("")
async def list_topologies(db: AsyncSession = Depends(get_db)):
    """List all saved topologies in the database."""
    result = await db.execute(select(TopologyModel).order_by(TopologyModel.updated_at.desc()))
    records = result.scalars().all()
    
    topos = []
    for r in records:
        topos.append({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "category": r.category,
            "is_preset": r.is_preset,
            "tags": r.tags,
            "node_count": len(r.nodes),
            "edge_count": len(r.edges),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None
        })
    return topos

@router.get("/{topology_id}")
async def get_topology(topology_id: str, db: AsyncSession = Depends(get_db)):
    """Get full details and nodes/edges for a specific topology."""
    # Check presets first
    for preset in PRESET_TOPOLOGIES:
        if preset["id"] == topology_id:
            return preset

    result = await db.execute(select(TopologyModel).where(TopologyModel.id == topology_id))
    topo = result.scalar_one_or_none()
    if not topo:
        raise TopologyNotFoundError(topology_id)

    return {
        "id": topo.id,
        "name": topo.name,
        "description": topo.description,
        "category": topo.category,
        "is_preset": topo.is_preset,
        "tags": topo.tags,
        "nodes": topo.nodes,
        "edges": topo.edges,
        "meta": topo.meta,
        "created_at": topo.created_at.isoformat() if topo.created_at else None,
        "updated_at": topo.updated_at.isoformat() if topo.updated_at else None
    }

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_topology(payload: TopologyCreate, db: AsyncSession = Depends(get_db)):
    """Create a new topology graph."""
    record = TopologyModel(
        name=payload.name,
        description=payload.description or "",
        category=payload.category or "custom",
        is_preset=0,
        tags=payload.tags,
        nodes=[n.model_dump() for n in payload.nodes],
        edges=[e.model_dump() for e in payload.edges],
        meta=payload.meta or {}
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "id": record.id,
        "name": record.name,
        "description": record.description,
        "category": record.category,
        "is_preset": record.is_preset,
        "tags": record.tags,
        "nodes": record.nodes,
        "edges": record.edges,
        "meta": record.meta,
        "created_at": record.created_at.isoformat(),
        "updated_at": record.updated_at.isoformat()
    }

@router.put("/{topology_id}")
async def update_topology(topology_id: str, payload: TopologyUpdate, db: AsyncSession = Depends(get_db)):
    """Update nodes, edges, or metadata of an existing topology."""
    result = await db.execute(select(TopologyModel).where(TopologyModel.id == topology_id))
    topo = result.scalar_one_or_none()
    if not topo:
        raise TopologyNotFoundError(topology_id)
    if topo.is_preset:
        raise PresetProtectedError(topology_id)

    if payload.name is not None:
        topo.name = payload.name
    if payload.description is not None:
        topo.description = payload.description
    if payload.category is not None:
        topo.category = payload.category
    if payload.tags is not None:
        topo.tags = payload.tags
    if payload.nodes is not None:
        topo.nodes = [n.model_dump() for n in payload.nodes]
    if payload.edges is not None:
        topo.edges = [e.model_dump() for e in payload.edges]
    if payload.meta is not None:
        topo.meta = payload.meta

    await db.commit()
    await db.refresh(topo)
    return {
        "id": topo.id,
        "name": topo.name,
        "description": topo.description,
        "category": topo.category,
        "is_preset": topo.is_preset,
        "tags": topo.tags,
        "nodes": topo.nodes,
        "edges": topo.edges,
        "meta": topo.meta,
        "created_at": topo.created_at.isoformat(),
        "updated_at": topo.updated_at.isoformat()
    }

@router.delete("/{topology_id}")
async def delete_topology(topology_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a custom topology."""
    result = await db.execute(select(TopologyModel).where(TopologyModel.id == topology_id))
    topo = result.scalar_one_or_none()
    if not topo:
        raise TopologyNotFoundError(topology_id)
    if topo.is_preset:
        raise PresetProtectedError(topology_id)

    await db.delete(topo)
    await db.commit()
    return {"message": "Topology deleted successfully", "id": topology_id}

@router.post("/{topology_id}/analyze")
async def analyze_topology(topology_id: str, db: AsyncSession = Depends(get_db)):
    """Perform NetworkX static graph analysis (SPOF, cycles, bottlenecks) on a topology."""
    topo_data = None
    for preset in PRESET_TOPOLOGIES:
        if preset["id"] == topology_id:
            topo_data = preset
            break

    if not topo_data:
        result = await db.execute(select(TopologyModel).where(TopologyModel.id == topology_id))
        topo = result.scalar_one_or_none()
        if not topo:
            raise TopologyNotFoundError(topology_id)
        topo_data = {
            "nodes": topo.nodes,
            "edges": topo.edges
        }

    G = build_networkx_graph(topo_data.get("nodes", []), topo_data.get("edges", []))
    analysis = analyze_graph_topology(G)
    analysis["topology_id"] = topology_id
    return analysis
