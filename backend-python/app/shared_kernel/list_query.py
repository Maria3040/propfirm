"""Shared admin list query helpers — page / sort whitelist / envelope."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Select, asc, desc, func, select
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class ListParams:
    page: int = 1
    page_size: int = 20
    q: str | None = None
    sort_by: str = "createdAt"
    sort_dir: str = "desc"

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def parse_list_params(
    *,
    page: int = 1,
    page_size: int = 20,
    q: str | None = None,
    sort_by: str = "createdAt",
    sort_dir: str = "desc",
    default_sort: str = "createdAt",
    max_page_size: int = 100,
) -> ListParams:
    page = max(1, int(page or 1))
    page_size = min(max_page_size, max(1, int(page_size or 20)))
    q_clean = (q or "").strip() or None
    direction = (sort_dir or "desc").lower()
    if direction not in {"asc", "desc"}:
        direction = "desc"
    return ListParams(
        page=page,
        page_size=page_size,
        q=q_clean,
        sort_by=(sort_by or default_sort).strip() or default_sort,
        sort_dir=direction,
    )


def apply_sort(
    stmt: Select[Any],
    sort_map: dict[str, Any],
    params: ListParams,
    *,
    default_key: str,
) -> Select[Any]:
    col = sort_map.get(params.sort_by) or sort_map[default_key]
    ordered = asc(col) if params.sort_dir == "asc" else desc(col)
    return stmt.order_by(ordered)


def count_rows(session: Session, stmt: Select[Any]) -> int:
    """Count rows for a filtered select (strips ORDER BY via subquery)."""
    sub = stmt.order_by(None).subquery()
    return int(session.scalar(select(func.count()).select_from(sub)) or 0)


def fetch_page(session: Session, stmt: Select[Any], params: ListParams) -> tuple[list[Any], int]:
    total = count_rows(session, stmt)
    rows = session.scalars(stmt.offset(params.offset).limit(params.page_size)).all()
    return list(rows), total


def page_envelope(
    items: list[Any],
    *,
    params: ListParams,
    total: int,
    filters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    total_pages = max(1, math.ceil(total / params.page_size)) if total else 1
    return {
        "items": items,
        "page": params.page,
        "pageSize": params.page_size,
        "total": total,
        "totalPages": total_pages,
        "sortBy": params.sort_by,
        "sortDir": params.sort_dir,
        "q": params.q,
        "filters": filters or {},
    }
