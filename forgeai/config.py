"""Runtime settings. Everything overridable by env so the deployed app and the
CLI behave identically."""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    api_key: str = os.getenv("FORGEAI_API_KEY", "")
    base_url: str = os.getenv("FORGEAI_BASE_URL", "https://api.groq.com/openai/v1")
    # Two different small open families: the judge must not be the generator.
    gen_model: str = os.getenv("FORGEAI_GEN_MODEL", "llama-3.1-8b-instant")
    judge_model: str = os.getenv("FORGEAI_JUDGE_MODEL", "gemma2-9b-it")
    embed_model: str = os.getenv("FORGEAI_EMBED_MODEL", "BAAI/bge-small-en-v1.5")
    max_tokens: int = int(os.getenv("FORGEAI_MAX_TOKENS", "500000"))
    max_seconds: int = int(os.getenv("FORGEAI_MAX_SECONDS", "900"))
    max_iterations: int = int(os.getenv("FORGEAI_MAX_ITERATIONS", "3"))
    request_timeout: float = float(os.getenv("FORGEAI_TIMEOUT", "60"))
    max_concurrency: int = int(os.getenv("FORGEAI_CONCURRENCY", "8"))

    def require_key(self) -> str:
        if not self.api_key:
            raise RuntimeError(
                "FORGEAI_API_KEY is not set. Copy .env.example to .env and add a key "
                "from https://console.groq.com (free)."
            )
        return self.api_key


settings = Settings()
