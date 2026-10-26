import time
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from .conftest import make_token


def get_me(client, token):
    return client.get("/api/me", headers={"Authorization": f"Bearer {token}"})


def test_valid_token_returns_profile_and_creates_it(client, alice):
    res = client.get("/api/me", headers=alice.headers)
    assert res.status_code == 200
    assert res.json() == {"id": str(alice.id), "email": "alice@example.com", "display_name": None}


def test_no_token(client):
    res = client.get("/api/me")
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "claims",
    [
        {"exp": int(time.time()) - 10},  # expired
        {"aud": "anon"},  # wrong audience
        {"iss": "https://someone-else.supabase.co/auth/v1"},  # another project
        {"is_anonymous": True},  # anonymous sign-ins are not accounts
    ],
)
def test_bad_claims_refused(client, claims):
    assert get_me(client, make_token(uuid4(), **claims)).status_code == 401


def test_token_signed_with_another_key_refused(client):
    stranger_key = ec.generate_private_key(ec.SECP256R1())
    assert get_me(client, make_token(uuid4(), key=stranger_key)).status_code == 401


def test_unsigned_token_refused(client):
    import jwt

    token = jwt.encode({"sub": str(uuid4()), "aud": "authenticated"}, None, algorithm="none")
    assert get_me(client, token).status_code == 401


def test_garbage_token_and_bad_subject(client):
    assert get_me(client, "not-a-jwt").status_code == 401
    assert get_me(client, make_token("not-a-uuid")).status_code == 401
