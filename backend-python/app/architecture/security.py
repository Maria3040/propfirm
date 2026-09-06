from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.architecture import denylist
from app.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def issue_token(sub: str, email: str, role: str, display_name: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "email": email,
        "role": role,
        "display_name": display_name,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=8)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_key, algorithm="HS256")


def parse_token(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    if denylist.is_revoked(token):
        return None
    try:
        return jwt.decode(
            token,
            settings.jwt_key,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
    except JWTError:
        return None


def revoke_token(token: str) -> None:
    try:
        claims = jwt.get_unverified_claims(token)
        exp = claims.get("exp")
    except Exception:  # noqa: BLE001
        exp = None
    denylist.revoke(token, int(exp) if exp else None)
