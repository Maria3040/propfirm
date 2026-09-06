"""Unit tests for shared list query helpers."""

from __future__ import annotations

from app.shared_kernel.list_query import page_envelope, parse_list_params


def test_parse_list_params_clamps_page_size_and_page():
    p = parse_list_params(page=0, page_size=500, sort_dir="nope")
    assert p.page == 1
    assert p.page_size == 100
    assert p.sort_dir == "desc"


def test_page_envelope_total_pages():
    params = parse_list_params(page=2, page_size=10)
    env = page_envelope([{"id": 1}], params=params, total=25, filters={"status": "Pending"})
    assert env["totalPages"] == 3
    assert env["page"] == 2
    assert env["total"] == 25
    assert env["filters"]["status"] == "Pending"
    assert env["items"] == [{"id": 1}]


def test_empty_total_still_one_page():
    params = parse_list_params(page=1, page_size=20)
    env = page_envelope([], params=params, total=0)
    assert env["totalPages"] == 1
