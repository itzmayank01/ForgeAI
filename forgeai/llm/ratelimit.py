"""Per-model token-bucket throttle.

Groq's free tier allows 8,000 tokens per minute PER MODEL, which a naive
ThreadPool blows through in two seconds. Limits being per-model means the
generator and judge running different families - which the bias defense already
required - get independent buckets, roughly doubling usable throughput.

Pacing proactively beats retrying reactively: a 429 costs the full reset window
(up to 60s), while waiting for capacity costs only what is actually needed.
"""
from __future__ import annotations

import itertools
import threading
import time

# Completions land far below their ceiling: with reasoning_effort=low a
# structured call uses ~230 tokens against a 2,048 allowance. Reserve a
# realistic share up front and correct it against the server's own count the
# moment the response lands.
COMPLETION_FRACTION = 0.35
MIN_COMPLETION_RESERVE = 250


class TokenBucket:
    """Sliding-window limiter over the last `window` seconds.

    Reservations are keyed by an opaque handle. Correcting by position instead
    (events[-1]) silently fixes ANOTHER thread's entry under concurrency, so
    estimates never get replaced by real usage and the bucket throttles several
    times harder than the limit requires.
    """

    def __init__(self, limit: int = 8000, window: float = 60.0, headroom: float = 0.9):
        # Headroom absorbs the gap between estimate and truth: the server also
        # charges for reasoning tokens we cannot see in advance.
        self.limit = int(limit * headroom)
        self.window = window
        self._events: dict[int, tuple[float, int]] = {}
        self._ids = itertools.count()
        self._lock = threading.Lock()
        self._cv = threading.Condition(self._lock)

    def _prune(self, now: float) -> int:
        stale = [k for k, (ts, _) in self._events.items() if now - ts > self.window]
        for k in stale:
            del self._events[k]
        return sum(t for _, t in self._events.values())

    def acquire(self, estimate: int, *, timeout: float = 120.0) -> int:
        """Block until `estimate` tokens fit. Returns a handle for settle()."""
        start = time.monotonic()
        with self._cv:
            while True:
                now = time.monotonic()
                used = self._prune(now)
                if used + estimate <= self.limit or not self._events:
                    handle = next(self._ids)
                    self._events[handle] = (now, estimate)
                    return handle
                if time.monotonic() - start > timeout:
                    handle = next(self._ids)  # proceed; let a 429 handle it
                    self._events[handle] = (now, estimate)
                    return handle
                oldest = min(ts for ts, _ in self._events.values())
                self._cv.wait(timeout=max(0.05, self.window - (now - oldest) + 0.05))

    def settle(self, handle: int, actual: int) -> None:
        """Replace this reservation with the real usage."""
        with self._cv:
            entry = self._events.get(handle)
            if entry is not None:
                self._events[handle] = (entry[0], actual)
            self._cv.notify_all()

    def penalise(self, seconds: float) -> None:
        """After a 429: park the window so nothing else slips through."""
        with self._cv:
            self._events[next(self._ids)] = (
                time.monotonic() + seconds - self.window, self.limit)
            self._cv.notify_all()


_buckets: dict[str, TokenBucket] = {}
_registry_lock = threading.Lock()


def bucket_for(model: str) -> TokenBucket:
    with _registry_lock:
        if model not in _buckets:
            _buckets[model] = TokenBucket()
        return _buckets[model]


def estimate_tokens(messages: list[dict[str, str]], max_tokens: int) -> int:
    """~4 chars per token for the prompt, plus a realistic share of the
    completion allowance rather than all of it."""
    chars = sum(len(m.get("content", "")) for m in messages)
    completion = max(MIN_COMPLETION_RESERVE, int(max_tokens * COMPLETION_FRACTION))
    return chars // 4 + completion
