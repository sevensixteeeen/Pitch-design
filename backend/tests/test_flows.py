"""Edge cases from the recon flows (replica/test-plan.md), checked through the API.

Each test name starts with its case id. Screens and the editor are tested
later with Playwright; these are the parts the server is responsible for.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from uuid import uuid4

from .conftest import blank_content, make_design, upload
from .test_designs import image_element, save, text_element

MB = 1024 * 1024


def twice_at_once(fn):
    """Run fn() twice at the same moment, like a double click or two tabs."""
    with ThreadPoolExecutor(2) as pool:
        return [f.result() for f in [pool.submit(fn), pool.submit(fn)]]


# --- F01 new user signs up -----------------------------------------------------------------


def test_F01_E4_first_requests_at_once_create_one_profile(client, alice):
    # the app fires several requests right after sign-up; each creates the profile if missing
    results = twice_at_once(lambda: client.get("/api/me", headers=alice.headers))
    assert [r.status_code for r in results] == [200, 200]


# --- F02 core loop -------------------------------------------------------------------------


def test_F02_H1_create_edit_reopen(client, alice):
    d = make_design(client, alice, width_px=1200, height_px=628, title="Launch banner")
    content = blank_content([text_element(text="Hello")])
    assert save(client, alice, d["id"], content, 1).status_code == 200
    opened = client.get(f"/api/designs/{d['id']}", headers=alice.headers).json()["design"]
    assert opened["content"] == content and opened["revision"] == 2
    assert [x["title"] for x in client.get("/api/designs", headers=alice.headers).json()] == ["Launch banner"]


def test_F02_E5_double_click_create_makes_one_design(client, alice):
    design_id = str(uuid4())
    body = {"id": design_id, "width_px": 1080, "height_px": 1080}
    results = twice_at_once(lambda: client.post("/api/designs", json=body, headers=alice.headers))
    assert [r.status_code for r in results] == [201, 201]
    assert len(client.get("/api/designs", headers=alice.headers).json()) == 1


def test_F02_E6_very_long_and_emoji_titles(client, alice):
    assert make_design(client, alice, title="x" * 255)["title"] == "x" * 255
    res = client.post(
        "/api/designs", json={"title": "x" * 256, "width_px": 100, "height_px": 100}, headers=alice.headers
    )
    assert res.status_code == 422 and res.json()["detail"] == "A title needs 1–255 characters."
    # 255 emoji: 255 characters for Python and Postgres alike
    assert make_design(client, alice, title="🎨" * 255)["title"] == "🎨" * 255
    assert make_design(client, alice, title="Café déjà vu — ñandú 🎨")["title"] == "Café déjà vu — ñandú 🎨"


def test_F02_E7_long_and_emoji_text_in_design(client, alice):
    d = make_design(client, alice)
    ok = blank_content([text_element(text="Ünïcødé ✨ " * 1000)])  # exactly 10,000 characters
    assert save(client, alice, d["id"], ok, 1).status_code == 200
    too_long = blank_content([text_element(text="x" * 10_001)])
    assert save(client, alice, d["id"], too_long, 2).status_code == 422


def test_F02_E8_search_with_accents_and_case(client, alice):
    make_design(client, alice, title="Café menu")
    make_design(client, alice, title="Ürün katalog")

    def titles(q):
        return [d["title"] for d in client.get("/api/designs", params={"q": q}, headers=alice.headers).json()]

    assert titles("café") == ["Café menu"]
    assert titles("CAFÉ") == ["Café menu"]
    assert titles("ürün") == ["Ürün katalog"]


def test_F02_E9_times_carry_a_time_zone(client, alice):
    d = make_design(client, alice)
    for field in ("created_at", "updated_at"):
        assert datetime.fromisoformat(d[field]).utcoffset() is not None, d[field]


# --- F04 use my own photo ------------------------------------------------------------------


def test_F04_E2_unsupported_type_heic(client, alice):
    res = client.post("/api/assets", json={"mime": "image/heic", "size_bytes": 1000}, headers=alice.headers)
    assert res.json()["detail"] == "Use a PNG, JPG or WebP image."


def test_F04_E3_upload_fails_halfway_then_retry(client, storage, alice):
    asset_id = str(uuid4())
    body = {"id": asset_id, "mime": "image/jpeg", "size_bytes": 5000}
    client.post("/api/assets", json=body, headers=alice.headers)
    # the upload to Storage never arrived
    size = {"width_px": 10, "height_px": 10}
    assert client.post(f"/api/assets/{asset_id}/complete", json=size, headers=alice.headers).status_code == 422
    # retry with the same id: new token, the file arrives, done
    retry = client.post("/api/assets", json=body, headers=alice.headers).json()
    storage.put(retry["upload"]["path"], 5000, "image/jpeg")
    assert client.post(f"/api/assets/{asset_id}/complete", json=size, headers=alice.headers).status_code == 200
    assert len(client.get("/api/assets", headers=alice.headers).json()) == 1


def test_F04_E6_quota_holds_with_two_uploads_at_once(client, storage, alice):
    for _ in range(7):
        upload(client, storage, alice, size=25 * MB)  # 175 MB used, room for one more 25 MB file

    def start():
        return client.post("/api/assets", json={"mime": "image/png", "size_bytes": 25 * MB}, headers=alice.headers)

    codes = sorted(r.status_code for r in twice_at_once(start))
    assert codes == [201, 422]


def test_F04_E7_image_deleted_forever_shows_as_missing(client, storage, alice):
    asset = upload(client, storage, alice)
    d = make_design(client, alice)
    save(client, alice, d["id"], blank_content([image_element(asset["id"])]), 1)
    client.delete(f"/api/assets/{asset['id']}", headers=alice.headers)
    opened = client.get(f"/api/designs/{d['id']}", headers=alice.headers).json()
    assert opened["asset_urls"] == {}  # the editor draws a "missing image" placeholder
    # and the design can still be saved
    assert save(client, alice, d["id"], opened["design"]["content"], 2).status_code == 200


def test_F04_E8_trashed_upload_still_shows_in_designs(client, storage, alice):
    asset = upload(client, storage, alice)
    d = make_design(client, alice)
    save(client, alice, d["id"], blank_content([image_element(asset["id"])]), 1)
    client.post(f"/api/assets/{asset['id']}/trash", headers=alice.headers)
    assert list(client.get(f"/api/designs/{d['id']}", headers=alice.headers).json()["asset_urls"]) == [asset["id"]]


# --- F06 multi-page design -----------------------------------------------------------------


def test_F06_E2_many_pages(client, alice):
    d = make_design(client, alice)

    def pages(n):
        return {
            "schema_version": 1,
            "pages": [{"id": f"p{i}", "background": {"color": "#ffffff"}, "elements": []} for i in range(n)],
        }

    assert save(client, alice, d["id"], pages(200), 1).status_code == 200
    assert client.get("/api/designs", headers=alice.headers).json()[0]["page_count"] == 200
    assert save(client, alice, d["id"], pages(201), 2).status_code == 422


# --- F07 come back later -------------------------------------------------------------------


def test_F07_E1_two_tabs_save_at_the_same_moment(client, alice):
    d = make_design(client, alice)
    results = twice_at_once(lambda: save(client, alice, d["id"], blank_content([text_element()]), 1))
    assert sorted(r.status_code for r in results) == [200, 409]  # one wins, never a silent overwrite
    assert client.get(f"/api/designs/{d['id']}", headers=alice.headers).json()["design"]["revision"] == 2


def test_F07_E3_reopening_a_trashed_design(client, alice):
    d = make_design(client, alice)
    client.post(f"/api/designs/{d['id']}/trash", headers=alice.headers)
    opened = client.get(f"/api/designs/{d['id']}", headers=alice.headers)
    # it opens (so the editor can offer "Restore"), but it can't be edited
    assert opened.status_code == 200 and opened.json()["design"]["deleted_at"]
    assert save(client, alice, d["id"], blank_content(), 1).status_code == 404


# --- F08 organise --------------------------------------------------------------------------


def test_F08_E4_double_click_trash_keeps_first_time(client, alice):
    d = make_design(client, alice)
    client.post(f"/api/designs/{d['id']}/trash", headers=alice.headers)
    first = client.get("/api/designs?in_trash=true", headers=alice.headers).json()[0]["deleted_at"]
    client.post(f"/api/designs/{d['id']}/trash", headers=alice.headers)
    # the 30-day clock doesn't restart
    assert client.get("/api/designs?in_trash=true", headers=alice.headers).json()[0]["deleted_at"] == first


def test_F08_E5_emoji_folder_name(client, alice):
    res = client.post("/api/folders", json={"name": "Clients 💼 — São Paulo"}, headers=alice.headers)
    assert res.json()["name"] == "Clients 💼 — São Paulo"
