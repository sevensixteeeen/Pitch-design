"""The Postgres connection pool. Each request borrows one connection.

Every trip to the database is slow from far away (about 280 ms from India to Supabase in Ireland,
measured 2026-10-30), so requests avoid trips they don't need: reads run without BEGIN/COMMIT, and a
connection used a moment ago isn't tested again before it's handed out.
"""

import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated, Any

from fastapi import Depends, Request
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool: ConnectionPool | None = None

# a connection back in the pool less than this long ago is handed out without a test; Supabase's
# pooler only closes connections after a much longer quiet spell
RECENTLY_USED_S = 30.0
_last_used: dict[int, float] = {}


def _check(conn: Connection[Any]) -> None:
    if time.monotonic() - _last_used.get(id(conn), float("-inf")) < RECENTLY_USED_S:
        return
    ConnectionPool.check_connection(conn)


def _reset(conn: Connection[Any]) -> None:
    conn.autocommit = False  # a read turned it on (get_conn)
    _last_used[id(conn)] = time.monotonic()


def open_pool(url: str) -> None:
    global _pool
    _pool = ConnectionPool(
        url,
        # small on purpose: the Supabase free plan allows only a few connections
        min_size=1,
        max_size=5,
        kwargs={"row_factory": dict_row},
        # Supabase's pooler closes connections that sit idle; test one that has been quiet before a
        # request gets it, and swap a dead one for a fresh one (BUG-005)
        check=_check,
        reset=_reset,
        open=True,
    )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def connection() -> Iterator[Connection[dict[str, Any]]]:
    """A pooled connection outside a request (the startup Trash clean-up)."""
    if _pool is None:
        raise RuntimeError("The database pool is not open.")
    with _pool.connection() as conn:
        yield conn


def get_conn(request: Request) -> Iterator[Connection[dict[str, Any]]]:
    """Commits when the route returns normally, rolls back if it raises. A read (GET) has no
    transaction: each statement counts on its own, which saves the trips for BEGIN and COMMIT."""
    if _pool is None:
        raise RuntimeError("The database pool is not open.")
    with _pool.connection() as conn:
        if request.method in ("GET", "HEAD"):
            conn.autocommit = True
        yield conn


# scope="function": commit BEFORE the response is sent, so the browser's next
# request always sees this one's writes
Conn = Annotated[Connection[dict[str, Any]], Depends(get_conn, scope="function")]
