import json
from uuid import uuid4

import psycopg

from .conftest import blank_content, make_design, upload


def text_element(**overrides):
    return {
        "id": "t1",
        "type": "text",
        "x": 10,
        "y": 20,
        "width": 300,
        "height": 40,
        "rotation": 0,
        "opacity": 1,
        "locked": False,
        "flip_x": False,
        "flip_y": False,
        "text": "Hello",
        "font_family": "Inter Variable",
        "font_size": 32,
        "color": "#15181d",
        "bold": True,
        "italic": False,
        "underline": False,
        "align": "center",
        "letter_spacing": 0,
        "line_height": 1.3,
        **overrides,
    }


def shape_element(**overrides):
    return {
        "id": "s1",
        "type": "shape",
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 100,
        "rotation": 0,
        "opacity": 1,
        "locked": False,
        "flip_x": False,
        "flip_y": False,
        "kind": "rect",
        "fill": "#9aa3ad",
        "stroke": None,
        "stroke_width": 0,
        "corner_radius": 0,
        **overrides,
    }


def image_element(asset_id):
    return {
        "id": "i1",
        "type": "image",
        "x": 0,
        "y": 0,
        "width": 64,
        "height": 48,
        "rotation": 0,
        "opacity": 1,
        "locked": False,
        "flip_x": False,
        "flip_y": False,
        "src": {"kind": "asset", "asset_id": asset_id},
        "corner_radius": 0,
    }


def save(client, user, design_id, content, revision):
    return client.put(
        f"/api/designs/{design_id}/content", json={"content": content, "revision": revision}, headers=user.headers
    )


def test_create_blank_design(client, alice):
    d = make_design(client, alice, title="  Poster  ", display_unit="mm")
    assert d["title"] == "Poster"
    assert (d["width_px"], d["height_px"], d["display_unit"]) == (1080, 1350, "mm")
    assert d["revision"] == 1 and d["page_count"] == 1 and d["folder_id"] is None
    assert d["content"]["pages"][0]["elements"] == []
    assert make_design(client, alice)["title"] == "Untitled design"


def test_create_rounds_sizes_and_checks_limits(client, alice):
    assert make_design(client, alice, width_px=100.4, height_px=99.6)["width_px"] == 100
    for w, h, msg in [
        (39, 100, "Each side must be 40–8000 px."),
        (8001, 100, "Each side must be 40–8000 px."),
        (8000, 8000, "That's too large. Width × height can be at most 25 million px."),
    ]:
        res = client.post("/api/designs", json={"width_px": w, "height_px": h}, headers=alice.headers)
        assert res.status_code == 422
        assert res.json()["detail"] == msg


def test_create_with_client_id_is_idempotent(client, alice, bob):
    design_id = str(uuid4())
    first = make_design(client, alice, id=design_id)
    again = make_design(client, alice, id=design_id)
    assert first["id"] == again["id"] == design_id
    listed = client.get("/api/designs", headers=alice.headers).json()
    assert len(listed) == 1
    # someone else's id: refused, and nothing about the design leaks
    res = client.post("/api/designs", json={"id": design_id, "width_px": 100, "height_px": 100}, headers=bob.headers)
    assert res.status_code == 409
    assert "title" not in res.text


def test_autosave_bumps_revision_and_detects_other_tab(client, alice):
    d = make_design(client, alice)
    content = blank_content([text_element(), shape_element()])
    res = save(client, alice, d["id"], content, 1)
    assert res.status_code == 200 and res.json()["revision"] == 2
    # a second tab still on revision 1 must not overwrite
    res = save(client, alice, d["id"], blank_content(), 1)
    assert res.status_code == 409
    opened = client.get(f"/api/designs/{d['id']}", headers=alice.headers).json()["design"]
    assert opened["revision"] == 2
    assert opened["content"] == content  # stored exactly as sent (no added null fields)


def test_autosave_validates_the_document(client, alice):
    d = make_design(client, alice)
    bad = [
        {"schema_version": 1, "pages": []},  # the last page can't be deleted
        blank_content([text_element(color="red")]),
        blank_content([text_element(font_size=0)]),
        blank_content([shape_element(kind="hexagon")]),
        blank_content([text_element(onclick="alert(1)")]),  # unknown field
        blank_content([{"type": "video", "id": "v"}]),
    ]
    for content in bad:
        assert save(client, alice, d["id"], content, 1).status_code == 422, content
    # NaN is not JSON, but Python's parser accepts it; the models must not
    body = json.dumps({"content": blank_content([shape_element()]), "revision": 1}).replace('"x": 0', '"x": NaN')
    assert "NaN" in body
    res = client.put(
        f"/api/designs/{d['id']}/content", content=body, headers={**alice.headers, "Content-Type": "application/json"}
    )
    assert res.status_code == 422


