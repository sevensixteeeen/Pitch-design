"""Runs each file in supabase/migrations once, in name order.

    uv run --env-file ../.env.local python -m app.migrate

Applied files are recorded in the schema_migrations table. Each file runs in
its own transaction: it either applies completely or not at all.
"""

import os
import sys
from pathlib import Path

import psycopg

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "supabase" / "migrations"

SETUP = """
create table if not exists schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
-- same backstop as every other table: invisible to Supabase's Data API
alter table schema_migrations enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema_migrations from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema_migrations from authenticated';
  end if;
end;
$$;
"""


def migrate(database_url: str, migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    applied = []
    # autocommit: each `with conn.transaction()` below is then its own real transaction
    with psycopg.connect(database_url, autocommit=True) as conn:
        with conn.transaction():
            conn.execute(SETUP)
        done = {row[0] for row in conn.execute("select filename from schema_migrations")}
        for file in sorted(migrations_dir.glob("*.sql")):
            if file.name in done:
                continue
            with conn.transaction():
                conn.execute(file.read_text(encoding="utf-8"))
                conn.execute("insert into schema_migrations (filename) values (%s)", (file.name,))
            applied.append(file.name)
    return applied


if __name__ == "__main__":
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set. Run with: uv run --env-file ../.env.local python -m app.migrate")
    names = migrate(url)
    print("Applied: " + ", ".join(names) if names else "Nothing to apply; the database is up to date.")
