"""Fills a database with made-up designs and folders (no real people).

    uv run --env-file ../.env.local python -m app.seed --owner <your user id>

--owner: your Supabase user id (Dashboard > Authentication > Users), so the
         designs show up when you log in. Without it, a demo profile is used.
Refuses to touch a database that isn't on this computer unless you add
--allow-remote, so it can't be run against production by accident.
"""

import argparse
import os
import sys
from urllib.parse import urlparse
from uuid import UUID, uuid4

import psycopg
from psycopg.types.json import Jsonb

DEMO_OWNER = UUID("00000000-0000-4000-8000-00000000d3a0")

FOLDERS = ["Bake sale", "Book club", "Portfolio"]
# title, width, height, background, headline, line, folder index or None
DESIGNS = [
    ("Spring bake sale poster", 1080, 1350, "#fff4e0", "Spring Bake Sale", "Saturday 10–2 · Hall B", 0),
    ("Bake sale price cards", 1050, 600, "#ffffff", "Lemon bars ₹60", "Gluten free on request", 0),
    ("October book club story", 1080, 1920, "#1d2127", "This month: The Quiet Orchard", "Thursday 7 pm", 1),
    ("Reading list slide", 1920, 1080, "#f4efe6", "Next three picks", "Vote in the group chat", 1),
    ("Portfolio cover", 1920, 1080, "#e8eef6", "Selected work 2026", "Illustration · Layout · Type", 2),
    ("Plant swap flyer", 794, 1123, "#eef6ea", "Community Plant Swap", "Bring one, take one", None),
]


def element_base(x, y, w, h):
    return {
        "id": str(uuid4()),
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "rotation": 0,
        "opacity": 1,
        "locked": False,
        "flip_x": False,
        "flip_y": False,
    }


def text(w, h, y_frac, value, size_frac, color, bold):
    font_size = max(8, round(min(w, h) * size_frac))
    width = round(w * 0.8)
    return {
        **element_base(round(w * 0.1), round(h * y_frac), width, round(font_size * 1.3)),
        "type": "text",
        "text": value,
        "font_family": "Inter Variable",
        "font_size": font_size,
        "color": color,
        "bold": bold,
        "italic": False,
        "underline": False,
        "align": "center",
        "letter_spacing": 0,
        "line_height": 1.3,
    }


def content(w, h, background, headline, line):
    dark = background == "#1d2127"
    ink = "#ffffff" if dark else "#15181d"
    band = {
        **element_base(0, round(h * 0.7), w, round(h * 0.3)),
        "type": "shape",
        "kind": "rect",
        "fill": "#f2b705",
        "stroke": None,
        "stroke_width": 0,
        "corner_radius": 0,
    }
    return {
        "schema_version": 1,
        "pages": [
            {
                "id": str(uuid4()),
                "background": {"color": background},
                "elements": [
                    band,
                    text(w, h, 0.3, headline, 0.08, ink, True),
                    text(w, h, 0.45, line, 0.035, ink, False),
                ],
            }
        ],
    }


def seed(database_url: str, owner: UUID) -> None:
    with psycopg.connect(database_url) as conn:
        conn.execute(
            "insert into profiles (id, display_name) values (%s, %s) on conflict do nothing", (owner, "Demo designer")
        )
        folder_ids = [
            conn.execute("insert into folders (owner_id, name) values (%s, %s) returning id", (owner, name)).fetchone()[
                0
            ]
            for name in FOLDERS
        ]
        for title, w, h, bg, headline, line, folder in DESIGNS:
            conn.execute(
                """insert into designs (owner_id, folder_id, title, width_px, height_px, content)
                   values (%s, %s, %s, %s, %s, %s)""",
                (
                    owner,
                    folder_ids[folder] if folder is not None else None,
                    title,
                    w,
                    h,
                    Jsonb(content(w, h, bg, headline, line)),
                ),
            )
    print(f"Seeded {len(FOLDERS)} folders and {len(DESIGNS)} designs for {owner}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Add made-up designs to a database.")
    parser.add_argument("--owner", type=UUID, default=DEMO_OWNER)
    parser.add_argument("--allow-remote", action="store_true")
    args = parser.parse_args()
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set. Run with: uv run --env-file ../.env.local python -m app.seed")
    host = urlparse(url).hostname
    if host not in ("localhost", "127.0.0.1", None) and not args.allow_remote:
        sys.exit(f"DATABASE_URL points at {host}. Add --allow-remote if you really mean to seed it.")
    seed(url, args.owner)
