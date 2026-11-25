"""OpenAI-compatible chat client. Works against Groq, Cerebras, OpenRouter,
OpenAI - anything speaking /chat/completions. Swapping provider is one env var."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

import httpx

from ..config import Settings, settings
from .keypool import KeyPool, NoKeyAvailable
from .ratelimit import bucket_for, estimate_tokens


@dataclass
class Usage:
    """Thread-safe token meter. The loop spends against Budget from this."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    calls: int = 0
    by_model: dict[str, int] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    @property
    def total(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    def add(self, prompt: int, completion: int, model: str = "") -> None:
        with self._lock:
            self.prompt_tokens += prompt
            self.completion_tokens += completion
            self.calls += 1
            if model:
                self.by_model[model] = self.by_model.get(model, 0) + prompt + completion


class LLMError(RuntimeError):
    pass


class QuotaExhausted(LLMError):
    """Daily cap hit. Distinct from LLMError because callers must NOT fall back
    and carry on: every later stage would fail the same way, producing a run
    full of empty artifacts that looks like a factory defect rather than a
    billing limit."""


class LLMClient:
    def __init__(self, cfg: Settings | None = None) -> None:
        self.cfg = cfg or settings
        self.usage = Usage()
        keys = self.cfg.api_keys or ([self.cfg.require_key()] if self.cfg.api_key else [])
        if not keys:
            self.cfg.require_key()  # raises with the setup message
        self.pool = KeyPool(keys)
        self._clients: dict[str, httpx.Client] = {}

    def _http(self, key: str) -> httpx.Client:
        if key not in self._clients:
            self._clients[key] = httpx.Client(
                base_url=self.cfg.base_url,
                timeout=self.cfg.request_timeout,
                headers={"Authorization": f"Bearer {key}"},
            )
        return self._clients[key]

    def complete(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.1,
        json_mode: bool = False,
        max_tokens: int = 2048,
    ) -> str:
        payload: dict = {
            "model": model or self.cfg.gen_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        if "gpt-oss" in (model or self.cfg.gen_model):
            # gpt-oss spends tokens thinking before emitting content. Left
            # unbounded it can consume the whole allowance and return an EMPTY
            # completion, which json_object mode then rejects outright with
            # json_validate_failed. Low effort is ample for schema filling and
            # cuts tokens per call, which the 8k/min budget also rewards.
            payload["reasoning_effort"] = "low"

        model_name = payload["model"]
        estimate = estimate_tokens(messages, max_tokens)
        last_exc: Exception | None = None

        # One attempt per key, plus a couple of transient retries. Each key has
        # its own daily cap, so exhausting one is a reason to switch rather than
        # to fail.
        for attempt in range(self.pool.size + 3):
            try:
                state = self.pool.acquire(model_name, reserve=estimate)
            except NoKeyAvailable as exc:
                raise QuotaExhausted(str(exc)) from exc

            # Rate limits are per key AND per model, so the bucket must be too.
            bucket = bucket_for(f"{state.label}|{model_name}")
            handle = bucket.acquire(estimate)

            try:
                r = self._http(state.key).post("/chat/completions", json=payload)

                if r.status_code == 429:
                    body = r.text
                    if "per day" in body.lower() or "tpd" in body.lower():
                        # Sideline this (key, model) for exactly as long as the
                        # server asks. A fixed hour benches keys that Groq says
                        # are usable again in seconds - its daily window drips
                        # rather than resetting at midnight, and retry-after on
                        # these 429s is routinely single digits.
                        cooldown = _retry_after(r) or 120.0
                        self.pool.mark_exhausted(state, model_name, cooldown)
                        bucket.settle(handle, 0)
                        last_exc = LLMError(f"{state.label} daily cap reached")
                        continue
                    wait = _retry_after(r) or min(30.0, 2.0 ** attempt * 4)
                    bucket.penalise(wait)
                    bucket.settle(handle, estimate)
                    last_exc = LLMError(f"rate limited, waited {wait:.0f}s")
                    time.sleep(wait)
                    continue

                if r.status_code >= 500:
                    # Provider-side and transient: "over capacity" literally
                    # asks callers to back off exponentially. Raising here
                    # would let a momentary server wobble end an unattended
                    # run in front of a reviewer.
                    if attempt < self.pool.size + 2:
                        wait = min(20.0, 1.5 * (2 ** attempt))
                        bucket.settle(handle, 0)
                        last_exc = LLMError(f"{r.status_code} upstream; retrying in {wait:.0f}s")
                        time.sleep(wait)
                        continue
                    bucket.settle(handle, 0)
                    raise LLMError(f"{r.status_code} from {model_name}: {r.text[:200]}")

                if r.status_code >= 400:
                    body = r.text[:400]
                    if ("json_validate_failed" in body
                            and '"failed_generation":""' in body.replace(" ", "")
                            and attempt < self.pool.size + 2):
                        payload["max_tokens"] = min(8192, int(payload["max_tokens"] * 2))
                        bucket.settle(handle, estimate)
                        last_exc = LLMError("empty generation; raised max_tokens")
                        continue
                    bucket.settle(handle, estimate)
                    raise LLMError(f"{r.status_code} from {model_name}: {body}")

                data = r.json()
                u = data.get("usage", {})
                total = u.get("total_tokens") or (
                    u.get("prompt_tokens", 0) + u.get("completion_tokens", 0))
                bucket.settle(handle, total or estimate)
                self.pool.record(state, model_name, total or estimate,
                                 reserved=estimate)
                self.usage.add(u.get("prompt_tokens", 0), u.get("completion_tokens", 0),
                               model_name)
                return data["choices"][0]["message"].get("content") or ""

            except (LLMError, QuotaExhausted):
                raise
            except Exception as exc:  # noqa: BLE001 - retried, then surfaced
                last_exc = exc
                bucket.settle(handle, estimate)
                if attempt < self.pool.size + 2:
                    time.sleep(1.5 * (attempt + 1))

        raise LLMError(f"completion failed across {self.pool.size} key(s): {last_exc}")

    def close(self) -> None:
        for c in self._clients.values():
            c.close()


def _retry_after(response: httpx.Response) -> float | None:
    """Groq reports both a Retry-After and a token-bucket reset; take the larger."""
    candidates: list[float] = []
    for header in ("retry-after", "x-ratelimit-reset-tokens"):
        raw = response.headers.get(header)
        if not raw:
            continue
        try:
            if raw.endswith("ms"):
                candidates.append(float(raw[:-2]) / 1000)
            elif raw.endswith("s"):
                candidates.append(float(raw[:-1]))
            else:
                candidates.append(float(raw))
        except ValueError:
            continue
    return max(candidates) + 1.0 if candidates else None
