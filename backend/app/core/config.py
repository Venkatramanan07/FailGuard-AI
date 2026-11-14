import os
from typing import Optional
from pydantic import BaseModel, Field

def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

class Settings(BaseModel):
    PROJECT_NAME: str = "FailGuard AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENV: str = os.getenv("FAILGUARD_ENV", "development")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./failguard.db")
    
    # CORS: Explicit whitelist without wildcard credentials hazard
    CORS_ORIGINS: list[str] = Field(default_factory=_parse_cors_origins)

    # DoS & Resource Guardrails
    MAX_REQUEST_SIZE_BYTES: int = Field(default=2 * 1024 * 1024, description="Max 2MB per HTTP request body")
    MAX_GRAPH_NODES: int = Field(default=300, description="Max nodes allowed in a graph to prevent algorithmic DoS")
    MAX_GRAPH_EDGES: int = Field(default=1000, description="Max edges allowed in a graph")

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = Field(default=True)
    GENERAL_RATE_LIMIT_PER_MINUTE: int = Field(default=120)
    SIMULATION_RATE_LIMIT_PER_MINUTE: int = Field(default=30)

    # Authentication & Access Control (Optional API Key)
    API_KEY: Optional[str] = os.getenv("FAILGUARD_API_KEY", None)

settings = Settings()
