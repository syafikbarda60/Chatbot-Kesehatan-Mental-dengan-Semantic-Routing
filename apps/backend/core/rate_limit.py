from __future__ import annotations

# core/rate_limit.py
# Rate limiting middleware for FastAPI

import time
import os
from typing import Optional, Dict, Tuple, Any
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_AVAILABLE = False


@dataclass
class RateLimitConfig:
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    burst_allowance: int = 10  # Allow short bursts


@dataclass
class ClientState:
    minute_requests: int = 0
    hour_requests: int = 0
    minute_window_start: float = field(default_factory=time.time)
    hour_window_start: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)


class InMemoryRateLimiter:
    """Thread-safe in-memory rate limiter with sliding window."""
    
    def __init__(self, config: RateLimitConfig):
        self.config = config
        self.clients: Dict[str, ClientState] = defaultdict(ClientState)
        self.lock = Lock()
    
    def _get_client_key(self, identifier: str) -> str:
        return identifier
    
    def check_rate_limit(self, identifier: str) -> Tuple[bool, Dict[str, int]]:
        """
        Check if request is within rate limits.
        Returns (allowed, headers_dict).
        """
        with self.lock:
            now = time.time()
            client_key = self._get_client_key(identifier)
            state = self.clients[client_key]
            
            # Reset minute window if expired
            if now - state.minute_window_start >= 60:
                state.minute_requests = 0
                state.minute_window_start = now
            
            # Reset hour window if expired
            if now - state.hour_window_start >= 3600:
                state.hour_requests = 0
                state.hour_window_start = now
            
            # Check limits
            minute_remaining = max(0, self.config.requests_per_minute - state.minute_requests)
            hour_remaining = max(0, self.config.requests_per_hour - state.hour_requests)
            
            allowed = (
                state.minute_requests < self.config.requests_per_minute + self.config.burst_allowance
                and state.hour_requests < self.config.requests_per_hour + self.config.burst_allowance
            )
            
            if allowed:
                state.minute_requests += 1
                state.hour_requests += 1
                state.last_seen = now
            
            headers = {
                "X-RateLimit-Limit-Minute": str(self.config.requests_per_minute),
                "X-RateLimit-Remaining-Minute": str(minute_remaining),
                "X-RateLimit-Limit-Hour": str(self.config.requests_per_hour),
                "X-RateLimit-Remaining-Hour": str(hour_remaining),
                "X-RateLimit-Reset-Minute": str(int(state.minute_window_start + 60)),
                "X-RateLimit-Reset-Hour": str(int(state.hour_window_start + 3600)),
            }
            
            return allowed, headers
    
    def cleanup_old_clients(self, max_age_seconds: int = 3600):
        """Remove clients not seen for max_age_seconds."""
        with self.lock:
            now = time.time()
            to_remove = [
                key for key, state in self.clients.items()
                if now - state.last_seen > max_age_seconds
            ]
            for key in to_remove:
                del self.clients[key]


