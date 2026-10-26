"""The second-user test: bob must get nothing of alice's back, from any route.

A row you don't own answers exactly like a missing one (404), so bob can't
even tell whether an id exists.
"""

import pytest

from .conftest import blank_content, make_design, upload


@pytest.fixture
def alices_things(client, storage, alice):
    design = make_design(client, alice, title="Alice's secret plans")
    folder = client.post("/api/folders", json={"name": "Alice only"}, headers=alice.headers).json()
    asset = upload(client, storage, alice)
    trashed = make_design(client, alice)
    client.post(f"/api/designs/{trashed['id']}/trash", headers=alice.headers)
    return {"design": design["id"], "folder": folder["id"], "asset": asset["id"], "trashed": trashed["id"]}


def test_lists_are_empty_for_bob(client, bob, alices_things):
    for path in [
        "/api/designs",
        "/api/designs?in_trash=true",
        "/api/designs?sort=title&q=secret",
        f"/api/designs?folder_id={alices_things['folder']}",
        "/api/folders",
        "/api/assets",
        "/api/assets?in_trash=true",
    ]:
        res = client.get(path, headers=bob.headers)
        assert res.status_code == 200 and res.json() == [], path


def test_every_route_on_alices_ids_is_404_for_bob(client, bob, alices_things):
    d, f, a, t = (alices_things[k] for k in ("design", "folder", "asset", "trashed"))
    calls = [
        ("GET", f"/api/designs/{d}", None),
        ("PUT", f"/api/designs/{d}/content", {"content": blank_content(), "revision": 1}),
        ("PATCH", f"/api/designs/{d}", {"title": "mine now"}),
        ("POST", f"/api/designs/{d}/trash", None),
        ("POST", f"/api/designs/{t}/restore", None),
        ("DELETE", f"/api/designs/{t}", None),
        ("POST", f"/api/designs/{d}/thumbnail", None),
        ("PATCH", f"/api/folders/{f}", {"name": "mine now"}),
        ("DELETE", f"/api/folders/{f}", None),
        ("POST", f"/api/assets/{a}/complete", {"width_px": 1, "height_px": 1}),
        ("POST", f"/api/assets/{a}/trash", None),
        ("POST", f"/api/assets/{a}/restore", None),
        ("DELETE", f"/api/assets/{a}", None),
    ]
    for method, path, body in calls:
        res = client.request(method, path, json=body, headers=bob.headers)
        assert res.status_code == 404, (method, path, res.status_code)
        assert "secret" not in res.text and "Alice" not in res.text


def test_bob_cannot_move_his_design_into_alices_folder(client, bob, alices_things):
    mine = make_design(client, bob)
    res = client.patch(f"/api/designs/{mine['id']}", json={"folder_id": alices_things["folder"]}, headers=bob.headers)
    assert res.status_code == 404


def test_nothing_of_alices_changed(client, alice, alices_things):
    opened = client.get(f"/api/designs/{alices_things['design']}", headers=alice.headers).json()["design"]
    assert opened["title"] == "Alice's secret plans" and opened["revision"] == 1 and opened["deleted_at"] is None
    assert client.get("/api/folders", headers=alice.headers).json()[0]["name"] == "Alice only"
    assert len(client.get("/api/assets", headers=alice.headers).json()) == 1
    assert len(client.get("/api/designs?in_trash=true", headers=alice.headers).json()) == 1
