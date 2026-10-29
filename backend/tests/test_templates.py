"""Pitch's own templates (frontend/src/templates/templates.json) follow the same rules as a saved design,
so using one can never be refused by the server (milestone 3d)."""

import json
from pathlib import Path

import pytest

from app.document import DesignContent

TEMPLATES_FILE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "templates" / "templates.json"
TEMPLATES = json.loads(TEMPLATES_FILE.read_text(encoding="utf-8"))
CATEGORIES = {"social_post", "story", "presentation", "a4_document", "poster"}  # same list as the templates table


def test_there_are_templates_with_unique_ids_and_titles():
    assert len(TEMPLATES) >= 10
    assert len({t["id"] for t in TEMPLATES}) == len(TEMPLATES)
    assert len({t["title"] for t in TEMPLATES}) == len(TEMPLATES)


@pytest.mark.parametrize("template", TEMPLATES, ids=[t["id"] for t in TEMPLATES])
def test_template_is_a_valid_design(template):
    assert template["category"] in CATEGORIES
    assert 40 <= template["width_px"] <= 8000 and 40 <= template["height_px"] <= 8000
    DesignContent.model_validate(template["content"])


def test_a_design_made_from_a_template_saves(client, alice):
    t = TEMPLATES[0]
    size = {"title": t["title"], "width_px": t["width_px"], "height_px": t["height_px"]}
    d = client.post("/api/designs", json=size, headers=alice.headers).json()
    body = {"content": t["content"], "revision": 1}
    res = client.put(f"/api/designs/{d['id']}/content", json=body, headers=alice.headers)
    assert res.status_code == 200, res.text
