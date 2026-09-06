"""Architecture-layer Redis client — optional dependency for local demos."""

from __future__ import annotations

import logging
from typing import Optional

import redis

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    global _client
    if _client is not None:
        return _client
    settings = get_settings()
    try:
        client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        client.ping()
        _client = client
        return _client
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis unavailable (%s); architecture adapters will degrade", exc)
        return None


def reset_redis_for_tests() -> None:
    global _client
    _client = None
