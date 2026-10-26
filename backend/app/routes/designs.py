"""Designs: list, create, open, autosave, rename / move, trash, delete, thumbnail.

Every query has `owner_id = <caller>`. A design that isn't yours answers
exactly like a missing one (404), so ids can't be probed.
"""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from psycopg import errors
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field

from ..auth import User
from ..db import Conn
from ..document import DesignContent
from ..ratelimit import RateLimit
from ..storage import SignedUpload, Storage, get_storage, thumbnail_path

router = APIRouter(prefix="/api/designs", tags=["designs"])
Files = Annotated[Storage, Depends(get_storage)]

SIZE_MIN, SIZE_MAX, AREA_MAX = 40, 8000, 25_000_000
LIST_LIMIT = 500
SUMMARY_COLUMNS = """id, title, width_px, height_px, display_unit, folder_id, page_count,
    revision, thumbnail_path, deleted_at, created_at, updated_at"""

DisplayUnit = Literal["px", "in", "mm", "cm"]


class DesignSummary(BaseModel):
    id: UUID
    title: str
    width_px: int
    height_px: int
    display_unit: DisplayUnit
    folder_id: UUID | None
    page_count: int
    revision: int
    thumbnail_url: str | None
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class Design(DesignSummary):
    content: DesignContent


class OpenedDesign(BaseModel):
    design: Design
    asset_urls: dict[str, str]  # asset id -> signed link, only for your own images


class NewDesign(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    id: UUID | None = None  # the browser may pick it, so a retried create is harmless
    title: str | None = None
    width_px: float
    height_px: float
    display_unit: DisplayUnit = "px"


class SaveContent(BaseModel):
    content: DesignContent
    revision: Annotated[int, Field(ge=1)]  # the revision this edit started from


class Saved(BaseModel):
    revision: int
    updated_at: datetime


class DesignPatch(BaseModel):
    title: str | None = None
    folder_id: UUID | None = None  # null = move back to the Projects root


def size_error(width: float, height: float) -> str | None:
    """Same rules and wording as sizeError() in frontend/src/lib/document.ts."""
    if width < SIZE_MIN or height < SIZE_MIN or width > SIZE_MAX or height > SIZE_MAX:
        return f"Each side must be {SIZE_MIN}–{SIZE_MAX} px."
    if width * height > AREA_MAX:
        return "That's too large. Width × height can be at most 25 million px."
    return None


def clean_title(title: str | None) -> str:
    title = (title or "").strip()
    if len(title) > 255:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A title needs 1–255 characters.")
    return title


def not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")


def blank_content() -> dict[str, Any]:
    return {"schema_version": 1, "pages": [{"id": str(uuid4()), "background": {"color": "#ffffff"}, "elements": []}]}


def summaries(rows: list[dict[str, Any]], files: Storage) -> list[dict[str, Any]]:
    urls = files.signed_urls(r["thumbnail_path"] for r in rows if r["thumbnail_path"])
    for r in rows:
        r["thumbnail_url"] = urls.get(r.pop("thumbnail_path") or "")
    return rows


def owned_design(conn: Conn, user: User, design_id: UUID, columns: str = SUMMARY_COLUMNS) -> dict[str, Any]:
    row = conn.execute(
        f"select {columns} from designs where id = %s and owner_id = %s", (design_id, user.id)
    ).fetchone()
    if row is None:
        raise not_found()
    return row


@router.get("")
def list_designs(
    user: User,
    conn: Conn,
    files: Files,
    folder_id: UUID | None = None,
    in_trash: bool = False,
    q: Annotated[str | None, Query(max_length=255)] = None,
    sort: Literal["updated", "title"] = "updated",
) -> list[DesignSummary]:
    pattern = None
    if q and q.strip():
        # search for the text as typed: % and _ are not wildcards here
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
    order = "lower(title), id" if sort == "title" else "updated_at desc, id"
    rows = conn.execute(
        f"""select {SUMMARY_COLUMNS} from designs
            where owner_id = %(owner)s
              and (deleted_at is not null) = %(in_trash)s
              and (%(folder)s::uuid is null or folder_id = %(folder)s)
              and (%(pattern)s::text is null or title ilike %(pattern)s)
            order by {order}
            limit {LIST_LIMIT}""",
        {"owner": user.id, "in_trash": in_trash, "folder": folder_id, "pattern": pattern},
    ).fetchall()
    return summaries(rows, files)


@router.post("", status_code=status.HTTP_201_CREATED, response_model_exclude_unset=True)
def create_design(body: NewDesign, user: User, conn: Conn, files: Files) -> Design:
    width, height = round(body.width_px), round(body.height_px)
    if error := size_error(width, height):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, error)
    design_id = body.id or uuid4()
    conn.execute(
        """insert into designs (id, owner_id, title, width_px, height_px, display_unit, content)
           values (%s, %s, %s, %s, %s, %s, %s)
           on conflict (id) do nothing""",
        (
            design_id,
            user.id,
            clean_title(body.title) or "Untitled design",
            width,
            height,
            body.display_unit,
            Jsonb(blank_content()),
        ),
    )
    # read back with the owner: if the id already belonged to someone else, nothing comes back
    row = conn.execute(
        f"select {SUMMARY_COLUMNS}, content from designs where id = %s and owner_id = %s", (design_id, user.id)
    ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That design id is already taken.")
    return summaries([row], files)[0]


@router.get("/{design_id}", response_model_exclude_unset=True)
def open_design(design_id: UUID, user: User, conn: Conn, files: Files) -> OpenedDesign:
    row = owned_design(conn, user, design_id, f"{SUMMARY_COLUMNS}, content")
    design = summaries([row], files)[0]
    asset_ids = DesignContent.model_validate(row["content"]).asset_ids()
    assets = conn.execute(
        """select id, storage_path from assets
           where owner_id = %s and id = any(%s) and status = 'ready'""",
        (user.id, list(asset_ids)),
    ).fetchall()
    # an asset id copied from someone else's design gets no link (shows as "missing image")
    urls = files.signed_urls(a["storage_path"] for a in assets)
    asset_urls = {str(a["id"]): urls[a["storage_path"]] for a in assets if a["storage_path"] in urls}
    return {"design": design, "asset_urls": asset_urls}


@router.put("/{design_id}/content")
def save_content(design_id: UUID, body: SaveContent, user: User, conn: Conn) -> Saved:
    content = body.content.model_dump(mode="json", exclude_unset=True)
    try:
        row = conn.execute(
            """update designs set content = %s, revision = revision + 1
               where id = %s and owner_id = %s and deleted_at is null and revision = %s
               returning revision, updated_at""",
            (Jsonb(content), design_id, user.id, body.revision),
        ).fetchone()
    except errors.CheckViolation as exc:  # over the 2 MB content cap
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "This design is too big to save.") from exc
    if row is not None:
        return row
    current = conn.execute(
        "select deleted_at from designs where id = %s and owner_id = %s", (design_id, user.id)
    ).fetchone()
    if current is None or current["deleted_at"] is not None:
        raise not_found()
    # saved from another tab since this edit started: never overwrite silently
    raise HTTPException(status.HTTP_409_CONFLICT, "This design was changed in another tab.")


