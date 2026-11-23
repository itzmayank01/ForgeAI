"""Paragraph-aware chunking. chunk_size/overlap are optimizer levers, so this
takes them as arguments and is re-runnable mid-loop."""
from __future__ import annotations

from ..models.common import Chunk, DocumentRef


def chunk_document(ref: DocumentRef, text: str, size: int, overlap: int) -> list[Chunk]:
    paras = [p.strip() for p in text.split("\n") if p.strip()]
    chunks: list[Chunk] = []
    buf: list[str] = []
    buf_len = 0

    def flush() -> None:
        nonlocal buf, buf_len
        if not buf:
            return
        body = "\n".join(buf)
        chunks.append(Chunk(
            chunk_id=f"{ref.doc_id}_c{len(chunks):03d}", doc_id=ref.doc_id,
            filename=ref.filename, text=body, ordinal=len(chunks),
        ))
        if overlap > 0:  # carry a tail forward so facts spanning a seam survive
            tail, kept = [], 0
            for p in reversed(buf):
                if kept >= overlap:
                    break
                tail.insert(0, p)
                kept += len(p)
            buf, buf_len = tail, kept
        else:
            buf, buf_len = [], 0

    for para in paras:
        if buf_len + len(para) > size and buf:
            flush()
        buf.append(para)
        buf_len += len(para)
    flush()
    return chunks


def chunk_corpus(refs: list[DocumentRef], texts: dict[str, str],
                 size: int, overlap: int) -> list[Chunk]:
    out: list[Chunk] = []
    for ref in refs:
        out.extend(chunk_document(ref, texts[ref.doc_id], size, overlap))
    return out
