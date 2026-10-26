import psycopg

from .conftest import make_design, upload


def count_rows(database_url, owner_id):
    with psycopg.connect(database_url) as conn:
        return {
            table: conn.execute(f"select count(*) from {table} where {col} = %s", (owner_id,)).fetchone()[0]
            for table, col in [
                ("profiles", "id"),
                ("designs", "owner_id"),
                ("folders", "owner_id"),
                ("assets", "owner_id"),
            ]
        }


def test_delete_account_deletes_everything(database_url, client, storage, alice, bob):
    upload(client, storage, alice)
    d = make_design(client, alice)
    client.post(f"/api/designs/{d['id']}/thumbnail", headers=alice.headers)
    storage.put(f"{alice.id}/thumbnails/{d['id']}.png", 10, "image/png")
    client.post("/api/folders", json={"name": "F"}, headers=alice.headers)
    bobs_asset = upload(client, storage, bob)

    assert client.request("DELETE", "/api/me", json={"confirm": "DELETE"}, headers=alice.headers).status_code == 204

    assert set(count_rows(database_url, alice.id).values()) == {0}
    assert all(not path.startswith(str(alice.id)) for path in storage.files)
    assert storage.deleted_auth_users == [alice.id]
    # bob is untouched
    assert client.get("/api/assets", headers=bob.headers).json()[0]["id"] == bobs_asset["id"]


def test_delete_account_needs_confirmation(client, alice):
    for body in [None, {}, {"confirm": "yes"}]:
        assert client.request("DELETE", "/api/me", json=body, headers=alice.headers).status_code == 422
    assert client.get("/api/me", headers=alice.headers).status_code == 200


def test_auth_user_deleted_only_after_rows(database_url, client, storage, alice):
    """If Supabase's delete-user call fails, the data is already gone and a retry finishes the job."""
    make_design(client, alice)

    def broken(_user_id):
        raise RuntimeError("Supabase is down")

    storage.delete_auth_user = broken
    try:
        client.request("DELETE", "/api/me", json={"confirm": "DELETE"}, headers=alice.headers)
    except RuntimeError:
        pass
    assert count_rows(database_url, alice.id)["designs"] == 0
