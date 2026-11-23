"""Corpus primitives shared by every stage."""
from __future__ import annotations

import hashlib
from typing import Literal

from pydantic import BaseModel, Field

DocKind = Literal["pdf", "csv", "md", "txt"]


class DocumentRef(BaseModel):
    """A source document, hashed so runs are reproducible and auditable."""

    doc_id: str
    filename: str
    kind: DocKind
    n_chars: int
    sha256: str

    @staticmethod
    def hash_text(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


class Chunk(BaseModel):
    """A retrievable unit. `chunk_id` is what the agent cites and the judge verifies."""

    chunk_id: str
    doc_id: str
    filename: str
    text: str
    ordinal: int


class RetrievedChunk(BaseModel):
    chunk_id: str
    doc_id: str
    filename: str
    text: str
    score: float


class CorpusSummary(BaseModel):
    """What the intake stage is allowed to see about the folder, without reading it all."""

    documents: list[DocumentRef]
    n_chunks: int
    total_chars: int
    kinds: dict[str, int] = Field(default_factory=dict)
    sample_excerpts: list[str] = Field(default_factory=list)

    @property
    def corpus_hash(self) -> str:
        joined = "|".join(sorted(d.sha256 for d in self.documents))
        return hashlib.sha256(joined.encode()).hexdigest()[:16]
