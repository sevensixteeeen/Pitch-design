import psycopg
from psycopg_pool import ConnectionPool

from app import db


def test_BUG_005_closed_pool_connection_is_replaced(database_url, client, alice, monkeypatch):
    """Supabase's pooler closes database connections that sit idle. The pool must not hand such a
    dead connection to the next request (that request failed with 500, and the app sent the user
    back to the login page)."""
    assert client.get("/api/me", headers=alice.headers).status_code == 200  # the pool now holds a used connection
    monkeypatch.setattr(db, "RECENTLY_USED_S", 0.0)  # the quiet spell: every connection is tested again

    # what the pooler does after a quiet spell: close the app's connections from the server side
    with psycopg.connect(database_url, autocommit=True) as conn:
        closed = conn.execute(
            "select count(pg_terminate_backend(pid)) from pg_stat_activity "
            "where datname = current_database() and pid <> pg_backend_pid()"
        ).fetchone()[0]
    assert closed >= 1

    assert client.get("/api/me", headers=alice.headers).status_code == 200


def test_recently_used_connection_is_not_tested_again(client, alice, monkeypatch):
    """Testing a connection is one more trip to the database (about 280 ms from India); a connection
    that was in use a moment ago is handed out straight away. (A new one is tested once: it may have
    sat unused since the pool opened it.)"""
    checked = []
    real = ConnectionPool.check_connection
    monkeypatch.setattr(ConnectionPool, "check_connection", staticmethod(lambda conn: (checked.append(id(conn)), real(conn))))
    for path in ["/api/me", "/api/designs", "/api/folders", "/api/designs", "/api/assets"]:
        assert client.get(path, headers=alice.headers).status_code == 200
    assert checked
    assert len(checked) == len(set(checked))  # never the same connection twice


def test_reads_run_without_a_transaction_and_hand_back_a_normal_connection(client, alice):
    """A GET runs each statement on its own (no BEGIN/COMMIT trips). The connection goes back to the
    pool as before, so the next write is a normal all-or-nothing transaction."""
    assert client.get("/api/designs", headers=alice.headers).status_code == 200
    with db.connection() as conn:
        assert conn.autocommit is False
    created = client.post("/api/designs", headers=alice.headers, json={"width_px": 100, "height_px": 100, "display_unit": "px"})
    assert created.status_code == 201
    assert client.get(f"/api/designs/{created.json()['id']}", headers=alice.headers).status_code == 200
