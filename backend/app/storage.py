"""Supabase Storage (private bucket) and the one Supabase Auth admin call we need.

Everything goes through this class so tests can swap in an in-memory fake.
The secret key used here never leaves the server.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from uuid import UUID

from storage3.types import CreateSignedUploadUrlOptions
from supabase import Client, create_client
from supabase_auth.errors import AuthApiError

from .config import get_settings

URL_LIFETIME_S = 3600  # signed links work for 1 hour


@dataclass(frozen=True)
class FileInfo:
    size_bytes: int
    mime: str


@dataclass(frozen=True)
class SignedUpload:
    bucket: str
    path: str
    token: str


def asset_path(owner_id: UUID, asset_id: UUID) -> str:
    return f"{owner_id}/assets/{asset_id}"


def thumbnail_path(owner_id: UUID, design_id: UUID) -> str:
    return f"{owner_id}/thumbnails/{design_id}.png"


class Storage:
    def __init__(self, client: Client, bucket: str):
        self._client = client
        self.bucket = bucket

    def _files(self) -> Any:
        return self._client.storage.from_(self.bucket)

    def signed_upload(self, path: str) -> SignedUpload:
        """A one-off token the browser uses to upload this one file (replacing any old one)."""
        result = self._files().create_signed_upload_url(path, CreateSignedUploadUrlOptions(upsert="true"))
        return SignedUpload(bucket=self.bucket, path=path, token=result["token"])

    def signed_urls(self, paths: Iterable[str]) -> dict[str, str]:
        """path -> temporary download link. Missing files are left out."""
        paths = list(dict.fromkeys(paths))
        if not paths:
            return {}
        result = self._files().create_signed_urls(paths, URL_LIFETIME_S)
        return {item["path"]: item["signedURL"] for item in result if not item.get("error") and item.get("signedURL")}

    def file_info(self, path: str) -> FileInfo | None:
        files = self._files()
        if not files.exists(path):
            return None
        info = files.info(path)
        meta = info.get("metadata") or {}
        return FileInfo(
            size_bytes=int(info.get("size") or meta.get("size") or 0),
            mime=str(info.get("content_type") or meta.get("mimetype") or ""),
        )

    def remove(self, paths: Iterable[str]) -> None:
        """Delete files. Files that are already gone are not an error."""
        paths = list(paths)
        for start in range(0, len(paths), 100):
            self._files().remove(paths[start : start + 100])

    def delete_auth_user(self, user_id: UUID) -> None:
        try:
            self._client.auth.admin.delete_user(str(user_id))
        except AuthApiError as exc:
            if exc.status != 404:  # already deleted counts as done
                raise


@lru_cache
def get_storage() -> Storage:
    settings = get_settings()
    return Storage(create_client(settings.supabase_url, settings.supabase_secret_key), settings.storage_bucket)
