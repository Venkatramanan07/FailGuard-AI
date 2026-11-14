import time
import collections
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from fastapi import Header, HTTPException, status
from backend.app.core.config import settings

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Applies security headers to every HTTP response to defend against
    clickjacking, MIME-type sniffing, cross-site scripting (XSS), and data leakage.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: blob:; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self' data:; "
            "connect-src 'self' http://localhost:* http://127.0.0.1:*; "
            "frame-ancestors 'none';"
        )
        return response

class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Protects the server from memory exhaustion and large payload DoS attacks
    by enforcing a maximum request body byte limit.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in ["POST", "PUT", "PATCH"]:
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    size = int(content_length)
                    if size > settings.MAX_REQUEST_SIZE_BYTES:
                        return JSONResponse(
                            status_code=413,
                            content={
                                "error": {
                                    "code": "PAYLOAD_TOO_LARGE",
                                    "message": f"Payload size ({size} bytes) exceeds limit of {settings.MAX_REQUEST_SIZE_BYTES} bytes.",
                                    "details": {"max_bytes": settings.MAX_REQUEST_SIZE_BYTES, "received_bytes": size},
                                    "path": request.url.path
                                }
                            }
                        )
                except ValueError:
                    pass
        return await call_next(request)

class InMemoryRateLimiter(BaseHTTPMiddleware):
    """
    Sliding-window IP-based rate limiter to protect simulation and graph
    analysis endpoints from automated brute-force and resource-exhaustion DoS.
    """
    def __init__(self, app):
        super().__init__(app)
        # client_ip -> deque of timestamps
        self.general_requests: dict[str, collections.deque] = collections.defaultdict(collections.deque)
        self.simulation_requests: dict[str, collections.deque] = collections.defaultdict(collections.deque)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not settings.RATE_LIMIT_ENABLED or request.method == "OPTIONS":
            return await call_next(request)

        # Ignore local health checks
        if request.url.path in ["/health", "/api/v1/health"]:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60.0  # 1 minute window

        # Determine if this is a heavy simulation endpoint
        is_simulation = (
            "/simulations/run" in request.url.path or
            "/simulations/quick-blast" in request.url.path or
            "/architecture/criticality" in request.url.path or
            "/architecture/recovery-priorities" in request.url.path
        )

        limit = settings.SIMULATION_RATE_LIMIT_PER_MINUTE if is_simulation else settings.GENERAL_RATE_LIMIT_PER_MINUTE
        history = self.simulation_requests[client_ip] if is_simulation else self.general_requests[client_ip]

        # Purge timestamps older than 60 seconds
        while history and history[0] < now - window:
            history.popleft()

        if len(history) >= limit:
            retry_after = int(window - (now - history[0])) if history else 60
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(max(1, retry_after))},
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit of {limit} requests/minute exceeded for this IP.",
                        "details": {"retry_after_seconds": max(1, retry_after)},
                        "path": request.url.path
                    }
                }
            )

        history.append(now)
        return await call_next(request)

async def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None)
):
    """
    Optional API Key verification. When FAILGUARD_API_KEY environment variable is configured,
    requests must provide a matching key via 'X-API-Key' or 'Authorization: Bearer <key>'.
    When not configured, allows requests for local development.
    """
    if not settings.API_KEY:
        return True

    provided_key = x_api_key
    if not provided_key and authorization:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            provided_key = parts[1]

    if not provided_key or provided_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key."
        )
    return True
