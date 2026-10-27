import psycopg


def test_BUG_005_closed_pool_connection_is_replaced(database_url, client, alice):
    """Supabase's pooler closes database connections that sit idle. The pool must not hand such a
    dead connection to the next request (that request failed with 500, and the app sent the user
    back to the login page)."""
    assert client.get("/api/me", headers=alice.headers).status_code == 200  # the pool now holds a used connection

    # what the pooler does after a quiet spell: close the app's connections from the server side
    with psycopg.connect(database_url, autocommit=True) as conn:
        closed = conn.execute(
            "select count(pg_terminate_backend(pid)) from pg_stat_activity "
            "where datname = current_database() and pid <> pg_backend_pid()"
        ).fetchone()[0]
    assert closed >= 1

    assert client.get("/api/me", headers=alice.headers).status_code == 200