@router.patch("/{design_id}")
def update_design(design_id: UUID, body: DesignPatch, user: User, conn: Conn, files: Files) -> DesignSummary:
    sets, params = [], []
    if "title" in body.model_fields_set:
        title = clean_title(body.title)
        if not title:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A title needs 1–255 characters.")
        sets.append("title = %s")
        params.append(title)
    if "folder_id" in body.model_fields_set:
        sets.append("folder_id = %s")
        params.append(body.folder_id)
    if not sets:
        return summaries([owned_design(conn, user, design_id)], files)[0]
    try:
        row = conn.execute(
            f"update designs set {', '.join(sets)} where id = %s and owner_id = %s returning {SUMMARY_COLUMNS}",
            (*params, design_id, user.id),
        ).fetchone()
    except errors.ForeignKeyViolation as exc:  # the folder is missing or not yours
        raise not_found() from exc
    if row is None:
        raise not_found()
    return summaries([row], files)[0]


@router.post("/{design_id}/trash", status_code=status.HTTP_204_NO_CONTENT)
def trash_design(design_id: UUID, user: User, conn: Conn) -> Response:
    row = conn.execute(
        """update designs set deleted_at = coalesce(deleted_at, now())
           where id = %s and owner_id = %s returning id""",
        (design_id, user.id),
    ).fetchone()
    if row is None:
        raise not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{design_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
def restore_design(design_id: UUID, user: User, conn: Conn) -> Response:
    # if its folder was deleted meanwhile, the database already moved it to the root
    row = conn.execute(
        "update designs set deleted_at = null where id = %s and owner_id = %s returning id", (design_id, user.id)
    ).fetchone()
    if row is None:
        raise not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{design_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_design(design_id: UUID, user: User, conn: Conn, files: Files) -> Response:
    row = owned_design(conn, user, design_id, "deleted_at, thumbnail_path")
    if row["deleted_at"] is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Move it to Trash first.")
    # file first, then the row: if removing the file fails, the row is still
    # there and deleting again retries both
    if row["thumbnail_path"]:
        files.remove([row["thumbnail_path"]])
    conn.execute("delete from designs where id = %s and owner_id = %s", (design_id, user.id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{design_id}/thumbnail", dependencies=[Depends(RateLimit(120, 60))])
def start_thumbnail(design_id: UUID, user: User, conn: Conn, files: Files) -> SignedUpload:
    owned_design(conn, user, design_id, "id")
    path = thumbnail_path(user.id, design_id)
    # only when it changes: every update bumps updated_at, which reorders "recent"
    conn.execute(
        """update designs set thumbnail_path = %s
           where id = %s and owner_id = %s and thumbnail_path is distinct from %s""",
        (path, design_id, user.id, path),
    )
    # until the browser's upload lands, the list just shows no thumbnail
    return files.signed_upload(path)
