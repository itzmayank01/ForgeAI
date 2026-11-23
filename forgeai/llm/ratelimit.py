"""Per-model token-bucket throttle.

Groq's free tier allows 8,000 tokens per minute PER MODEL, which a naive
ThreadPool blows through in two seconds. Limits being per-model means the
generator and judge running different families - which the bias defense already
required - get independent buckets, roughly doubling usable throughput.

Pacing proactively beats retrying reactively: a 429 costs the full reset window
(up to 60s), while waiting for capacity costs only what is actually needed.
"""
from __future__ import annotations

import threading
import time
from collections import deque


class TokenBucket:
    """Sliding-window limiter. Tracks (timestamp, tokens) over the last window."""

    def __init__(self, limit: int = 8000, window: float = 60.0, headroom: float = 0.9):
        # Headroom absorbs the gap between our estimate and the true count: the
        # server charges for reasoning tokens we cannot see in advance.
        self.limit = int(limit * headroom)
        self.window = window
        self._events: deque[tuple[float, int]] = deque()
        self._lock = threading.Lock()
        self._cv = threading.Condition(self._lock)

    def _used(self, now: float) -> int:
        while self._events and now - self._events[0][0] > self.window:
            self._events.popleft()
        return sum(t for _, t in self._events)

    def acquire(self, estimate: int, *, timeout: float = 180.0) -> float:
        """Block until `estimate` tokens fit. Returns seconds waited."""
        start = time.monotonic()
        with self._cv:
            while True:
                now = time.monotonic()
                used = self._used(now)
                if used + estimate <= self.limit or not self._events:
                    self._events.append((now, estimate))
                    return round(time.monotonic() - start, 2)
                if time.monotonic() - start > timeout:
                    self._events.append((now, estimate))  # proceed; let 429 handle it
                    return round(time.monotonic() - start, 2)
                oldest = self._events[0][0]
                self._cv.wait(timeout=max(0.05, self.window - (now - oldest) + 0.05))

    def settle(self, estimate: int, actual: int) -> None:
        """Correct the reservation once the real usage is known."""
        with self._cv:
            if self._events:
                ts, _ = self._events[-1]
                self._events[-1] = (ts, actual)
            self._cv.notify_all()

    def penalise(self, seconds: float) -> None:
        """After a 429: park the whole window so nothing else slips through."""
        with self._cv:
            self._events.append((time.monotonic() + seconds - self.window, self.limit))
            self._cv.notify_all()


_buckets: dict[str, TokenBucket] = {}
_registry_lock = threading.Lock()


def bucket_for(model: str) -> TokenBucket:
    with _registry_lock:
        if model not in _buckets:
            _buckets[model] = TokenBucket()
        return _buckets[model]


def estimate_tokens(messages: list[dict[str, str]], max_tokens: int) -> int:
    """Rough but deliberately generous: ~4 chars per token for the prompt, plus
    the full completion allowance. Under-estimating causes 429s, which are far
    more expensive than waiting a moment longer."""
    chars = sum(len(m.get("content", "")) for m in messages)
    return chars // 4 + max_tokens
