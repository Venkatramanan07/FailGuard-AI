import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, Integer, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class TopologyModel(Base):
    __tablename__ = "topologies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(100), default="custom")
    is_preset: Mapped[int] = mapped_column(Integer, default=0) # 1 for built-in benchmark presets
    tags: Mapped[list] = mapped_column(JSON, default=list)
    nodes: Mapped[list] = mapped_column(JSON, default=list)
    edges: Mapped[list] = mapped_column(JSON, default=list)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

class SimulationRunModel(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    topology_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    scenario_name: Mapped[str] = mapped_column(String(255), nullable=False)
    injections: Mapped[list] = mapped_column(JSON, default=list)
    resilience_score: Mapped[float] = mapped_column(Float, default=100.0)
    blast_radius_pct: Mapped[float] = mapped_column(Float, default=0.0)
    total_affected_nodes: Mapped[int] = mapped_column(Integer, default=0)
    timeline_frames: Mapped[list] = mapped_column(JSON, default=list)
    recommendations: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
