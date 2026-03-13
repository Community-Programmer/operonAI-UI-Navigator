from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from server.config import JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_SECRET_KEY


def create_user_token(user_id: str) -> str:
    """Create a JWT token for a web dashboard user."""
    payload = {
        "sub": user_id,
        "type": "user",
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_device_token(
    user_id: str,
    device_id: str,
    device_name: str,
    session_minutes: int,
) -> str:
    """Create a JWT token for pairing a local helper device."""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=session_minutes)
    payload = {
        "sub": user_id,
        "device_id": device_id,
        "device_name": device_name,
        "session_minutes": session_minutes,
        "session_expires_at": expires_at.isoformat(),
        "type": "device",
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    """Verify a JWT token and return the payload, or None if invalid."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
