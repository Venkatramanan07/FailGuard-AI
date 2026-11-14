from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func
from backend.app.core.config import settings
from backend.app.core.database import engine, Base, AsyncSessionLocal
from backend.app.core.exceptions import (
    FailGuardException,
    failguard_exception_handler,
    global_exception_handler,
)
from backend.app.core.security import (
    SecurityHeadersMiddleware,
    RequestSizeLimitMiddleware,
    InMemoryRateLimiter,
)
from backend.app.models.db_models import TopologyModel
from backend.app.engine.presets import PRESET_TOPOLOGIES
from backend.app.api.routes.topologies import router as topologies_router
from backend.app.api.routes.simulations import router as simulations_router
from backend.app.api.routes.validation import router as validation_router
from backend.app.api.routes.criticality import router as criticality_router
from backend.app.api.routes.recovery import router as recovery_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed presets into database if not present
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(func.count(TopologyModel.id)))
        count = result.scalar()
        if count == 0:
            for p in PRESET_TOPOLOGIES:
                topo = TopologyModel(
                    id=p["id"],
                    name=p["name"],
                    description=p["description"],
                    category=p["category"],
                    is_preset=1,
                    tags=p.get("tags", []),
                    nodes=p.get("nodes", []),
                    edges=p.get("edges", []),
                    meta=p.get("meta", {})
                )
                session.add(topo)
            await session.commit()

    yield
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Cloud-Agnostic Infrastructure Failure Simulation & Blast Radius Engine",
    lifespan=lifespan
)

# Exception handlers
app.add_exception_handler(FailGuardException, failguard_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# Defensive Middlewares (Executed in reverse order of addition in ASGI)
# 1. Attach defensive HTTP headers
app.add_middleware(SecurityHeadersMiddleware)

# 2. Limit request payload size to defend against memory exhaustion
app.add_middleware(RequestSizeLimitMiddleware)

# 3. Sliding-window IP rate limiting
app.add_middleware(InMemoryRateLimiter)

# 4. CORS configuration (explicit origins only, no wildcard credentials vulnerability)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "Accept"],
    max_age=600,
)

# Register API routers
app.include_router(topologies_router, prefix=settings.API_V1_STR)
app.include_router(simulations_router, prefix=settings.API_V1_STR)
app.include_router(validation_router, prefix=settings.API_V1_STR)
app.include_router(criticality_router, prefix=settings.API_V1_STR)
app.include_router(recovery_router, prefix=settings.API_V1_STR)

@app.get("/api/v1/health", tags=["Health"])
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "engine": "NetworkX 3.x"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
