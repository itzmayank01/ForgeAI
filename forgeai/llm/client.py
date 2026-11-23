"""OpenAI-compatible chat client. Works against Groq, Cerebras, OpenRouter,
OpenAI - anything speaking /chat/completions. Swapping provider is one env var."""
from __future__ import annotations

import threading
from dataclasses import dataclass, field

import httpx

from ..config import Settings, settings


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

        last_exc: Exception | None = None
        for attempt in range(3):  # transient network / rate-limit retries
            try:
                r = self._client.post("/chat/completions", json=payload)
                if r.status_code == 429:
                    raise LLMError(f"rate limited: {r.text[:200]}")
                r.raise_for_status()
                data = r.json()
                u = data.get("usage", {})
                self.usage.add(u.get("prompt_tokens", 0), u.get("completion_tokens", 0))
                return data["choices"][0]["message"]["content"] or ""
            except Exception as exc:  # noqa: BLE001 - retried, then surfaced
                last_exc = exc
                if attempt == 2:
                    break
        raise LLMError(f"completion failed after 3 attempts: {last_exc}")

    def close(self) -> None:
        self._client.close()
