"""Admin HTTP delivery — thin controllers over application services."""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.deps import Admin, DbSession
from app.modules.admin.application import admin_service
from app.shared_kernel.errors import DomainError

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _err(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content=message)


class ProductActiveBody(BaseModel):
    isActive: bool


class PayoutCommentBody(BaseModel):
    subject: str = Field(default="Regarding your payout request", max_length=200)
    message: str = Field(min_length=1, max_length=4000)


@router.get("/overview")
def admin_overview(admin: Admin, db: DbSession):
    return admin_service.overview(db)


@router.get("/traders")
def admin_traders(
    admin: Admin,
    db: DbSession,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    q: str | None = None,
    sortBy: str = "createdAt",
    sortDir: str = "desc",
    role: str | None = None,
):
    return admin_service.list_traders(
        db,
        page=page,
        page_size=pageSize,
        q=q,
        sort_by=sortBy,
        sort_dir=sortDir,
        role=role,
    )


@router.get("/challenges")
def admin_challenges(
    admin: Admin,
    db: DbSession,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    q: str | None = None,
    sortBy: str = "createdAt",
    sortDir: str = "desc",
    status: str | None = None,
):
    return admin_service.list_challenges(
        db,
        page=page,
        page_size=pageSize,
        q=q,
        sort_by=sortBy,
        sort_dir=sortDir,
        status=status,
    )


@router.post("/challenges/{challenge_id}/close")
def admin_close_challenge(challenge_id: str, admin: Admin, db: DbSession):
    try:
        return admin_service.close_challenge(db, challenge_id)
    except DomainError as exc:
        code = 404 if "not found" in exc.message else 400
        return _err(code, exc.message)


@router.get("/payouts")
def admin_payouts(
    admin: Admin,
    db: DbSession,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    q: str | None = None,
    sortBy: str = "createdAt",
    sortDir: str = "desc",
    status: str | None = None,
    vpsInvoiceStatus: str | None = None,
):
    return admin_service.list_payouts(
        db,
        page=page,
        page_size=pageSize,
        q=q,
        sort_by=sortBy,
        sort_dir=sortDir,
        status=status,
        vps_invoice_status=vpsInvoiceStatus,
    )


@router.post("/payouts/{payout_id}/comment")
def admin_payout_comment(payout_id: str, body: PayoutCommentBody, admin: Admin, db: DbSession):
    try:
        return admin_service.comment_on_payout(
            db, payout_id, subject=body.subject, message=body.message
        )
    except DomainError as exc:
        code = 404 if "not found" in exc.message else 400
        return _err(code, exc.message)


@router.post("/payouts/{payout_id}/approve")
def admin_approve(payout_id: str, admin: Admin, db: DbSession):
    try:
        return admin_service.decide_payout(db, payout_id, True)
    except DomainError as exc:
        code = 404 if exc.message == "not found" else 400
        return _err(code, exc.message)


@router.post("/payouts/{payout_id}/reject")
def admin_reject(payout_id: str, admin: Admin, db: DbSession):
    try:
        return admin_service.decide_payout(db, payout_id, False)
    except DomainError as exc:
        code = 404 if exc.message == "not found" else 400
        return _err(code, exc.message)


@router.post("/payouts/{payout_id}/request-vps-invoice")
def admin_request_vps_invoice(payout_id: str, admin: Admin, db: DbSession):
    try:
        return admin_service.request_vps_invoice(db, payout_id)
    except DomainError as exc:
        code = 404 if exc.message == "not found" else 400
        return _err(code, exc.message)


@router.post("/payouts/{payout_id}/vps-invoice-received")
def admin_vps_invoice_received(payout_id: str, admin: Admin, db: DbSession):
    try:
        return admin_service.mark_vps_invoice_received(db, payout_id)
    except DomainError as exc:
        code = 404 if exc.message == "not found" else 400
        return _err(code, exc.message)


@router.get("/catalog/products")
def admin_products(
    admin: Admin,
    db: DbSession,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    q: str | None = None,
    sortBy: str = "accountSize",
    sortDir: str = "asc",
    isActive: bool | None = None,
):
    return admin_service.list_products(
        db,
        page=page,
        page_size=pageSize,
        q=q,
        sort_by=sortBy,
        sort_dir=sortDir,
        is_active=isActive,
    )


@router.patch("/catalog/products/{product_id}")
def admin_toggle_product(product_id: str, body: ProductActiveBody, admin: Admin, db: DbSession):
    try:
        return admin_service.set_product_active(db, product_id, body.isActive)
    except DomainError as exc:
        code = 404 if exc.message == "not found" else 400
        return _err(code, exc.message)


@router.get("/audit")
def admin_audit(
    admin: Admin,
    db: DbSession,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    q: str | None = None,
    sortBy: str = "occurredAt",
    sortDir: str = "desc",
    eventType: str | None = None,
):
    return admin_service.list_audit(
        db,
        page=page,
        page_size=pageSize,
        q=q,
        sort_by=sortBy,
        sort_dir=sortDir,
        event_type=eventType,
    )


@router.get("/notifications")
def admin_notifications(
    admin: Admin,
    db: DbSession,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    q: str | None = None,
    sortBy: str = "createdAt",
    sortDir: str = "desc",
    status: str | None = None,
):
    return admin_service.list_notifications(
        db,
        page=page,
        page_size=pageSize,
        q=q,
        sort_by=sortBy,
        sort_dir=sortDir,
        status=status,
    )
