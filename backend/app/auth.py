"""Login check: every /api request carries the Supabase login token (a JWT).

The token is signed with the Supabase project's private key. We check the
signature with the project's public keys (JWKS), then the audience, issuer
and expiry, and read the user id from the "sub" claim.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings
from .db import Conn

ALGORITHMS = ["ES256", "RS256"]  # Supabase's asymmetric signing keys
bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str


@lru_cache
def get_jwks_client() -> jwt.PyJWKClient:
    # caches the public keys for 10 minutes, so most requests make no network call
    url = f"{get_settings().token_issuer}/.well-known/jwks.json"
    return jwt.PyJWKClient(url, cache_jwk_set=True, lifespan=600)


def _unauthorized() -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, "Please log in again.", headers={"WWW-Authenticate": "Bearer"})


def verify_token(token: str, jwks: Any, issuer: str) -> dict[str, Any]:
    try:
        key = jwks.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=ALGORITHMS,
            audience="authenticated",
            issuer=issuer,
            options={"require": ["exp", "sub", "aud", "iss"]},
        )
    except jwt.PyJWKClientConnectionError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Can't reach the login service.") from exc
    except jwt.PyJWTError as exc:
        raise _unauthorized() from exc
    if claims.get("is_anonymous"):
        raise _unauthorized()
    return claims


def current_user(
    conn: Conn,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    jwks: Annotated[Any, Depends(get_jwks_client)],
) -> CurrentUser:
    if creds is None:
        raise _unauthorized()
    claims = verify_token(creds.credentials, jwks, get_settings().token_issuer)
    try:
        user_id = UUID(claims["sub"])
    except ValueError as exc:
        raise _unauthorized() from exc
    # make sure the profile exists before any route inserts rows that point at it
    conn.execute("insert into profiles (id) values (%s) on conflict do nothing", (user_id,))
    return CurrentUser(id=user_id, email=claims.get("email") or "")


User = Annotated[CurrentUser, Depends(current_user)]
