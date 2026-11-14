import logging
import uuid
from typing import Any, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger("failguard.security")

class FailGuardException(Exception):
    """Base exception for FailGuard AI domain errors."""
    def __init__(self, message: str, code: str = "FAILGUARD_ERROR", details: Optional[dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}

class TopologyNotFoundError(FailGuardException):
    def __init__(self, topology_id: str):
        super().__init__(
            message=f"Topology with ID '{topology_id}' was not found.",
            code="TOPOLOGY_NOT_FOUND",
            details={"topology_id": topology_id}
        )

class NodeNotFoundError(FailGuardException):
    def __init__(self, node_id: str, topology_id: Optional[str] = None):
        super().__init__(
            message=f"Node '{node_id}' does not exist in the target graph.",
            code="NODE_NOT_FOUND",
            details={"node_id": node_id, "topology_id": topology_id}
        )

class ArchitectureValidationError(FailGuardException):
    def __init__(self, message: str, issues: list[dict[str, Any]]):
        super().__init__(
            message=message,
            code="ARCHITECTURE_VALIDATION_FAILED",
            details={"issues": issues}
        )

class GraphCycleError(FailGuardException):
    def __init__(self, cycles: list[list[str]]):
        super().__init__(
            message="Circular synchronous dependencies detected in architecture graph.",
            code="SYNCHRONOUS_CYCLE_DETECTED",
            details={"cycles": cycles}
        )

class SimulationExecutionError(FailGuardException):
    def __init__(self, message: str, step: Optional[int] = None):
        super().__init__(
            message=message,
            code="SIMULATION_EXECUTION_ERROR",
            details={"step": step}
        )

class GraphSizeLimitExceededError(FailGuardException):
    def __init__(self, count: int, max_limit: int, entity_type: str = "nodes"):
        super().__init__(
            message=f"Graph size limit exceeded: {count} {entity_type} provided, maximum allowed is {max_limit}.",
            code="GRAPH_SIZE_LIMIT_EXCEEDED",
            details={"count": count, "max_limit": max_limit, "entity_type": entity_type}
        )

class PresetProtectedError(FailGuardException):
    def __init__(self, topology_id: str):
        super().__init__(
            message=f"Built-in benchmark preset '{topology_id}' is protected and cannot be modified or deleted.",
            code="PRESET_PROTECTED",
            details={"topology_id": topology_id}
        )

class RateLimitExceededError(FailGuardException):
    def __init__(self, retry_after_seconds: int = 60):
        super().__init__(
            message="Too many requests. Please wait before retrying.",
            code="RATE_LIMIT_EXCEEDED",
            details={"retry_after_seconds": retry_after_seconds}
        )

class PayloadTooLargeError(FailGuardException):
    def __init__(self, max_bytes: int):
        super().__init__(
            message=f"Request payload exceeds the maximum allowed size of {max_bytes} bytes.",
            code="PAYLOAD_TOO_LARGE",
            details={"max_bytes": max_bytes}
        )

class UnauthorizedError(FailGuardException):
    def __init__(self, message: str = "Authentication required. Missing or invalid API key."):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            details={}
        )

async def failguard_exception_handler(request: Request, exc: FailGuardException) -> JSONResponse:
    status_code = status.HTTP_400_BAD_REQUEST
    if isinstance(exc, (TopologyNotFoundError, NodeNotFoundError)):
        status_code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, (ArchitectureValidationError, GraphCycleError)):
        status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    elif isinstance(exc, PresetProtectedError):
        status_code = status.HTTP_403_FORBIDDEN
    elif isinstance(exc, RateLimitExceededError):
        status_code = status.HTTP_429_TOO_MANY_REQUESTS
    elif isinstance(exc, PayloadTooLargeError):
        status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    elif isinstance(exc, UnauthorizedError):
        status_code = status.HTTP_401_UNAUTHORIZED

    headers = {}
    if isinstance(exc, RateLimitExceededError):
        headers["Retry-After"] = str(exc.details.get("retry_after_seconds", 60))

    return JSONResponse(
        status_code=status_code,
        headers=headers,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "path": request.url.path
            }
        }
    )

async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catches all unexpected internal errors.
    Prevents stack traces, database schema details, or system paths from leaking to clients.
    """
    correlation_id = str(uuid.uuid4())
    logger.exception(
        f"[Internal Error ID: {correlation_id}] Unhandled error at {request.method} {request.url.path}: {exc}"
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred while processing the request. The issue has been logged.",
                "correlation_id": correlation_id,
                "path": request.url.path
            }
        }
    )
