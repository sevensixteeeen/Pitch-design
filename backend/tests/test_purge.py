"""The Trash clean-up (app/purge.py): over 30 days in Trash, or an upload left unfinished for 24 hours."""

import asyncio

import psycopg
import pytest
from psycopg.rows import dict_row

from app import main
from app.config import Settings, get_settings
from app.purge import Purged, describe, purge

from .conftest import make_design, upload


def backdate(database_url, table, row_id, column, *, days=0, hours=0):
    with psycopg.connect(database_url) as conn:
        conn.execute(
            f"update {table} set {column} = now() - make_interval(days => %s, hours => %s) where id = %s",
            (days, hours, row_id),
        )


def run(database_url, storage) -> Purged:
    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        return purge(conn, storage)


def ids(database_url, table):
    with psycopg.connect(database_url) as conn:
        return {str(r[0]) for r in conn.execute(f"select id from {table}")}


def test_F08_E3_designs_over_30_days_in_trash_are_deleted_with_their_files(database_url, client, storage, alice, bob):
    old = make_design(client, alice)
    recent = make_design(client, alice)
    live = make_design(client, alice)
    bobs_old = make_design(client, bob)
    for d, user in [(old, alice), (recent, alice), (bobs_old, bob)]:
        client.post(f"/api/designs/{d['id']}/thumbnail", headers=user.headers)
        client.post(f"/api/designs/{d['id']}/trash", headers=user.headers)
    storage.put(f"{alice.id}/thumbnails/{old['id']}.png", 10, "image/png")
    storage.put(f"{alice.id}/thumbnails/{recent['id']}.png", 10, "image/png")
    backdate(database_url, "designs", old["id"], "deleted_at", days=31)
    backdate(database_url, "designs", bobs_old["id"], "deleted_at", days=40)
    backdate(database_url, "designs", recent["id"], "deleted_at", days=29)

    result = run(database_url, storage)

    assert result == Purged(designs=2, uploads=0, unfinished_uploads=0)
    assert ids(database_url, "designs") == {recent["id"], live["id"]}
    assert f"{alice.id}/thumbnails/{old['id']}.png" not in storage.files
    assert f"{alice.id}/thumbnails/{recent['id']}.png" in storage.files
    assert client.get(f"/api/designs/{old['id']}", headers=alice.headers).status_code == 404


def test_uploads_over_30_days_in_trash_and_unfinished_uploads_are_deleted(database_url, client, storage, alice):
    old = upload(client, storage, alice)
    kept = upload(client, storage, alice)
    client.post(f"/api/assets/{old['id']}/trash", headers=alice.headers)
    client.post(f"/api/assets/{kept['id']}/trash", headers=alice.headers)
    backdate(database_url, "assets", old["id"], "deleted_at", days=31)
    # two uploads started but never completed: one a day old, one just now
    started = [
        client.post(
            "/api/assets", json={"original_name": "x.png", "mime": "image/png", "size_bytes": 10}, headers=alice.headers
        ).json()
        for _ in range(2)
    ]
    for s in started:
        storage.put(s["upload"]["path"], 10, "image/png")
    backdate(database_url, "assets", started[0]["id"], "created_at", hours=25)

    result = run(database_url, storage)

    assert result == Purged(designs=0, uploads=1, unfinished_uploads=1)
    assert ids(database_url, "assets") == {kept["id"], started[1]["id"]}
    assert started[0]["upload"]["path"] not in storage.files
    assert started[1]["upload"]["path"] in storage.files
    assert "1 upload(s)" in describe(result)


def test_nothing_to_do_touches_nothing(database_url, client, storage, alice):
    make_design(client, alice)
    calls = []
    storage.remove = lambda paths: calls.append(list(paths))
    assert run(database_url, storage) == Purged(0, 0, 0)
    assert calls == []


def test_storage_failure_keeps_the_rows_for_the_next_run(database_url, client, storage, alice):
    d = make_design(client, alice)
    client.post(f"/api/designs/{d['id']}/thumbnail", headers=alice.headers)  # it has a file to remove
    client.post(f"/api/designs/{d['id']}/trash", headers=alice.headers)
    backdate(database_url, "designs", d["id"], "deleted_at", days=31)

    def broken(_paths):
        raise RuntimeError("Storage is down")

    storage.remove = broken
    with pytest.raises(RuntimeError):
        run(database_url, storage)
    assert d["id"] in ids(database_url, "designs")


def test_server_start_runs_the_clean_up_unless_turned_off(monkeypatch):
    started = []
    monkeypatch.setattr(main, "open_pool", lambda _url: None)
    monkeypatch.setattr(main, "close_pool", lambda: None)
    monkeypatch.setattr(main, "purge_in_background", lambda: started.append(True))

    async def start_and_stop():
        async with main.lifespan(main.app):
            pass

    for on in (True, False):
        settings = Settings("postgresql://x", "https://x.test", "k", purge_on_start=on)
        monkeypatch.setattr(main, "get_settings", lambda settings=settings: settings)
        asyncio.run(start_and_stop())
    assert started == [True]


def test_PURGE_ON_START_switch(database_url, monkeypatch):
    try:
        for value, expected in [("0", False), ("false", False), ("1", True)]:
            monkeypatch.setenv("PURGE_ON_START", value)
            get_settings.cache_clear()
            assert get_settings().purge_on_start is expected
        monkeypatch.delenv("PURGE_ON_START")
        get_settings.cache_clear()
        assert get_settings().purge_on_start is True  # on unless turned off
    finally:
        # back to the tests' setting (off) before any other test starts the app
        monkeypatch.undo()
        get_settings.cache_clear()
        assert get_settings().purge_on_start is False
