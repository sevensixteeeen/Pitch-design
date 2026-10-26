"""Settings, read from environment variables (names in ../.env.example)."""

import os
from dataclasses import dataclass
from functools import lru_cache

REQUIRED = ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY")


@dataclass(frozen=True)
class Settings:
    database_url: str
    supabase_url: str  # https://<project-ref>.supabase.co
    supabase_secret_key: str  # server only, never sent to the browser
    storage_bucket: str = "user-files"

    @property
    def token_issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"


@lru_cache
def get_settings() -> Settings:
    missing = [name for name in REQUIRED if not os.environ.get(name)]
    if missing:
        raise RuntimeError(
            f"Missing environment variables: {', '.join(missing)}. Copy .env.example to .env.local and fill them in."
        )
    return Settings(
        database_url=os.environ["DATABASE_URL"],
        supabase_url=os.environ["SUPABASE_URL"].rstrip("/"),
        supabase_secret_key=os.environ["SUPABASE_SECRET_KEY"],
    )
