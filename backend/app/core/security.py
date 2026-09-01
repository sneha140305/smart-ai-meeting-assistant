from datetime import datetime, timedelta, timezone

from jose import jwt
from pwdlib import PasswordHash

from app.core.config import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES
)


password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    return password_hash.verify(
        plain_password,
        hashed_password
    )


def create_access_token(data: dict) -> str:
    payload = data.copy()

    expire_time = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload.update({
        "exp": expire_time
    })

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )