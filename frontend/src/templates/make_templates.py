"""Writes templates.json: Pitch's own templates (S04, S12). Every word, colour and layout here is ours.

To change a template, edit it below and run (from this folder):

    python make_templates.py

The backend test tests/test_templates.py checks every template against the same rules as a saved
design (app/document.py), so a template can never be refused when it's used. Text heights here are
estimates: the editor measures each text box again when a template is used.
"""

import json
from pathlib import Path

OUT = Path(__file__).with_name("templates.json")


def base(i, x, y, w, h, rotation=0, opacity=1):
    return {
        "id": i,
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "rotation": rotation,
        "opacity": opacity,
        "locked": False,
        "flip_x": False,
        "flip_y": False,
    }


def text(i, x, y, w, words, font, size, color, *, bold=False, italic=False, align="center", spacing=0, line=1.2, lines=1):
    return {
        **base(i, x, y, w, round(size * line * lines, 2)),
        "type": "text",
        "text": words,
        "font_family": font,
        "font_size": size,
        "color": color,
        "bold": bold,
        "italic": italic,
        "underline": False,
        "align": align,
        "letter_spacing": spacing,
        "line_height": line,
    }


def shape(i, kind, x, y, w, h, fill, *, stroke=None, stroke_width=0, radius=0, rotation=0, opacity=1):
    return {
        **base(i, x, y, w, h, rotation, opacity),
        "type": "shape",
        "kind": kind,
        "fill": fill,
        "stroke": stroke,
        "stroke_width": stroke_width,
        "corner_radius": radius,
    }


def line(i, x, y, length, color, width=4, *, dash="solid", arrow=False, rotation=0):
    return {
        **base(i, x, y, length, width, rotation),
        "type": "line",
        "stroke": color,
        "stroke_width": width,
        "dash": dash,
        "arrow_start": False,
        "arrow_end": arrow,
    }


def template(slug, title, category, w, h, background, elements):
    return {
        "id": slug,
        "title": title,
        "category": category,
        "width_px": w,
        "height_px": h,
        "content": {"schema_version": 1, "pages": [{"id": "p1", "background": {"color": background}, "elements": elements}]},
    }


INTER, MONT, POP, SPACE = "Inter Variable", "Montserrat Variable", "Poppins", "Space Grotesk Variable"
PLAYFAIR, LORA, OSWALD, BEBAS, CAVEAT = "Playfair Display Variable", "Lora Variable", "Oswald Variable", "Bebas Neue", "Caveat Variable"

TEMPLATES = [
    # --- social posts, 1080 x 1080 ---------------------------------------------------------------
    template("weekend-sale", "Weekend sale", "social_post", 1080, 1080, "#fff4d6", [
        shape("burst", "ellipse", 640, -120, 560, 560, "#ffb703"),
        shape("band", "rect", 0, 620, 1080, 200, "#1d3557"),
        text("kicker", 90, 180, 900, "THIS WEEKEND ONLY", MONT, 40, "#1d3557", bold=True, align="left", spacing=6),
        text("title", 90, 250, 900, "BIG SALE", BEBAS, 260, "#e63946", align="left", line=1),
        text("offer", 90, 665, 900, "Up to 40% off everything in store", MONT, 52, "#ffffff", bold=True, align="left"),
        text("small", 90, 900, 900, "Sat & Sun · 10 am – 6 pm", MONT, 34, "#1d3557", align="left"),
    ]),
    template("quote-card", "Quote card", "social_post", 1080, 1080, "#f1ede4", [
        shape("frame", "rect", 60, 60, 960, 960, "#f1ede4", stroke="#2b2d42", stroke_width=4),
        text("mark", 90, 120, 900, "“", PLAYFAIR, 220, "#c9a227", line=1),
        text("quote", 140, 380, 800, "Small steps every day add up to big changes.", PLAYFAIR, 68, "#2b2d42", italic=True, line=1.25, lines=3),
        line("rule", 470, 720, 140, "#c9a227", 4),
        text("author", 140, 760, 800, "Your name here", MONT, 34, "#2b2d42", spacing=2),
    ]),
    template("grand-opening", "Grand opening", "social_post", 1080, 1080, "#264653", [
        shape("circle", "ellipse", 190, 150, 700, 700, "#2a9d8f"),
        shape("ring", "ellipse", 160, 120, 760, 760, "#264653", stroke="#e9c46a", stroke_width=6, opacity=0.9),
        text("we-are", 190, 300, 700, "We're opening", POP, 56, "#ffffff"),
        text("big", 190, 380, 700, "GRAND OPENING", OSWALD, 104, "#e9c46a", bold=True, line=1.05, lines=2),
        text("date", 190, 640, 700, "Friday, 9 am", POP, 46, "#ffffff", bold=True),
        text("place", 90, 940, 900, "12 Market Street · everyone welcome", POP, 32, "#e9c46a"),
    ]),
    template("thank-you", "Thank you note", "social_post", 1080, 1350, "#fdf0ec", [
        shape("top", "rect", 0, 0, 1080, 420, "#e76f51"),
        shape("dot", "ellipse", 440, 300, 200, 200, "#fdf0ec", stroke="#e76f51", stroke_width=10),
        text("heart", 440, 345, 200, "♥", INTER, 90, "#e76f51", line=1),
        text("title", 90, 600, 900, "Thank you!", CAVEAT, 170, "#264653", bold=True, line=1),
        text("body", 140, 840, 800, "To everyone who came, helped and cheered: we couldn't have done it without you.", LORA, 44, "#264653", line=1.4, lines=3),
    ]),
    # --- stories, 1080 x 1920 --------------------------------------------------------------------
    template("event-story", "Event story", "story", 1080, 1920, "#14213d", [
        shape("sun", "ellipse", 540, 180, 640, 640, "#fca311"),
        shape("panel", "rect", 80, 900, 920, 760, "#ffffff", radius=48),
        text("when", 140, 980, 800, "SAT 14 JUNE", OSWALD, 64, "#fca311", bold=True, align="left", spacing=4),
        text("what", 140, 1080, 800, "Rooftop music night", OSWALD, 120, "#14213d", bold=True, align="left", line=1.05, lines=2),
        text("details", 140, 1360, 800, "Doors 7 pm · Live sets till late · Free entry before 8", POP, 42, "#14213d", align="left", line=1.4, lines=2),
        line("arrow", 140, 1560, 260, "#fca311", 8, arrow=True),
        text("cta", 420, 1530, 520, "Swipe up to join", POP, 40, "#14213d", bold=True, align="left"),
    ]),
    template("tip-of-the-day", "Tip of the day", "story", 1080, 1920, "#e8f1ec", [
        shape("tag", "rect", 100, 260, 420, 110, "#2d6a4f", radius=55),
        text("tag-text", 100, 285, 420, "TIP OF THE DAY", SPACE, 40, "#ffffff", bold=True, spacing=3),
        text("tip", 100, 520, 880, "Water your plants in the morning, not at night.", SPACE, 96, "#1b4332", bold=True, align="left", line=1.1, lines=4),
        text("why", 100, 1050, 880, "Leaves dry during the day, which keeps mould away.", SPACE, 48, "#2d6a4f", align="left", line=1.35, lines=2),
        shape("leaf", "ellipse", 640, 1380, 360, 520, "#95d5b2", rotation=24),
        shape("leaf2", "ellipse", 520, 1480, 260, 380, "#52b788", rotation=-18),
    ]),
    # --- presentations, 1920 x 1080 --------------------------------------------------------------
    template("title-slide", "Title slide", "presentation", 1920, 1080, "#ffffff", [
        shape("side", "rect", 0, 0, 640, 1080, "#3a0ca3"),
        shape("corner", "triangle", 420, 760, 440, 320, "#f72585", opacity=0.9),
        text("label", 760, 300, 1060, "QUARTERLY UPDATE", MONT, 40, "#7209b7", bold=True, align="left", spacing=6),
        text("title", 760, 380, 1060, "How we grew this spring", MONT, 110, "#14213d", bold=True, align="left", line=1.05, lines=2),
        text("by", 760, 700, 1060, "Presented by the team · June", MONT, 40, "#4a4e69", align="left"),
    ]),
    template("three-points", "Three key points", "presentation", 1920, 1080, "#f8f9fa", [
        text("title", 140, 110, 1640, "Three things to remember", INTER, 84, "#212529", bold=True, align="left"),
        shape("c1", "rect", 140, 330, 500, 560, "#ffffff", stroke="#dee2e6", stroke_width=2, radius=24),
        shape("c2", "rect", 710, 330, 500, 560, "#ffffff", stroke="#dee2e6", stroke_width=2, radius=24),
        shape("c3", "rect", 1280, 330, 500, 560, "#ffffff", stroke="#dee2e6", stroke_width=2, radius=24),
        text("n1", 190, 380, 400, "01", INTER, 96, "#4361ee", bold=True, align="left"),
        text("n2", 760, 380, 400, "02", INTER, 96, "#4361ee", bold=True, align="left"),
        text("n3", 1330, 380, 400, "03", INTER, 96, "#4361ee", bold=True, align="left"),
        text("t1", 190, 540, 400, "Start with the problem, not the tool.", INTER, 44, "#212529", align="left", line=1.3, lines=3),
        text("t2", 760, 540, 400, "Show one idea per slide.", INTER, 44, "#212529", align="left", line=1.3, lines=2),
        text("t3", 1330, 540, 400, "End with what you need from people.", INTER, 44, "#212529", align="left", line=1.3, lines=3),
    ]),
    # --- posters, 1080 x 1350 ---------------------------------------------------------------------
    template("workshop-poster", "Workshop poster", "poster", 1080, 1350, "#fefae0", [
        shape("block", "rect", 0, 0, 1080, 560, "#606c38"),
        shape("sun", "ellipse", 760, 120, 240, 240, "#dda15e"),
        text("free", 80, 140, 700, "FREE WORKSHOP", OSWALD, 56, "#fefae0", bold=True, align="left", spacing=4),
        text("title", 80, 230, 700, "Build your first website", OSWALD, 104, "#fefae0", bold=True, align="left", line=1.05, lines=2),
        text("when", 80, 640, 920, "Every Tuesday · 6 – 8 pm", POP, 52, "#283618", bold=True, align="left"),
        text("where", 80, 730, 920, "Community library, room 3", POP, 44, "#283618", align="left"),
        text("bring", 80, 860, 920, "Bring a laptop. No experience needed: we start from zero.", POP, 40, "#606c38", align="left", line=1.4, lines=2),
        line("rule", 80, 1110, 920, "#bc6c25", 4, dash="dashed"),
        text("signup", 80, 1150, 920, "Sign up at the front desk", POP, 40, "#bc6c25", bold=True, align="left"),
    ]),
    template("bake-sale", "Bake sale", "poster", 1080, 1350, "#fff1f3", [
        shape("plate", "ellipse", 190, 760, 700, 700, "#ffccd5"),
        shape("cake", "rect", 340, 860, 400, 220, "#ff8fa3", radius=30),
        shape("icing", "rect", 320, 830, 440, 70, "#ffffff", radius=35),
        shape("cherry", "ellipse", 510, 770, 60, 60, "#c9184a"),
        text("title", 90, 140, 900, "Bake sale", CAVEAT, 190, "#c9184a", bold=True, line=1),
        text("cause", 140, 400, 800, "Every slice helps fix up the school garden", LORA, 48, "#590d22", line=1.35, lines=2),
        text("when", 140, 580, 800, "Saturday · 11 am · Main hall", LORA, 40, "#590d22", bold=True),
    ]),
    # --- A4 documents, 794 x 1123 ---------------------------------------------------------------
    template("party-invitation", "Party invitation", "a4_document", 794, 1123, "#fffaf0", [
        shape("border", "rect", 40, 40, 714, 1043, "#fffaf0", stroke="#b5838d", stroke_width=3, radius=16),
        shape("b1", "ellipse", 90, 90, 120, 150, "#e5989b"),
        shape("b2", "ellipse", 600, 110, 110, 140, "#b5838d"),
        line("s1", 150, 300, 160, "#b5838d", 2, rotation=80),
        line("s2", 655, 310, 160, "#b5838d", 2, rotation=100),
        text("youre", 97, 360, 600, "You're invited to", LORA, 34, "#6d6875", italic=True),
        text("name", 97, 420, 600, "Maya turns 30!", CAVEAT, 104, "#b5838d", bold=True, line=1),
        text("details", 97, 600, 600, "Saturday 21 September\n7 pm until late\nThe Garden Room, 4 Elm Road", LORA, 32, "#6d6875", line=1.5, lines=3),
        text("rsvp", 97, 880, 600, "Let us know by 10 September", LORA, 26, "#b5838d", bold=True),
    ]),
    template("meeting-notes", "Meeting notes", "a4_document", 794, 1123, "#ffffff", [
        shape("head", "rect", 0, 0, 794, 160, "#023e8a"),
        text("title", 60, 52, 674, "Meeting notes", INTER, 52, "#ffffff", bold=True, align="left"),
        text("meta", 60, 200, 674, "Date: ____   Time: ____   Who: ____", INTER, 22, "#495057", align="left"),
        text("h1", 60, 280, 674, "Agenda", INTER, 30, "#023e8a", bold=True, align="left"),
        text("agenda", 60, 330, 674, "1. \n2. \n3. ", INTER, 24, "#212529", align="left", line=1.8, lines=3),
        text("h2", 60, 500, 674, "Decisions", INTER, 30, "#023e8a", bold=True, align="left"),
        line("l1", 60, 560, 674, "#ced4da", 2),
        line("l2", 60, 620, 674, "#ced4da", 2),
        text("h3", 60, 690, 674, "Next steps", INTER, 30, "#023e8a", bold=True, align="left"),
        line("l3", 60, 750, 674, "#ced4da", 2),
        line("l4", 60, 810, 674, "#ced4da", 2),
        line("l5", 60, 870, 674, "#ced4da", 2),
    ]),
]


def main():
    ids = [t["id"] for t in TEMPLATES]
    assert len(ids) == len(set(ids)), "template ids must be unique"
    OUT.write_text(json.dumps(TEMPLATES, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(TEMPLATES)} templates to {OUT.name}")


if __name__ == "__main__":
    main()
