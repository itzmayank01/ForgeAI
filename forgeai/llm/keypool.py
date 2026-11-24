"""Rotation across several API keys.

Daily caps are per key AND per model, so N keys multiply the free-tier budget
by N. The pool hands out the least-loaded key that is not already exhausted for
the model in question, and failover is per (key, model) rather than per key -
burning gpt-oss-20b on one key says nothing about qwen on the same key.

Only when EVERY key is exhausted for a model does the caller see QuotaExhausted.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field


@dataclass
class KeyState:
    key: str
    label: str
    used: dict[str, int] = field(default_factory=dict)       # model -> tokens
    exhausted_until: dict[str, float] = field(default_factory=dict)

    def available_for(self, model: str, now: float) -> bool:
        until = self.exhausted_until.get(model)
        return until is None or now >= until

    def tokens_for(self, model: str) -> int:
        return self.used.get(model, 0)


class NoKeyAvailable(RuntimeError):
    """Every key is exhausted for this model."""


class KeyPool:
    def __init__(self, keys: list[str]) -> None:
        if not keys:
            raise RuntimeError("KeyPool needs at least one key")
        self._states = [
            # Label by position and last four characters: enough to tell keys
            # apart in logs without ever printing one.
            KeyState(key=k, label=f"key{i + 1}:…{k[-4:]}")
            for i, k in enumerate(keys)
        ]
        self._lock = threading.Lock()

    @property
    def size(self) -> int:
        return len(self._states)

    SHORT_WAIT = 90.0
    """Below this, waiting for a key beats failing the run: Groq's daily window
    drips, so a stall is usually seconds rather than hours."""

    def acquire(self, model: str, *, allow_wait: bool = True) -> KeyState:
        """Least-used available key for this model, waiting out a brief stall."""
        deadline = time.time() + self.SHORT_WAIT
        while True:
            now = time.time()
            with self._lock:
                live = [s for s in self._states if s.available_for(model, now)]
                if live:
                    return min(live, key=lambda s: s.tokens_for(model))
                soonest = min(
                    (s.exhausted_until.get(model, 0) for s in self._states), default=0)

            wait = soonest - now
            if not allow_wait or wait <= 0 or now >= deadline:
                mins = max(0, int(wait) // 60)
                raise NoKeyAvailable(
                    f"all {len(self._states)} key(s) exhausted for {model}; "
                    f"next resets in ~{mins}m" if mins
                    else f"all {len(self._states)} key(s) exhausted for {model}")
            time.sleep(min(5.0, max(0.5, wait)))

    def record(self, state: KeyState, model: str, tokens: int) -> None:
        with self._lock:
            state.used[model] = state.used.get(model, 0) + tokens

    def mark_exhausted(self, state: KeyState, model: str, seconds: float = 3600) -> None:
        with self._lock:
            state.exhausted_until[model] = time.time() + seconds

    def summary(self) -> list[dict]:
        now = time.time()
        with self._lock:
            return [
                {
                    "label": s.label,
                    "tokens": dict(s.used),
                    "exhausted": [m for m, t in s.exhausted_until.items() if now < t],
                }
                for s in self._states
            ]
