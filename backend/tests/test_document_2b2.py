"""Milestone 2b-2 element types: triangle shapes, lines (with arrows), groups (which can hold groups)."""

from .conftest import make_design, upload
from .test_designs import image_element, save, shape_element, text_element


def line_element(**overrides):
    return {
        "id": "l1",
        "type": "line",
        "x": 10,
        "y": 50,
        "width": 300,
        "height": 6,
        "rotation": 30,
        "opacity": 1,
        "locked": False,
        "flip_x": False,
        "flip_y": False,
        "stroke": "#15181d",
        "stroke_width": 6,
        "dash": "dashed",
        "arrow_start": False,
        "arrow_end": True,
        **overrides,
    }


def group_element(children, **overrides):
    return {
        "id": "g1",
        "type": "group",
        "x": 100,
        "y": 100,
        "width": 400,
        "height": 300,
        "rotation": 0,
        "opacity": 1,
        "locked": False,
        "flip_x": False,
        "flip_y": False,
        "children": children,
        **overrides,
    }


def page(elements):
    return {"schema_version": 1, "pages": [{"id": "p1", "background": {"color": "#ffffff"}, "elements": elements}]}


def test_triangle_line_and_group_save_and_reopen(client, alice):
    d = make_design(client, alice)
    content = page(
        [
            shape_element(kind="triangle"),
            line_element(),
            group_element([text_element(id="t9"), group_element([shape_element(id="s9")], id="g2")]),
        ]
    )
    assert save(client, alice, d["id"], content, 1).status_code == 200
    assert client.get(f"/api/designs/{d['id']}", headers=alice.headers).json()["design"]["content"] == content


def test_bad_line_and_group_refused(client, alice):
    d = make_design(client, alice)
    bad = [
        page([line_element(dash="wavy")]),
        page([line_element(stroke=None)]),  # a line needs a colour
        page([line_element(stroke_width=0)]),
        page([group_element([])]),  # an empty group
        page([group_element([line_element(extra=1)])]),  # unknown field inside a group
    ]
    for content in bad:
        assert save(client, alice, d["id"], content, 1).status_code == 422, content


def test_groups_nest_at_most_eight_deep(client, alice):
    d = make_design(client, alice)

    def nested(depth):
        el = shape_element(id="leaf")
        for i in range(depth):
            el = group_element([el], id=f"g{i}")
        return el

    assert save(client, alice, d["id"], page([nested(8)]), 1).status_code == 200
    assert save(client, alice, d["id"], page([nested(9)]), 2).status_code == 422


def test_elements_inside_groups_count_towards_the_limit(client, alice):
    d = make_design(client, alice)
    # 5 pages x 1 group of 1000 = 5000 elements inside groups, plus the 5 groups themselves
    big = {
        "schema_version": 1,
        "pages": [
            {
                "id": f"p{p}",
                "background": {"color": "#ffffff"},
                "elements": [group_element([shape_element(id=f"s{p}-{i}") for i in range(1000)], id=f"g{p}")],
            }
            for p in range(5)
        ],
    }
    assert save(client, alice, d["id"], big, 1).status_code == 422


def test_image_inside_a_group_gets_a_link(client, storage, alice):
    asset = upload(client, storage, alice)
    d = make_design(client, alice)
    content = page([group_element([image_element(asset["id"]), shape_element()])])
    assert save(client, alice, d["id"], content, 1).status_code == 200
    urls = client.get(f"/api/designs/{d['id']}", headers=alice.headers).json()["asset_urls"]
    assert list(urls) == [asset["id"]]
