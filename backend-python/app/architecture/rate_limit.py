"""Login rate limiting via Redis fixed window (architecture layer)."""

from __future__ import annotations

from app.architecture.redis_client import get_redis
from app.config import get_settings


def allow_login_attempt(client_ip: str) -> bool:
    """Return False when the IP exceeded the configured window budget."""
    r = get_redis()
    if not r:
        return True
    settings = get_settings()
    key = f"propfirm:ratelimit:login:{client_ip or 'unknown'}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, settings.login_rate_limit_window_seconds)
    return int(count) <= settings.login_rate_limit_max
