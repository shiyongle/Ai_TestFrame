import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config.settings import settings
from models.database_models import User

security = HTTPBearer(auto_error=False)


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt_value = salt or os.urandom(16).hex()
    password_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_value.encode("utf-8"), 100000)
    return f"{salt_value}${password_hash.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_value, stored_hash = password_hash.split("$", 1)
    except ValueError:
        return False
    computed_hash = hash_password(password, salt_value).split("$", 1)[1]
    return hmac.compare_digest(computed_hash, stored_hash)


def create_access_token(user: User) -> str:
    payload = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role,
        "exp": int((datetime.utcnow() + timedelta(hours=settings.auth_token_expire_hours)).timestamp()),
    }
    payload_encoded = _b64encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    signature = hmac.new(settings.auth_secret_key.encode("utf-8"), payload_encoded.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload_encoded}.{signature}"


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        payload_encoded, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的认证令牌") from exc

    expected_signature = hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        payload_encoded.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="认证令牌校验失败")

    try:
        payload = json.loads(_b64decode(payload_encoded).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="认证令牌格式错误") from exc

    if payload.get("exp", 0) < int(datetime.utcnow().timestamp()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="认证令牌已过期")

    return payload


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def get_user_by_token(db: Session, token: str) -> User:
    payload = decode_access_token(token)
    user = db.query(User).filter(User.id == payload.get("user_id")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用")
    return user


def ensure_default_admin(db: Session) -> User:
    admin = db.query(User).filter(User.username == "admin").first()
    if admin:
        updated = False
        if admin.role != "super_admin":
            admin.role = "super_admin"
            updated = True
        if not admin.is_active:
            admin.is_active = True
            updated = True
        if updated:
            db.add(admin)
            db.commit()
            db.refresh(admin)
        return admin

    admin = User(
        username="admin",
        password_hash=hash_password("admin"),
        role="super_admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


async def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = security) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供认证信息")
    return decode_access_token(credentials.credentials)
