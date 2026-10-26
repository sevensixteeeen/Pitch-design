"""The Postgres connection pool. Each request borrows one connection."""

from collections.abc import Iterator
from typing import Annotated, Any

from fastapi import Depends
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool: ConnectionPool | None = None


def open_pool(url: str) -> None:
    global _pool
    # small on purpose: the Supabase free plan allows only a few connections
    _pool = ConnectionPool(url, min_size=1, max_size=5, kwargs={"row_factory": dict_row}, open=True)


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_conn() -> Iterator[Connection[dict[str, Any]]]:
    """Commits when the route returns normally, rolls back if it raises."""
    if _pool is None:
        raise RuntimeError("The database pool is not open.")
    with _pool.connection() as conn:
        yield conn


# scope="function": commit BEFORE the response is sent, so the browser's next
# request always sees this one's writes
Conn = Annotated[Connection[dict[str, Any]], Depends(get_conn, scope="function")]
