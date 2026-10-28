"""The design document stored in designs.content (see replica/architecture.md).

Every save is checked against these models before it reaches the database.
They mirror frontend/src/lib/document.ts. When the editor gets a new element
type or field, add it here first, or saves will be refused with 422.
"""

from collections.abc import Iterator
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Hex = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
ElementId = Annotated[str, StringConstraints(min_length=1, max_length=64)]
Coord = Annotated[float, Field(ge=-100_000, le=100_000)]
Length = Annotated[float, Field(gt=0, le=100_000)]

MAX_ELEMENTS_PER_PAGE = 1000
MAX_ELEMENTS_TOTAL = 5000  # counting elements inside groups
MAX_GROUP_DEPTH = 8


class Strict(BaseModel):
    # unknown fields and NaN / Infinity are refused
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ElementBase(Strict):
    id: ElementId
    x: Coord
    y: Coord
    width: Length
    height: Length
    rotation: Annotated[float, Field(ge=-3600, le=3600)]  # degrees
    opacity: Annotated[float, Field(ge=0, le=1)]
    locked: bool
    flip_x: bool
    flip_y: bool
    name: Annotated[str, StringConstraints(max_length=100)] | None = None


class TextElement(ElementBase):
    type: Literal["text"]
    text: Annotated[str, StringConstraints(max_length=10_000)]
    font_family: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    font_size: Annotated[float, Field(ge=1, le=800)]
    color: Hex
    bold: bool
    italic: bool
    underline: bool
    align: Literal["left", "center", "right", "justify"]
    letter_spacing: Annotated[float, Field(ge=-1000, le=1000)]
    line_height: Annotated[float, Field(ge=0.5, le=3)]


class ShapeElement(ElementBase):
    type: Literal["shape"]
    kind: Literal["rect", "ellipse", "triangle"]
    fill: Hex
    stroke: Hex | None
    stroke_width: Annotated[float, Field(ge=0, le=1000)]
    corner_radius: Annotated[float, Field(ge=0, le=100_000)]


class AssetSource(Strict):
    kind: Literal["asset"]
    asset_id: UUID


class ImageElement(ElementBase):
    type: Literal["image"]
    src: AssetSource
    corner_radius: Annotated[float, Field(ge=0, le=100_000)]


class LineElement(ElementBase):
    """A straight line across the middle of its box, from left to right; rotation turns it.
    width = its length, height = its thickness."""

    type: Literal["line"]
    stroke: Hex
    stroke_width: Annotated[float, Field(ge=0.5, le=1000)]
    dash: Literal["solid", "dashed", "dotted"]
    arrow_start: bool
    arrow_end: bool


class GroupElement(ElementBase):
    """Elements moved, resized and rotated as one. Children's x / y are relative to the group's
    top-left corner; groups can hold groups."""

    type: Literal["group"]
    children: Annotated[list["Element"], Field(min_length=1, max_length=MAX_ELEMENTS_PER_PAGE)]


Element = Annotated[TextElement | ShapeElement | ImageElement | LineElement | GroupElement, Field(discriminator="type")]
GroupElement.model_rebuild()


def walk(elements: list) -> Iterator[tuple[object, int]]:
    """Every element and its depth (1 = directly on the page), including inside groups."""
    stack = [(el, 1) for el in elements]
    while stack:
        el, depth = stack.pop()
        yield el, depth
        if isinstance(el, GroupElement):
            stack.extend((child, depth + 1) for child in el.children)


class Background(Strict):
    color: Hex


class Page(Strict):
    id: ElementId
    background: Background
    elements: Annotated[list[Element], Field(max_length=MAX_ELEMENTS_PER_PAGE)]  # last = on top


class DesignContent(Strict):
    schema_version: Literal[1]
    pages: Annotated[list[Page], Field(min_length=1, max_length=200)]

    @model_validator(mode="after")
    def limits(self) -> "DesignContent":
        found = [depth for page in self.pages for _, depth in walk(page.elements)]
        if len(found) > MAX_ELEMENTS_TOTAL:
            raise ValueError(f"A design can hold at most {MAX_ELEMENTS_TOTAL} elements.")
        # depth counts the element itself, so 8 groups inside each other plus their content = 9
        if found and max(found) > MAX_GROUP_DEPTH + 1:
            raise ValueError(f"Groups can sit inside each other at most {MAX_GROUP_DEPTH} deep.")
        return self

    def asset_ids(self) -> set[UUID]:
        return {el.src.asset_id for page in self.pages for el, _ in walk(page.elements) if isinstance(el, ImageElement)}
