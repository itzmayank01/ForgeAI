"""OpenAI-compatible chat client. Works against Groq, Cerebras, OpenRouter,
OpenAI - anything speaking /chat/completions. Swapping provider is one env var."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

import httpx

from ..config import Settings, settings
from .ratelimit import bucket_for, estimate_tokens


@dataclass
class Usage:
    """Thread-safe token meter. The loop spends against Budget from this."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    calls: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    @property
    def total(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    def add(self, prompt: int, completion: int) -> None:
        with self._lock:
            self.prompt_tokens += prompt
            self.completion_tokens += completion
            self.calls += 1


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
        self._client = httpx.Client(
            base_url=self.cfg.base_url,
            timeout=self.cfg.request_timeout,
            headers={"Authorization": f"Bearer {self.cfg.require_key()}"},
        )

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
        bucket = bucket_for(model_name)
        estimate = estimate_tokens(messages, max_tokens)

        last_exc: Exception | None = None
        for attempt in range(4):
            handle = bucket.acquire(estimate)
            try:
                r = self._client.post("/chat/completions", json=payload)

                if r.status_code == 429:
                    # A DAILY cap is not worth waiting on: it drips for hours.
                    # Grinding through it is how a run burned 3.1 hours to
                    # produce nothing. Fail fast and say so instead.
                    if "per day" in r.text.lower() or "tpd" in r.text.lower():
                        raise QuotaExhausted(
                            f"daily token quota exhausted for {model_name}. "
                            f"Runs cannot proceed until it resets. "
                            f"Detail: {r.text[:200]}")
                    # Otherwise honour the server's own reset window.
                    wait = _retry_after(r) or min(60.0, 2.0 ** attempt * 5)
                    bucket.penalise(wait)
                    last_exc = LLMError(f"rate limited, waited {wait:.0f}s")
                    time.sleep(wait)
                    continue

                if r.status_code >= 400:
                    body = r.text[:400]
                    # Empty generation under json_object mode: the model thought
                    # itself out of budget. Give it more room and try again
                    # rather than failing the stage.
                    if ("json_validate_failed" in body
                            and '"failed_generation":""' in body.replace(" ", "")
                            and attempt < 3):
                        payload["max_tokens"] = min(8192, int(payload["max_tokens"] * 2))
                        last_exc = LLMError("empty generation; raised max_tokens")
                        continue
                    raise LLMError(f"{r.status_code} from {model_name}: {body}")
                r.raise_for_status()
                data = r.json()
                u = data.get("usage", {})
                total = u.get("total_tokens") or (
                    u.get("prompt_tokens", 0) + u.get("completion_tokens", 0))
                bucket.settle(handle, total or estimate)
                self.usage.add(u.get("prompt_tokens", 0), u.get("completion_tokens", 0))
                return data["choices"][0]["message"].get("content") or ""

            except LLMError:
                raise
            except Exception as exc:  # noqa: BLE001 - retried, then surfaced
                last_exc = exc
                bucket.settle(handle, estimate)
                if attempt < 3:
                    time.sleep(1.5 * (attempt + 1))

        raise LLMError(f"completion failed after 4 attempts: {last_exc}")

    def close(self) -> None:
        self._client.close()


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
