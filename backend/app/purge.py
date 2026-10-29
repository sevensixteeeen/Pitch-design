"""Deletes for good what has been in Trash for over 30 days, and uploads that never finished.

Runs by itself each time the API server starts (in the background, so starting isn't slowed
down; turn it off with PURGE_ON_START=0), and by hand:

    uv run --env-file ../.env.local python -m app.purge

architecture.md planned a daily GitHub Actions job calling the API instead, but this app only
runs on your own computer, which GitHub can't reach (your decision, 2026-10-28).
"""

import logging
import sys
import threading
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

import psycopg
from psycopg import Connection
from psycopg.rows import dict_row

from .storage import Storage

TRASH_DAYS = 30
PENDING_HOURS = 24  # an upload started but never completed (the browser closed halfway)

# uvicorn's own logger, so the result shows in the server's terminal
log = logging.getLogger("uvicorn.error")


@dataclass(frozen=True)
class Purged:
    designs: int
    uploads: int  # from Trash
    unfinished_uploads: int


def purge(conn: Connection[dict[str, Any]], files: Storage) -> Purged:
    """One transaction. The rows are locked first, so a Restore at the same moment waits and then
    finds nothing, instead of bringing back a design whose files are already gone. Files go
    before rows (as when deleting by hand): if Storage fails, the rows stay and the next run
    tries again."""
    trash_age = timedelta(days=TRASH_DAYS)
    designs = conn.execute(
        "select id, thumbnail_path from designs where deleted_at < now() - %s for update",
        (trash_age,),
    ).fetchall()
    assets = conn.execute(
        """select id, storage_path, deleted_at is not null as from_trash from assets
           where deleted_at < now() - %s or (status = 'pending' and created_at < now() - %s)
           for update""",
        (trash_age, timedelta(hours=PENDING_HOURS)),
    ).fetchall()
    paths = [d["thumbnail_path"] for d in designs if d["thumbnail_path"]] + [a["storage_path"] for a in assets]
    if paths:
        files.remove(paths)
    if designs:
        conn.execute("delete from designs where id = any(%s)", ([d["id"] for d in designs],))
    if assets:
        conn.execute("delete from assets where id = any(%s)", ([a["id"] for a in assets],))
    conn.commit()
    from_trash = sum(1 for a in assets if a["from_trash"])
    return Purged(designs=len(designs), uploads=from_trash, unfinished_uploads=len(assets) - from_trash)


def describe(result: Purged) -> str:
    return (
        f"Trash clean-up: deleted for good {result.designs} design(s) and {result.uploads} upload(s) "
        f"older than {TRASH_DAYS} days, and {result.unfinished_uploads} unfinished upload(s)."
    )


def purge_in_background() -> threading.Thread:
    """The startup run. A failure (e.g. no network) is logged and the server keeps running."""
    from .db import connection
    from .storage import get_storage

    def run() -> None:
        try:
            with connection() as conn:
                log.info(describe(purge(conn, get_storage())))
        except Exception:
            log.exception("Trash clean-up failed; it runs again next time the server starts.")

    thread = threading.Thread(target=run, name="trash-clean-up", daemon=True)
    thread.start()
    return thread


def main() -> None:
    from .config import get_settings
    from .storage import get_storage

    with psycopg.connect(get_settings().database_url, row_factory=dict_row) as conn:
        print(describe(purge(conn, get_storage())))


if __name__ == "__main__":
    sys.exit(main())
