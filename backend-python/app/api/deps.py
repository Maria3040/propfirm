from __future__ import annotations

from typing import Annotated, Any

from fastapi import Cookie, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.architecture.db import get_db
from app.architecture.security import parse_token
from app.config import get_settings


DbSession = Annotated[Session, Depends(get_db)]


def _token_from_request(
    authorization: str | None,
    cookie_token: str | None,
) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    settings = get_settings()
    if cookie_token:
        return cookie_token
    return None


def require_user(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    propfirm_access: Annotated[str | None, Cookie()] = None,
) -> dict[str, Any]:
    settings = get_settings()
    # Cookie name may differ via settings — FastAPI binds literal; also check cookies dict.
    cookie_val = propfirm_access or request.cookies.get(settings.auth_cookie_name)
    token = _token_from_request(authorization, cookie_val)
    if not token:
        raise HTTPException(status_code=401, detail="unauthorized")
    claims = parse_token(token)
    if not claims or not claims.get("sub"):
        raise HTTPException(status_code=401, detail="unauthorized")
    request.state.access_token = token
    return {"sub": claims["sub"], "email": claims.get("email"), "role": claims.get("role")}


def require_admin(user: Annotated[dict[str, Any], Depends(require_user)]) -> dict[str, Any]:
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="forbidden")
    return user


User = Annotated[dict[str, Any], Depends(require_user)]
Admin = Annotated[dict[str, Any], Depends(require_admin)]
