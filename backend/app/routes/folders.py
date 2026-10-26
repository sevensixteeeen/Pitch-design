"""Folders: one level deep. Deleting one moves its designs back to the root."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from ..auth import User
from ..db import Conn

router = APIRouter(prefix="/api/folders", tags=["folders"])

# design_count leaves out designs in Trash
FOLDER_SELECT = """select f.id, f.name, f.created_at, f.updated_at,
    (select count(*) from designs d
      where d.folder_id = f.id and d.owner_id = f.owner_id and d.deleted_at is null) as design_count
    from folders f"""


class Folder(BaseModel):
    id: UUID
    name: str
    design_count: int
    created_at: datetime
    updated_at: datetime


class FolderName(BaseModel):
    name: str


def clean_name(name: str) -> str:
    name = name.strip()
    if not 1 <= len(name) <= 100:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A folder name needs 1–100 characters.")
    return name


def folder(conn: Conn, user: User, folder_id: UUID) -> Folder:
    row = conn.execute(f"{FOLDER_SELECT} where f.id = %s and f.owner_id = %s", (folder_id, user.id)).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
    return row


@router.get("")
def list_folders(user: User, conn: Conn) -> list[Folder]:
    return conn.execute(f"{FOLDER_SELECT} where f.owner_id = %s order by lower(f.name), f.id", (user.id,)).fetchall()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_folder(body: FolderName, user: User, conn: Conn) -> Folder:
    row = conn.execute(
        "insert into folders (owner_id, name) values (%s, %s) returning id", (user.id, clean_name(body.name))
    ).fetchone()
    return folder(conn, user, row["id"])


@router.patch("/{folder_id}")
def rename_folder(folder_id: UUID, body: FolderName, user: User, conn: Conn) -> Folder:
    conn.execute(
        "update folders set name = %s where id = %s and owner_id = %s", (clean_name(body.name), folder_id, user.id)
    )
    return folder(conn, user, folder_id)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: UUID, user: User, conn: Conn) -> Response:
    row = conn.execute(
        "delete from folders where id = %s and owner_id = %s returning id", (folder_id, user.id)
    ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
