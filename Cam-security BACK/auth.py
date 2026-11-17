import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Optional

def _load_secret() -> str:
    env_secret = os.getenv("CAMSEC_JWT_SECRET")
    if env_secret:
        return env_secret
    seed = os.getenv("Neon_KEY") or os.getenv("DATABASE_URL")
    if seed:
        return hashlib.sha256(seed.encode()).hexdigest()
    secret_file = Path(__file__).parent / ".jwt_secret"
    if secret_file.exists():
        return secret_file.read_text().strip()
    secret = secrets.token_hex(32)
    try:
        secret_file.write_text(secret)
    except OSError:
        pass
    return secret


_SECRET = _load_secret()

TOKEN_TTL_HOURS = int(os.getenv("CAMSEC_TOKEN_TTL_HOURS", "168"))


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64d(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def create_token(user: dict) -> str:
    now = int(time.time())
    header = _b64e(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64e(json.dumps({
        "sub": user["id"],
        "email": user.get("email"),
        "username": user.get("username"),
        "iat": now,
        "exp": now + TOKEN_TTL_HOURS * 3600,
        "type": "access",
    }, separators=(",", ":")).encode())
    signing = f"{header}.{payload}"
    sig = _b64e(hmac.new(_SECRET.encode(), signing.encode(), hashlib.sha256).digest())
    return f"{signing}.{sig}"


def verify_token(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    try:
        header, payload, sig = token.split(".")
        signing = f"{header}.{payload}"
        expected = _b64e(hmac.new(_SECRET.encode(), signing.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, sig):
            return None
        data = json.loads(_b64d(payload))
        if data.get("type") != "access" or data.get("exp", 0) < time.time():
            return None
        return {"id": data["sub"], "email": data.get("email"), "username": data.get("username")}
    except Exception:
        return None
