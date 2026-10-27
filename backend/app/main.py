"""The FastAPI app: /api/* routes, and in production the built React files too.

Run locally (from backend/):
    uv run --env-file ../.env.local uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from psycopg import errors

from .config import get_settings
from .db import close_pool, open_pool
from .routes import assets, designs, folders, me

MAX_BODY_BYTES = 3 * 1024 * 1024  # a design's content is capped at 2 MB
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    open_pool(get_settings().database_url)
    yield
    close_pool()


app = FastAPI(title="Pitch API", version="0.1.0", lifespan=lifespan)
for module in (me, designs, folders, assets):
    app.include_router(module.router)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "That request is too large."}, status.HTTP_413_CONTENT_TOO_LARGE)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, exc: RequestValidationError):
    # where and why only: FastAPI's default echoes the input back, which leaks it
    # into logs and crashes on values JSON can't hold (NaN)
    problems = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
    return JSONResponse(
        {"detail": "Some of that input isn't allowed.", "errors": problems},
        status.HTTP_422_UNPROCESSABLE_CONTENT,
    )


@app.exception_handler(errors.CheckViolation)
async def check_violation(_request: Request, _exc: errors.CheckViolation):
    # a database rule refused the value (see schema.sql); the details stay in the server
    return JSONResponse({"detail": "That value isn't allowed."}, status.HTTP_422_UNPROCESSABLE_CONTENT)


if FRONTEND_DIST.is_dir():

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
        file = (FRONTEND_DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(FRONTEND_DIST):
            return FileResponse(file)
        # any other path is a page of the React app (e.g. /design/123/edit)
        return FileResponse(FRONTEND_DIST / "index.html")
