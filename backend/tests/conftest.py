import os
import time
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlparse
from uuid import UUID, uuid4

import jwt
import pgserver
import psycopg
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from psycopg.conninfo import make_conninfo

# Settings the app reads at startup. The Supabase values are fake: tests never
# talk to Supabase (login keys and Storage are replaced below).
TEST_SUPABASE_URL = "https://test-project.supabase.co"
os.environ["SUPABASE_URL"] = TEST_SUPABASE_URL
os.environ["SUPABASE_SECRET_KEY"] = "test-secret-not-real"
ISSUER = f"{TEST_SUPABASE_URL}/auth/v1"

# A small Postgres that lives only on this computer, in a folder git ignores.
TEST_SERVER_FILES = Path(__file__).resolve().parents[1] / ".test-postgres"

from fastapi.testclient import TestClient  # noqa: E402

from app.auth import get_jwks_client  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.migrate import migrate  # noqa: E402
from app.ratelimit import reset_all  # noqa: E402
from app.storage import FileInfo, SignedUpload, get_storage  # noqa: E402


@pytest.fixture(scope="session")
def database_url():
    server = pgserver.get_server(TEST_SERVER_FILES, cleanup_mode="stop")
    url = server.get_uri()
    # each test empties the tables, so make very sure this is the local server
    assert urlparse(url).hostname in ("127.0.0.1", "localhost", None), url
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("drop database if exists canva_test")
        conn.execute("create database canva_test")
    test_url = make_conninfo(url, dbname="canva_test")
    os.environ["DATABASE_URL"] = test_url
    get_settings.cache_clear()
    migrate(test_url)
    yield test_url
    server.cleanup()


class FakeJwks:
    """Stands in for Supabase's public key endpoint."""

    def __init__(self, public_key):
        self.public_key = public_key

    def get_signing_key_from_jwt(self, _token):
        return SimpleNamespace(key=self.public_key)


SIGNING_KEY = ec.generate_private_key(ec.SECP256R1())


def make_token(user_id: UUID, email: str = "someone@example.com", key=SIGNING_KEY, **claims) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "aud": "authenticated",
        "iss": ISSUER,
        "role": "authenticated",
        "exp": int(time.time()) + 3600,
        **claims,
    }
    return jwt.encode(payload, key, algorithm="ES256")


class FakeStorage:
    """In-memory Supabase Storage. Tests "upload" with put()."""

    bucket = "user-files"

    def __init__(self):
        self.files: dict[str, FileInfo] = {}
        self.deleted_auth_users: list[UUID] = []

    def put(self, path: str, size_bytes: int, mime: str):
        self.files[path] = FileInfo(size_bytes, mime)

    def signed_upload(self, path):
        return SignedUpload(bucket=self.bucket, path=path, token="upload-token")

    def signed_urls(self, paths):
        return {p: f"https://files.test/{p}?token=signed" for p in paths if p in self.files}

    def file_info(self, path):
        return self.files.get(path)

    def remove(self, paths):
        for p in paths:
            self.files.pop(p, None)

    def delete_auth_user(self, user_id):
        self.deleted_auth_users.append(user_id)


@pytest.fixture
def storage():
    return FakeStorage()


@pytest.fixture
def client(database_url, storage):
    with psycopg.connect(database_url) as conn:
        conn.execute("truncate profiles, templates cascade")
    reset_all()
    app.dependency_overrides[get_jwks_client] = lambda: FakeJwks(SIGNING_KEY.public_key())
    app.dependency_overrides[get_storage] = lambda: storage
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@dataclass
class TestUser:
    id: UUID
    headers: dict[str, str]


def new_user(email: str) -> TestUser:
    user_id = uuid4()
    return TestUser(user_id, {"Authorization": f"Bearer {make_token(user_id, email)}"})


@pytest.fixture
def alice():
    return new_user("alice@example.com")


@pytest.fixture
def bob():
    """A second person, for checking that people can't reach each other's data."""
    return new_user("bob@example.com")


def blank_content(elements=None):
    return {
        "schema_version": 1,
        "pages": [{"id": "p1", "background": {"color": "#ffffff"}, "elements": elements or []}],
    }


def make_design(client, user, **body):
    res = client.post("/api/designs", json={"width_px": 1080, "height_px": 1350, **body}, headers=user.headers)
    assert res.status_code == 201, res.text
    return res.json()


def upload(client, storage, user, size=1000, mime="image/png"):
    """Runs the three upload steps; returns the finished asset."""
    res = client.post(
        "/api/assets", json={"original_name": "cat.png", "mime": mime, "size_bytes": size}, headers=user.headers
    )
    assert res.status_code == 201, res.text
    started = res.json()
    storage.put(started["upload"]["path"], size, mime)
    res = client.post(
        f"/api/assets/{started['id']}/complete", json={"width_px": 640, "height_px": 480}, headers=user.headers
    )
    assert res.status_code == 200, res.text
    return res.json()
