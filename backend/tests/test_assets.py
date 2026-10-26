from uuid import uuid4

from .conftest import upload

MB = 1024 * 1024


def start(client, user, **body):
    return client.post("/api/assets", json={"mime": "image/png", "size_bytes": 1000, **body}, headers=user.headers)


def test_three_step_upload(client, storage, alice):
    asset = upload(client, storage, alice)
    assert asset["width_px"] == 640 and asset["url"].startswith("https://")
    listed = client.get("/api/assets", headers=alice.headers).json()
    assert [a["id"] for a in listed] == [asset["id"]]


def test_type_and_size_limits(client, alice):
    assert start(client, alice, mime="image/svg+xml").json()["detail"] == "Use a PNG, JPG or WebP image."
    assert start(client, alice, size_bytes=25 * MB + 1).json()["detail"] == "That image is over 25 MB."
    assert start(client, alice, size_bytes=0).status_code == 422


def test_quota(client, storage, alice):
    for _ in range(8):
        upload(client, storage, alice, size=25 * MB)  # 200 MB used
    res = start(client, alice, size_bytes=1)
    assert res.status_code == 422 and res.json()["detail"] == "You've used your 200 MB of uploads."


def test_complete_before_upload_and_pending_not_listed(client, alice):
    started = start(client, alice).json()
    assert client.get("/api/assets", headers=alice.headers).json() == []
    res = client.post(
        f"/api/assets/{started['id']}/complete", json={"width_px": 1, "height_px": 1}, headers=alice.headers
    )
    assert res.json()["detail"] == "The upload didn't arrive. Try again."


def test_file_that_does_not_match_is_thrown_away(client, storage, alice):
    started = start(client, alice, size_bytes=1000).json()
    storage.put(started["upload"]["path"], 25 * MB, "image/png")  # bigger than promised
    res = client.post(
        f"/api/assets/{started['id']}/complete", json={"width_px": 1, "height_px": 1}, headers=alice.headers
    )
    assert res.status_code == 422
    assert started["upload"]["path"] not in storage.files
    # the row is gone too, so it no longer counts against the quota
    assert client.post(f"/api/assets/{started['id']}/trash", headers=alice.headers).status_code == 404


def test_image_side_limit(client, storage, alice):
    started = start(client, alice).json()
    storage.put(started["upload"]["path"], 1000, "image/png")
    res = client.post(
        f"/api/assets/{started['id']}/complete", json={"width_px": 8001, "height_px": 10}, headers=alice.headers
    )
    assert res.json()["detail"] == "That image is over 8000 px on one side."


def test_retried_start_and_complete_are_harmless(client, storage, alice, bob):
    asset_id = str(uuid4())
    first = start(client, alice, id=asset_id).json()
    second = start(client, alice, id=asset_id).json()
    assert first["id"] == second["id"] == asset_id and second["upload"]
    storage.put(first["upload"]["path"], 1000, "image/png")
    body = {"width_px": 5, "height_px": 5}
    done = client.post(f"/api/assets/{asset_id}/complete", json=body, headers=alice.headers).json()
    assert client.post(f"/api/assets/{asset_id}/complete", json=body, headers=alice.headers).json() == done
    assert start(client, alice, id=asset_id).json()["upload"] is None  # already uploaded
    assert start(client, bob, id=asset_id).status_code == 409  # someone else's id


def test_trash_restore_delete(client, storage, alice):
    asset = upload(client, storage, alice)
    assert client.post(f"/api/assets/{asset['id']}/trash", headers=alice.headers).status_code == 204
    assert client.get("/api/assets", headers=alice.headers).json() == []
    assert len(client.get("/api/assets?in_trash=true", headers=alice.headers).json()) == 1
    assert client.post(f"/api/assets/{asset['id']}/restore", headers=alice.headers).status_code == 204
    assert client.delete(f"/api/assets/{asset['id']}", headers=alice.headers).status_code == 204
    assert storage.files == {}
    assert client.get("/api/assets", headers=alice.headers).json() == []


def test_upload_start_is_rate_limited(client, alice):
    codes = [start(client, alice, mime="image/gif").status_code for _ in range(61)]
    assert codes[:60] == [422] * 60 and codes[60] == 429
