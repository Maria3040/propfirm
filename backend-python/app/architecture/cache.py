"""Catalog / competition read-through cache (architecture layer)."""

from __future__ import annotations

import json
from typing import Any, Optional

from app.architecture.redis_client import get_redis
from app.config import get_settings


def catalog_key(phase: str | None, variant: str | None) -> str:
    return f"propfirm:catalog:products:{phase or '-'}:{variant or '-'}"


def get_json(key: str) -> Optional[Any]:
    r = get_redis()
    if not r:
        return None
    raw = r.get(key)
    if not raw:
        return None
    return json.loads(raw)


def set_json(key: str, value: Any, ttl: int | None = None) -> None:
    r = get_redis()
    if not r:
        return
    settings = get_settings()
    r.setex(key, ttl or settings.catalog_cache_ttl_seconds, json.dumps(value))


def delete_prefix(prefix: str) -> None:
    r = get_redis()
    if not r:
        return
    for key in r.scan_iter(f"{prefix}*"):
        r.delete(key)


def invalidate_catalog() -> None:
    delete_prefix("propfirm:catalog:products:")


def joined_key(trader_id: str) -> str:
    return f"propfirm:comps:joined:{trader_id}"


def invalidate_joined(trader_id: str) -> None:
    r = get_redis()
    if not r:
        return
    r.delete(joined_key(trader_id))