class RedisRateLimiter:
    """Redis-backed rate limiter for distributed deployments."""
    
    def __init__(self, config: RateLimitConfig, redis_url: str):
        self.config = config
        self.redis_url = redis_url
        self._pool: Optional[redis.ConnectionPool] = None
        self._client: Optional[redis.Redis] = None
    
    async def _get_client(self) -> redis.Redis:
        if self._client is None:
            self._pool = redis.ConnectionPool.from_url(
                self.redis_url,
                max_connections=20,
                decode_responses=True
            )
            self._client = redis.Redis(connection_pool=self._pool)
        return self._client
    
    async def check_rate_limit(self, identifier: str) -> Tuple[bool, Dict[str, int]]:
        """
        Check rate limit using Redis sorted sets for sliding window.
        """
        client = await self._get_client()
        now = time.time()
        minute_ago = now - 60
        hour_ago = now - 3600
        
        pipe = client.pipeline()
        
        # Clean old entries and count current window
        minute_key = f"ratelimit:{identifier}:minute"
        hour_key = f"ratelimit:{identifier}:hour"
        
        # Remove expired entries
        pipe.zremrangebyscore(minute_key, 0, minute_ago)
        pipe.zremrangebyscore(hour_key, 0, hour_ago)
        
        # Count current requests
        pipe.zcard(minute_key)
        pipe.zcard(hour_key)
        
        results = await pipe.execute()
        minute_count = results[2]
        hour_count = results[3]
        
        allowed = (
            minute_count < self.config.requests_per_minute + self.config.burst_allowance
            and hour_count < self.config.requests_per_hour + self.config.burst_allowance
        )
        
        if allowed:
            # Add current request
            pipe2 = client.pipeline()
            pipe2.zadd(minute_key, {str(now): now})
            pipe2.zadd(hour_key, {str(now): now})
            pipe2.expire(minute_key, 120)
            pipe2.expire(hour_key, 7200)
            await pipe2.execute()
        
        headers = {
            "X-RateLimit-Limit-Minute": str(self.config.requests_per_minute),
            "X-RateLimit-Remaining-Minute": str(max(0, self.config.requests_per_minute - minute_count)),
            "X-RateLimit-Limit-Hour": str(self.config.requests_per_hour),
            "X-RateLimit-Remaining-Hour": str(max(0, self.config.requests_per_hour - hour_count)),
            "X-RateLimit-Reset-Minute": str(int(now + 60)),
            "X-RateLimit-Reset-Hour": str(int(now + 3600)),
        }
        
        return allowed, headers
    
    async def close(self):
        if self._client:
            await self._client.close()
        if self._pool:
            await self._pool.disconnect()


def create_rate_limiter(config: Optional[RateLimitConfig] = None):
    """Factory function to create appropriate rate limiter."""
    if config is None:
        config = RateLimitConfig(
            requests_per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "60")),
            requests_per_hour=int(os.getenv("RATE_LIMIT_PER_HOUR", "1000")),
            burst_allowance=int(os.getenv("RATE_LIMIT_BURST", "10")),
        )
    
    redis_url = os.getenv("REDIS_URL")
    if redis_url and REDIS_AVAILABLE:
        return RedisRateLimiter(config, redis_url)
    else:
        return InMemoryRateLimiter(config)


# FastAPI middleware
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting."""
    
    def __init__(self, app, rate_limiter=None, exempt_paths: list = None):
        super().__init__(app)
        self.rate_limiter = rate_limiter or create_rate_limiter()
        self.exempt_paths = exempt_paths or ["/health", "/health/", "/docs", "/redoc", "/openapi.json"]
    
    async def dispatch(self, request: Request, call_next):
        # Skip exempt paths
        if request.url.path in self.exempt_paths:
            return await call_next(request)
        
        # Skip if path starts with exempt prefix
        for exempt in self.exempt_paths:
            if request.url.path.startswith(exempt.rstrip("/") + "/"):
                return await call_next(request)
        
        # Get client identifier (IP + user if authenticated)
        client_ip = request.client.host if request.client else "unknown"
        user_id = getattr(request.state, "user_id", None)
        identifier = f"{client_ip}:{user_id}" if user_id else client_ip
        
        # Check rate limit
        if hasattr(self.rate_limiter, 'check_rate_limit'):
            # Check if it's async (Redis) or sync (in-memory)
            import asyncio
            if asyncio.iscoroutinefunction(self.rate_limiter.check_rate_limit):
                allowed, headers = await self.rate_limiter.check_rate_limit(identifier)
            else:
                allowed, headers = self.rate_limiter.check_rate_limit(identifier)
        else:
            allowed, headers = True, {}
        
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": "Terlalu banyak permintaan. Silakan coba lagi nanti.",
                    "retry_after": 60
                },
                headers=headers
            )
        
        response = await call_next(request)
        
        # Add rate limit headers to response
        for key, value in headers.items():
            response.headers[key] = value
        
        return response