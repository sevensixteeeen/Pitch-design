"""A small in-memory rate limit per signed-in user.

Good enough for one server process (Render's free plan runs one). With more
processes each would count on its own; then this would move to Postgres.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, status

from .auth import User

_limits: list["RateLimit"] = []


class RateLimit:
    def __init__(self, max_calls: int, per_seconds: float):
        self.max_calls = max_calls
        self.per_seconds = per_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()
        _limits.append(self)

    def __call__(self, user: User) -> None:
        """Use as a route dependency: Depends(RateLimit(...))."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[str(user.id)]
            while hits and now - hits[0] > self.per_seconds:
                hits.popleft()
            if len(hits) >= self.max_calls:
                wait = int(self.per_seconds - (now - hits[0])) + 1
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "Too many requests. Wait a moment and try again.",
                    headers={"Retry-After": str(wait)},
                )
            hits.append(now)


def reset_all() -> None:
    """For tests."""
    for limit in _limits:
        with limit._lock:
            limit._hits.clear()
