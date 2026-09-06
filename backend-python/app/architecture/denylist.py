"""JWT denylist stored in Redis until token expiry (architecture layer)."""

from __future__ import annotations

import hashlib
import time

from app.architecture.redis_client import get_redis


def _key(jti_or_token: str) -> str:
    digest = hashlib.sha256(jti_or_token.encode("utf-8")).hexdigest()
    return f"propfirm:denylist:{digest}"


def revoke(token: str, exp_epoch: int | None) -> None:
    r = get_redis()
    if not r:
        return
    ttl = 8 * 60 * 60
    if exp_epoch:
        ttl = max(1, int(exp_epoch - time.time()))
    r.setex(_key(token), ttl, "1")


def is_revoked(token: str) -> bool:
    r = get_redis()
    if not r:
        return False
    return bool(r.exists(_key(token)))