def test_trash_restore_delete(client, alice):
    d = make_design(client, alice)
    assert client.delete(f"/api/designs/{d['id']}", headers=alice.headers).json()["detail"] == "Move it to Trash first."
    assert client.post(f"/api/designs/{d['id']}/trash", headers=alice.headers).status_code == 204
    assert client.get("/api/designs", headers=alice.headers).json() == []
    trashed = client.get("/api/designs?in_trash=true", headers=alice.headers).json()
    assert [t["id"] for t in trashed] == [d["id"]] and trashed[0]["deleted_at"]
    # can't autosave into a trashed design
    assert save(client, alice, d["id"], blank_content(), 1).status_code == 404
    assert client.post(f"/api/designs/{d['id']}/restore", headers=alice.headers).status_code == 204
    assert len(client.get("/api/designs", headers=alice.headers).json()) == 1
    client.post(f"/api/designs/{d['id']}/trash", headers=alice.headers)
    assert client.delete(f"/api/designs/{d['id']}", headers=alice.headers).status_code == 204
    assert client.get(f"/api/designs/{d['id']}", headers=alice.headers).status_code == 404


def test_rename_and_move(client, alice):
    d = make_design(client, alice)
    folder = client.post("/api/folders", json={"name": "Posters"}, headers=alice.headers).json()
    res = client.patch(
        f"/api/designs/{d['id']}", json={"title": "New", "folder_id": folder["id"]}, headers=alice.headers
    )
    assert res.json()["title"] == "New" and res.json()["folder_id"] == folder["id"]
    # leaving folder_id out keeps it; null moves back to the root
    assert (
        client.patch(f"/api/designs/{d['id']}", json={"title": "Newer"}, headers=alice.headers).json()["folder_id"]
        == folder["id"]
    )
    assert (
        client.patch(f"/api/designs/{d['id']}", json={"folder_id": None}, headers=alice.headers).json()["folder_id"]
        is None
    )
    assert client.patch(f"/api/designs/{d['id']}", json={"title": "   "}, headers=alice.headers).status_code == 422
    assert (
        client.patch(f"/api/designs/{d['id']}", json={"folder_id": str(uuid4())}, headers=alice.headers).status_code
        == 404
    )


def test_list_filters_search_and_sort(client, alice):
    folder = client.post("/api/folders", json={"name": "F"}, headers=alice.headers).json()
    a = make_design(client, alice, title="b poster")
    make_design(client, alice, title="A 100% cotton tee")
    make_design(client, alice, title="a_b")
    client.patch(f"/api/designs/{a['id']}", json={"folder_id": folder["id"]}, headers=alice.headers)

    def titles(query):
        return [d["title"] for d in client.get(f"/api/designs?{query}", headers=alice.headers).json()]

    assert titles("sort=title") == ["A 100% cotton tee", "a_b", "b poster"]
    assert titles(f"folder_id={folder['id']}") == ["b poster"]
    assert titles("q=POSTER") == ["b poster"]
    assert titles("q=%25") == ["A 100% cotton tee"]  # % is searched for, not a wildcard
    assert titles("q=_") == ["a_b"]


def test_open_design_signs_only_own_ready_images(client, storage, alice, bob):
    mine = upload(client, storage, alice)
    theirs = upload(client, storage, bob)
    d = make_design(client, alice)
    content = blank_content([image_element(mine["id"]), {**image_element(theirs["id"]), "id": "i2"}])
    assert save(client, alice, d["id"], content, 1).status_code == 200
    urls = client.get(f"/api/designs/{d['id']}", headers=alice.headers).json()["asset_urls"]
    assert list(urls) == [mine["id"]]


def test_thumbnail(client, storage, alice):
    d = make_design(client, alice)
    res = client.post(f"/api/designs/{d['id']}/thumbnail", headers=alice.headers)
    assert res.status_code == 200
    upload_target = res.json()
    assert upload_target["path"] == f"{alice.id}/thumbnails/{d['id']}.png"
    # not uploaded yet: no link
    assert client.get("/api/designs", headers=alice.headers).json()[0]["thumbnail_url"] is None
    storage.put(upload_target["path"], 500, "image/png")
    assert client.get("/api/designs", headers=alice.headers).json()[0]["thumbnail_url"].startswith("https://")
    # deleting the design deletes the thumbnail file too
    client.post(f"/api/designs/{d['id']}/trash", headers=alice.headers)
    client.delete(f"/api/designs/{d['id']}", headers=alice.headers)
    assert upload_target["path"] not in storage.files


def test_content_size_cap_in_database(database_url, client, alice):
    d = make_design(client, alice)
    with psycopg.connect(database_url) as conn:
        try:
            conn.execute(
                "update designs set content = jsonb_set(content, '{pad}', to_jsonb(repeat('x', 2100000)))"
                " where id = %s",
                (d["id"],),
            )
            raise AssertionError("the 2 MB cap did not fire")
        except psycopg.errors.CheckViolation:
            pass


def test_oversized_request_body_refused(client, alice):
    d = make_design(client, alice)
    res = client.put(
        f"/api/designs/{d['id']}/content",
        content=b"x" * (3 * 1024 * 1024 + 1),
        headers={**alice.headers, "Content-Type": "application/json"},
    )
    assert res.status_code == 413
