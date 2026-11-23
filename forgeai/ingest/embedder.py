"""Local sentence-transformer embeddings. Lazy-loaded so importing the package
(e.g. in tests or the CLI help) never pays the model-load cost."""
from __future__ import annotations

import numpy as np

from ..config import settings

_model = None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(settings.embed_model)
    return _model


def embed(texts: list[str], batch_size: int = 32) -> np.ndarray:
    """L2-normalised float32 matrix, so cosine similarity is a plain dot product
    - in numpy here, and in TypeScript on Vercel against the same committed vectors."""
    if not texts:
        return np.zeros((0, 384), dtype=np.float32)
    vecs = get_model().encode(
        texts, batch_size=batch_size, convert_to_numpy=True,
        normalize_embeddings=True, show_progress_bar=False,
    )
    return vecs.astype(np.float32)
