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

    def support_score(self, query: str, k: int = 3) -> tuple[float, float, list[str]]:
        """Return (max_sim, topk_mean, chunk_ids) - the signal behind the
        groundability guard.

        `max_sim` asks "does ANY chunk cover this?". A top-k mean averages in
        unrelated chunks, which on a small corpus inflates absent-but-adjacent
        topics: an HR corpus with no equity policy still scores "stock options"
        highly on a mean, because every chunk is vaguely HR-shaped.
        """
        if not self.chunks:
            return 0.0, 0.0, []
        dense = self.vectors @ embed([query])[0]
        order = np.argsort(-dense)[: min(k, len(self.chunks))]
        return (
            round(float(dense.max()), 4),
            round(float(np.mean([dense[i] for i in order])), 4),
            [self.chunks[i].chunk_id for i in order],
        )

    def topic_support(self, name: str, description: str, k: int = 3):
        """Phrasing-robust support for a requirements topic.

        A single probe string is fragile: the same real topic scored 0.758 when
        described as "Minimum order value and volume discounts" and 0.674 as
        "MOQ and discounts", which straddles any fixed threshold. Probing
        several natural phrasings and taking the best asks whether the corpus
        covers the CONCEPT, not whether one wording happens to embed well.
        """
        probes = [
            name,
            description,
            f"{name}. {description}",
            f"What is the policy on {name}?",
        ]
        best_score, best_mean, best_ids = 0.0, 0.0, []
        for probe in probes:
            if not probe.strip():
                continue
            score, mean, ids = self.support_score(probe, k)
            if score > best_score:
                best_score, best_mean, best_ids = score, mean, ids
        return best_score, best_mean, best_ids

    def export_for_web(self, path: Path) -> None:
        """Ship chunks + vectors to the Next.js app so /api/chat does cosine in
        TypeScript - no Python, no torch, inside Vercel's limits."""
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({
            "dim": int(self.vectors.shape[1]) if len(self.chunks) else 0,
            "chunks": [
                {
                    "chunk_id": c.chunk_id, "doc_id": c.doc_id, "filename": c.filename,
                    "text": c.text, "ordinal": c.ordinal,
                    "vector": [round(float(x), 5) for x in self.vectors[i]],
                }
                for i, c in enumerate(self.chunks)
            ],
        }))
