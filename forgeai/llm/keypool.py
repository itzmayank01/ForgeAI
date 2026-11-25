"""Rotation across several API keys.

Daily caps are per ORGANIZATION and per model, not per key. Several keys minted
from the same Groq account share one 200k/day pot, so N keys multiply the budget
by the number of distinct organizations behind them - which was 3 for the 8 keys
this was built against, not 8. That correction came from reading a 429 body:
`Rate limit reached for model X in organization org_abc ... (TPD): Limit 200000,
Used 199496`. Four keys reported byte-identical usage, which is only possible if
they are drawing on the same budget.

The pool hands out the least-loaded key that is not already exhausted for the
model in question, and failover is per (key, model) rather than per key -
burning gpt-oss-20b on one key says nothing about qwen on the same key. When a
429 names an organization, every key known to belong to it is sidelined for that
model together: trying its siblings cannot succeed, and each attempt spent on
one is an attempt not spent on a key that might have budget.

Organizations are learned lazily, because the API reveals one only in a 429. A
key whose organization is still unknown is sidelined alone.

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
    org: str | None = None
    """Owning organization, learned from a 429 body. Keys that share one share
    a daily budget, so they must be sidelined together."""

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

    SHORT_WAIT = 240.0
    """How long to wait for a key before giving up.

    This has to exceed the cooldowns the client sets, or the pool gives up just
    before recovery. It was 90s while a daily-cap 429 benched keys for up to
    120s, so a run would stall, abandon the pass, and the retry loop would hit
    the same wall - progress crawled while every key was moments from being
    usable again."""

    def acquire(self, model: str, *, allow_wait: bool = True,
                reserve: int = 0) -> KeyState:
        """Least-used available key for this model, waiting out a brief stall.

        The reservation matters under concurrency. Choosing purely on recorded
        usage meant three threads calling acquire before any of them had
        recorded anything all received the SAME key, piling onto one key's
        per-minute limit while seven sat idle - every request then 429'd and
        retried, so six answers took sixty seconds where one took one.
        Reserving on the way out makes the next caller see this one.
        """
        deadline = time.time() + self.SHORT_WAIT
        while True:
            now = time.time()
            with self._lock:
                live = [s for s in self._states if s.available_for(model, now)]
                if live:
                    chosen = min(live, key=lambda s: s.tokens_for(model))
                    if reserve:
                        chosen.used[model] = chosen.tokens_for(model) + reserve
                    return chosen
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

    def record(self, state: KeyState, model: str, tokens: int,
               reserved: int = 0) -> None:
        """Replace the reservation with what the call actually cost."""
        with self._lock:
            current = state.used.get(model, 0)
            state.used[model] = max(0, current - reserved) + tokens

    def mark_exhausted(self, state: KeyState, model: str, seconds: float = 3600,
                       org: str | None = None) -> int:
        """Sideline this (key, model), and its organization's siblings with it.

        Returns how many keys were sidelined. When `org` is given the key's
        organization is recorded, so a later exhaustion of any sibling can
        sideline the whole group - the mapping fills in as 429s arrive.
        """
        until = time.time() + seconds
        with self._lock:
            if org:
                state.org = org
            state.exhausted_until[model] = until
            affected = [state]
            if state.org:
                for other in self._states:
                    if other is not state and other.org == state.org:
                        # Same daily pot: it is already empty for this model.
                        other.exhausted_until[model] = until
                        affected.append(other)
            return len(affected)

    def summary(self) -> list[dict]:
        now = time.time()
        with self._lock:
            return [
                {
                    "label": s.label,
                    "org": s.org or "unknown",
                    "tokens": dict(s.used),
                    "exhausted": [m for m, t in s.exhausted_until.items() if now < t],
                }
                for s in self._states
            ]
