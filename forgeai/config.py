"""Runtime settings. Everything overridable by env so the deployed app and the
CLI behave identically."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

PLACEHOLDER = "gsk_your_key_here"


def _first_key() -> str:
    for name in ("FORGEAI_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY"):
        value = (os.getenv(name) or "").strip()
        if value and value != PLACEHOLDER:
            return value
    return ""


@dataclass
class Settings:
    # Accept the provider's own conventional names too: people usually already
    # have GROQ_API_KEY exported, and failing over a variable name is a silly
    # way to lose ten minutes. The placeholder from .env.example is treated as
    # unset, otherwise an untouched .env silently shadows a real exported key.
    api_key: str = _first_key()
    base_url: str = os.getenv("FORGEAI_BASE_URL", "https://api.groq.com/openai/v1")
    # Two different small open families: the judge must not be the generator.
    gen_model: str = os.getenv("FORGEAI_GEN_MODEL", "openai/gpt-oss-20b")
    judge_model: str = os.getenv("FORGEAI_JUDGE_MODEL", "qwen/qwen3.8-27b")
    embed_model: str = os.getenv("FORGEAI_EMBED_MODEL", "BAAI/bge-small-en-v1.5")
    max_tokens: int = int(os.getenv("FORGEAI_MAX_TOKENS", "500000"))
    max_seconds: int = int(os.getenv("FORGEAI_MAX_SECONDS", "900"))
    max_iterations: int = int(os.getenv("FORGEAI_MAX_ITERATIONS", "3"))
    request_timeout: float = float(os.getenv("FORGEAI_TIMEOUT", "60"))
    max_concurrency: int = int(os.getenv("FORGEAI_CONCURRENCY", "2"))

    def require_key(self) -> str:
        if not self.api_key:
            raise RuntimeError(
                "No API key found. Set FORGEAI_API_KEY (or GROQ_API_KEY) in "
                f"{Path('.env').resolve()}, or export it in your shell. "
                "Free keys: https://console.groq.com/keys"
            )
        return self.api_key


settings = Settings()
