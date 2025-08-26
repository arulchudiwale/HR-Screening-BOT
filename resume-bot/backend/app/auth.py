# app/auth.py
import os, json, time
from typing import Dict, Optional
from datetime import datetime, timedelta
import jwt  # pip install PyJWT
from fastapi import HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

ALGO = "HS256"
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

class LoginRequest(BaseModel):
    username: str
    password: str

class AuthedUser(BaseModel):
    username: str
    role: str

def _load_users() -> Dict[str, Dict[str, str]]:
    """
    Users are provided via env var AUTH_USERS_JSON, e.g.:
    {"admin":{"password":"password","role":"admin"},"sam":{"password":"pass","role":"user"}}
    """
    raw = os.getenv("AUTH_USERS_JSON", "")
    if not raw:
        # very small default for local/dev
        return {"admin": {"password": "password", "role": "admin"}}
    try:
        return json.loads(raw)
    except Exception:
        return {}

def issue_token(username: str, role: str, ttl_minutes: int = 480) -> str:
    now = int(time.time())
    payload = {"sub": username, "role": role, "iat": now, "exp": now + ttl_minutes * 60}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGO)

def decode_token(token: str) -> AuthedUser:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGO])
        return AuthedUser(username=payload["sub"], role=payload.get("role", "user"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

security = HTTPBearer()

def current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> AuthedUser:
    return decode_token(creds.credentials)

def admin_required(user: AuthedUser = Depends(current_user)) -> AuthedUser:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

def verify_login(body: LoginRequest) -> Optional[AuthedUser]:
    users = _load_users()
    record = users.get(body.username)
    if record and body.password == record.get("password"):
        return AuthedUser(username=body.username, role=record.get("role", "user"))
    return None
