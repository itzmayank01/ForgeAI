"""Runtime settings. Everything overridable by env so the deployed app and the
CLI behave identically."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

PLACEHOLDER = "gsk_your_key_here"


# A real Groq key is `gsk_` and ~52 more base62 characters. Every placeholder
# this repository ships -- gsk_your_key_here, gsk_key_one -- is far shorter and
# carries underscores the real thing never has, so shape alone separates them.
#
# Matching one exact placeholder string was not enough. `.env.example` also
# ships `FORGEAI_API_KEYS=gsk_key_one,gsk_key_two,gsk_key_three` uncommented,
# so copying the example put three dead entries straight into the pool, and an
# untouched FORGEAI_API_KEY=gsk_your_key_here sat in this project's own .env
# for the whole build. A dead entry is not harmless: the pool rotates onto it,
# the provider returns 401, and that request fails -- measured at 8 failures in
# 20 requests once rate limiting made the loop walk the whole pool.
_KEY_SHAPE = re.compile(r"^[A-Za-z0-9-]{20,}$")


def is_plausible_key(value: str) -> bool:
    """False for an obvious placeholder, so it never enters the pool."""
    body = value[4:] if value.startswith("gsk_") else value
    return bool(_KEY_SHAPE.fullmatch(body))


def _all_keys() -> list[str]:
    """Collect every configured key, de-duplicated, order preserved.

    FORGEAI_API_KEYS takes a comma-separated list; the singular names are kept
    so an existing single-key setup keeps working untouched. Numbered variants
    (FORGEAI_API_KEY_2, GROQ_API_KEY_3, …) are picked up too, because pasting
    one per line is easier than editing a long comma list. The range runs well
    past any plausible key count: it was 2-10 and silently ignored keys numbered
    11 and above, so adding more keys made no difference and the pool quietly
    stayed small.
    """
    found: list[str] = []

    def add(raw: str | None) -> None:
        for part in (raw or "").split(","):
            v = part.strip()
            if v and is_plausible_key(v) and v not in found:
                found.append(v)

    add(os.getenv("FORGEAI_API_KEYS"))
    for name in ("FORGEAI_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY"):
        add(os.getenv(name))
        for i in range(2, 31):
            add(os.getenv(f"{name}_{i}"))
    return found


def _first_key() -> str:
    keys = _all_keys()
    return keys[0] if keys else ""


@dataclass
class Settings:
    # Accept the provider's own conventional names too: people usually already
    # have GROQ_API_KEY exported, and failing over a variable name is a silly
    # way to lose ten minutes. The placeholder from .env.example is treated as
    # unset, otherwise an untouched .env silently shadows a real exported key.
    api_key: str = _first_key()
    api_keys: list[str] = field(default_factory=_all_keys)
    base_url: str = os.getenv("FORGEAI_BASE_URL", "https://api.groq.com/openai/v1")
    # Two different small open families: the judge must not be the generator.
    gen_model: str = os.getenv("FORGEAI_GEN_MODEL", "openai/gpt-oss-20b")
    judge_model: str = os.getenv("FORGEAI_JUDGE_MODEL", "qwen/qwen3.8-27b")
    # Daily token caps are PER MODEL, so spreading stages across models
    # multiplies the usable free-tier budget instead of queueing on one bucket.
    # Eval generation is the call-heaviest stage, so it gets its own.
    evalgen_model: str = os.getenv("FORGEAI_EVALGEN_MODEL", "openai/gpt-oss-120b")
    # The agent must stay on ONE model for a run's results to mean anything,
    # and it must differ from the judge for the self-preference defense.
    agent_model: str = os.getenv("FORGEAI_AGENT_MODEL", "openai/gpt-oss-20b")
    embed_model: str = os.getenv("FORGEAI_EMBED_MODEL", "BAAI/bge-small-en-v1.5")
    max_tokens: int = int(os.getenv("FORGEAI_MAX_TOKENS", "500000"))
    max_seconds: int = int(os.getenv("FORGEAI_MAX_SECONDS", "2400"))
    max_iterations: int = int(os.getenv("FORGEAI_MAX_ITERATIONS", "3"))
    request_timeout: float = float(os.getenv("FORGEAI_TIMEOUT", "60"))
    max_concurrency: int = int(os.getenv("FORGEAI_CONCURRENCY", "3"))

    def require_key(self) -> str:
        if not self.api_key:
            raise RuntimeError(
                "No API key found. Set FORGEAI_API_KEY (or GROQ_API_KEY) in "
                f"{Path('.env').resolve()}, or export it in your shell. "
                "Free keys: https://console.groq.com/keys"
            )
        return self.api_key


settings = Settings()
