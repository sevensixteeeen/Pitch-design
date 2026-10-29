"""Milestone 3e fields: a photo's crop, and a text box's shadow and outline. All three are optional, so
designs saved before them stay valid."""

from .conftest import make_design, upload
from .test_designs import image_element, save, text_element


def page(elements):
    return {"schema_version": 1, "pages": [{"id": "p1", "background": {"color": "#ffffff"}, "elements": elements}]}


SHADOW = {"color": "#000000", "blur": 12, "offset_x": 4, "offset_y": -6, "opacity": 0.5}
OUTLINE = {"color": "#e63946", "width": 3}
CROP = {"x": 0.1, "y": 0.2, "width": 0.5, "height": 0.75}


def test_crop_shadow_and_outline_save_and_reopen(client, storage, alice):
    asset = upload(client, storage, alice)
    d = make_design(client, alice)
    content = page([{**image_element(asset["id"]), "crop": CROP}, text_element(shadow=SHADOW, outline=OUTLINE)])
    assert save(client, alice, d["id"], content, 1).status_code == 200
    assert client.get(f"/api/designs/{d['id']}", headers=alice.headers).json()["design"]["content"] == content


def test_designs_without_the_new_fields_and_with_null_still_save(client, storage, alice):
    asset = upload(client, storage, alice)
    d = make_design(client, alice)
    assert save(client, alice, d["id"], page([image_element(asset["id"]), text_element()]), 1).status_code == 200
    nulls = page([{**image_element(asset["id"]), "crop": None}, text_element(shadow=None, outline=None)])
    assert save(client, alice, d["id"], nulls, 2).status_code == 200


def test_bad_crop_and_effects_are_refused(client, storage, alice):
    asset = upload(client, storage, alice)
    d = make_design(client, alice)
    image = image_element(asset["id"])
    bad = [
        page([{**image, "crop": {**CROP, "x": -0.1}}]),
        page([{**image, "crop": {**CROP, "width": 0}}]),
        page([{**image, "crop": {**CROP, "x": 0.6, "width": 0.5}}]),  # runs past the right edge
        page([{**image, "crop": {**CROP, "y": 0.5, "height": 0.6}}]),  # past the bottom
        page([{**image, "crop": {**CROP, "extra": 1}}]),
        page([text_element(shadow={**SHADOW, "blur": -1})]),
        page([text_element(shadow={**SHADOW, "opacity": 2})]),
        page([text_element(shadow={**SHADOW, "color": "black"})]),
        page([text_element(outline={**OUTLINE, "width": 0})]),
        page([text_element(outline={**OUTLINE, "width": 101})]),
        page([{**text_element(), "crop": CROP}]),  # crop is for photos only
    ]
    for content in bad:
        assert save(client, alice, d["id"], content, 1).status_code == 422, content
