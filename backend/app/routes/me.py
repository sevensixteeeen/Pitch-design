"""The signed-in user's own profile, and deleting the whole account."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel

from ..auth import User
from ..db import Conn
from ..ratelimit import RateLimit
from ..storage import Storage, get_storage

router = APIRouter(prefix="/api/me", tags=["me"])
Files = Annotated[Storage, Depends(get_storage)]


class Me(BaseModel):
    id: UUID
    email: str
    display_name: str | None


class DeleteAccount(BaseModel):
    confirm: Literal["DELETE"]  # typed by the user, so a stray request can't do this


@router.get("")
def get_me(user: User, conn: Conn) -> Me:
    row = conn.execute("select display_name from profiles where id = %s", (user.id,)).fetchone()
    return Me(id=user.id, email=user.email, display_name=row["display_name"])


@router.delete("", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(RateLimit(5, 3600))])
def delete_me(body: DeleteAccount, user: User, conn: Conn, files: Files) -> Response:
    """Deletes everything, in an order where a failure at any step can simply be retried:

    1. the user's files in Storage (rows still point at them, so a retry finds them again)
    2. the profile row; the database cascades to designs, folders, assets, versions. The id goes
       into deleted_accounts in the same step, so tokens still in use stop working
       (they stay validly signed until they expire)
    3. the Supabase login itself
    """
    paths = [
        r["path"]
        for r in conn.execute(
            """select storage_path as path from assets where owner_id = %(id)s
               union all
               select thumbnail_path from designs where owner_id = %(id)s and thumbnail_path is not null""",
            {"id": user.id},
        ).fetchall()
    ]
    files.remove(paths)
    # remembered first, in the same transaction: tokens still in use get 401 from now on
    conn.execute("insert into deleted_accounts (id) values (%s) on conflict do nothing", (user.id,))
    conn.execute("delete from profiles where id = %s", (user.id,))
    conn.commit()
    files.delete_auth_user(user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
