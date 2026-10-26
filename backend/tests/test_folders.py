from .conftest import make_design


def test_folder_lifecycle_and_counts(client, alice):
    res = client.post("/api/folders", json={"name": "  Client work "}, headers=alice.headers)
    assert res.status_code == 201
    folder = res.json()
    assert folder["name"] == "Client work" and folder["design_count"] == 0

    d1, d2 = make_design(client, alice), make_design(client, alice)
    for d in (d1, d2):
        client.patch(f"/api/designs/{d['id']}", json={"folder_id": folder["id"]}, headers=alice.headers)
    client.post(f"/api/designs/{d2['id']}/trash", headers=alice.headers)
    assert client.get("/api/folders", headers=alice.headers).json()[0]["design_count"] == 1  # trash not counted

    renamed = client.patch(f"/api/folders/{folder['id']}", json={"name": "Clients"}, headers=alice.headers).json()
    assert renamed["name"] == "Clients" and renamed["design_count"] == 1

    assert client.delete(f"/api/folders/{folder['id']}", headers=alice.headers).status_code == 204
    assert client.get("/api/folders", headers=alice.headers).json() == []
    # its designs went back to the root, including the one in Trash
    assert client.get(f"/api/designs/{d1['id']}", headers=alice.headers).json()["design"]["folder_id"] is None
    client.post(f"/api/designs/{d2['id']}/restore", headers=alice.headers)
    assert client.get(f"/api/designs/{d2['id']}", headers=alice.headers).json()["design"]["folder_id"] is None


def test_folder_name_rules(client, alice):
    for name in ["", "   ", "x" * 101]:
        res = client.post("/api/folders", json={"name": name}, headers=alice.headers)
        assert res.status_code == 422 and res.json()["detail"] == "A folder name needs 1–100 characters."


def test_sorted_by_name(client, alice):
    for name in ["b", "C", "a"]:
        client.post("/api/folders", json={"name": name}, headers=alice.headers)
    assert [f["name"] for f in client.get("/api/folders", headers=alice.headers).json()] == ["a", "b", "C"]
