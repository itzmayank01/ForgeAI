"""Hybrid retrieval. `strategy`, `top_k` and `min_score` are optimizer levers:
a `retrieval_miss` diagnosis walks this config up the fix ladder."""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np

from ..models.agent_def import RetrievalConfig
from ..models.common import Chunk, RetrievedChunk
from .embedder import embed

_WORD = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> list[str]:
    return _WORD.findall(text.lower())


class ChunkIndex:
    def __init__(self, chunks: list[Chunk], vectors: np.ndarray | None = None) -> None:
        self.chunks = chunks
        self.vectors = embed([c.text for c in chunks]) if vectors is None else vectors
        self._bm25 = None

    @property
    def bm25(self):
        if self._bm25 is None:
            from rank_bm25 import BM25Okapi
            self._bm25 = BM25Okapi([_tokens(c.text) for c in self.chunks])
        return self._bm25

    def search(self, query: str, cfg: RetrievalConfig) -> list[RetrievedChunk]:
        if not self.chunks:
            return []
        dense = self.vectors @ embed([query])[0]

        if cfg.strategy == "dense":
            scores = dense
        else:
            raw = np.asarray(self.bm25.get_scores(_tokens(query)), dtype=np.float32)
            # Normalise BM25 into [0,1] so it is commensurable with cosine.
            sparse = raw / raw.max() if raw.max() > 0 else raw
            scores = sparse if cfg.strategy == "bm25" else (
                cfg.hybrid_alpha * dense + (1 - cfg.hybrid_alpha) * sparse
            )

        order = np.argsort(-scores)[: cfg.top_k]
        return [
            RetrievedChunk(
                chunk_id=self.chunks[i].chunk_id, doc_id=self.chunks[i].doc_id,
                filename=self.chunks[i].filename, text=self.chunks[i].text,
                score=round(float(scores[i]), 4),
            )
            for i in order
            if float(scores[i]) >= cfg.min_score
        ]

    def support_score(self, query: str, k: int = 3) -> tuple[float, list[str]]:
        """Mean top-k cosine - the deterministic signal behind the groundability guard."""
        if not self.chunks:
            return 0.0, []
        dense = self.vectors @ embed([query])[0]
        order = np.argsort(-dense)[:k]
        return (
            round(float(np.mean([dense[i] for i in order])), 4),
            [self.chunks[i].chunk_id for i in order],
        )

    def export_for_web(self, path: Path) -> None:
        """Ship chunks + vectors to the Next.js app so /api/chat does cosine in
        TypeScript - no Python, no torch, inside Vercel's limits."""
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({
            "dim": int(self.vectors.shape[1]) if len(self.chunks) else 0,
            "chunks": [
                {
                    "chunk_id": c.chunk_id, "doc_id": c.doc_id, "filename": c.filename,
                    "text": c.text,
                    "vector": [round(float(x), 5) for x in self.vectors[i]],
                }
                for i, c in enumerate(self.chunks)
            ],
        }))
