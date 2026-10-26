"""Uploaded images. The browser uploads straight to Storage in three steps:

1. POST /api/assets           checks type, size and quota, saves a 'pending' row,
                              returns a one-off upload token
2. (browser -> Supabase Storage, using that token)
3. POST /api/assets/{id}/complete
                              checks the file really arrived with the size and
                              type promised in step 1, then marks the row 'ready'
"""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from ..auth import User
from ..db import Conn
from ..ratelimit import RateLimit
from ..storage import SignedUpload, Storage, asset_path, get_storage

router = APIRouter(prefix="/api/assets", tags=["assets"])
Files = Annotated[Storage, Depends(get_storage)]

UPLOAD_TYPES = ("image/png", "image/jpeg", "image/webp")  # no SVG: it can carry scripts
UPLOAD_MAX_BYTES = 25 * 1024 * 1024
USER_QUOTA_BYTES = 200 * 1024 * 1024
SIDE_MAX = 8000
LIST_LIMIT = 500
ASSET_COLUMNS = "id, storage_path, original_name, mime, size_bytes, width_px, height_px, status, deleted_at, created_at"


class Asset(BaseModel):
    id: UUID
    original_name: str | None
    mime: str
    size_bytes: int
    width_px: int
    height_px: int
    url: str | None  # signed link, valid for 1 hour
    deleted_at: datetime | None
    created_at: datetime


class StartUpload(BaseModel):
    id: UUID | None = None  # picked by the browser, so a retried start is harmless
    original_name: str | None = None
    mime: str
    size_bytes: int


class UploadStarted(BaseModel):
    id: UUID
    upload: SignedUpload | None  # null = already uploaded, just call complete


class CompleteUpload(BaseModel):
    # measured by the browser; only used for layout
    width_px: Annotated[int, Field(ge=1)]
    height_px: Annotated[int, Field(ge=1)]


def unprocessable(message: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message)


def not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")


def with_urls(rows: list[dict[str, Any]], files: Storage) -> list[dict[str, Any]]:
    urls = files.signed_urls(r["storage_path"] for r in rows)
    for r in rows:
        r["url"] = urls.get(r.pop("storage_path"))
    return rows


def owned_asset(conn: Conn, user: User, asset_id: UUID) -> dict[str, Any]:
    row = conn.execute(
        f"select {ASSET_COLUMNS} from assets where id = %s and owner_id = %s", (asset_id, user.id)
    ).fetchone()
    if row is None:
        raise not_found()
    return row


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimit(60, 60))])
def start_upload(body: StartUpload, user: User, conn: Conn, files: Files) -> UploadStarted:
    if body.mime not in UPLOAD_TYPES:
        raise unprocessable("Use a PNG, JPG or WebP image.")
    if not 1 <= body.size_bytes <= UPLOAD_MAX_BYTES:
        raise unprocessable("That image is over 25 MB.")
    asset_id = body.id or uuid4()
    # one upload start at a time per user, so two at once can't both squeeze under the quota
    conn.execute("select id from profiles where id = %s for update", (user.id,))
    existing = conn.execute("select owner_id, status from assets where id = %s", (asset_id,)).fetchone()
    if existing is not None:
        if existing["owner_id"] != user.id:
            raise HTTPException(status.HTTP_409_CONFLICT, "That upload id is already taken.")
        if existing["status"] == "ready":
            return {"id": asset_id, "upload": None}
    else:
        used = conn.execute(
            "select coalesce(sum(size_bytes), 0) as used from assets where owner_id = %s", (user.id,)
        ).fetchone()["used"]
        if used + body.size_bytes > USER_QUOTA_BYTES:
            raise unprocessable("You've used your 200 MB of uploads.")
        name = (body.original_name or "").strip()[:255] or None
        conn.execute(
            """insert into assets (id, owner_id, storage_path, mime, size_bytes, original_name)
               values (%s, %s, %s, %s, %s, %s)""",
            (asset_id, user.id, asset_path(user.id, asset_id), body.mime, body.size_bytes, name),
        )
    return {"id": asset_id, "upload": files.signed_upload(asset_path(user.id, asset_id))}


@router.post("/{asset_id}/complete")
def complete_upload(asset_id: UUID, body: CompleteUpload, user: User, conn: Conn, files: Files) -> Asset:
    if body.width_px > SIDE_MAX or body.height_px > SIDE_MAX:
        raise unprocessable("That image is over 8000 px on one side.")
    row = owned_asset(conn, user, asset_id)
    if row["status"] == "pending":
        info = files.file_info(row["storage_path"])
        if info is None:
            raise unprocessable("The upload didn't arrive. Try again.")
        if info.size_bytes != row["size_bytes"] or info.mime != row["mime"]:
            # not the file that step 1 checked (and counted against the quota): throw it away
            files.remove([row["storage_path"]])
            conn.execute("delete from assets where id = %s and owner_id = %s", (asset_id, user.id))
            # commit the clean-up even though this request fails
            conn.commit()
            raise unprocessable("The uploaded file didn't match. Try again.")
        row = conn.execute(
            f"""update assets set status = 'ready', width_px = %s, height_px = %s
                where id = %s and owner_id = %s returning {ASSET_COLUMNS}""",
            (body.width_px, body.height_px, asset_id, user.id),
        ).fetchone()
    return with_urls([row], files)[0]


@router.get("")
def list_assets(user: User, conn: Conn, files: Files, in_trash: bool = False) -> list[Asset]:
    rows = conn.execute(
        f"""select {ASSET_COLUMNS} from assets
            where owner_id = %s and status = 'ready' and (deleted_at is not null) = %s
            order by created_at desc, id
            limit {LIST_LIMIT}""",
        (user.id, in_trash),
    ).fetchall()
    return with_urls(rows, files)


@router.post("/{asset_id}/trash", status_code=status.HTTP_204_NO_CONTENT)
def trash_asset(asset_id: UUID, user: User, conn: Conn) -> Response:
    row = conn.execute(
        """update assets set deleted_at = coalesce(deleted_at, now())
           where id = %s and owner_id = %s returning id""",
        (asset_id, user.id),
    ).fetchone()
    if row is None:
        raise not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{asset_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
def restore_asset(asset_id: UUID, user: User, conn: Conn) -> Response:
    row = conn.execute(
        "update assets set deleted_at = null where id = %s and owner_id = %s returning id", (asset_id, user.id)
    ).fetchone()
    if row is None:
        raise not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: UUID, user: User, conn: Conn, files: Files) -> Response:
    row = owned_asset(conn, user, asset_id)
    # file first, then the row: a failure leaves the row, and deleting again retries both
    files.remove([row["storage_path"]])
    conn.execute("delete from assets where id = %s and owner_id = %s", (asset_id, user.id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
