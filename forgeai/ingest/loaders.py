"""Document loaders. Must never crash a run: an unseen folder at the review may
hold anything, so every failure degrades to a skipped file with a logged reason."""
from __future__ import annotations

from pathlib import Path

import pandas as pd
from pypdf import PdfReader

from ..models.common import DocumentRef

SUPPORTED = {".pdf": "pdf", ".csv": "csv", ".md": "md", ".txt": "txt"}


def _read_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    return "\n\n".join((p.extract_text() or "") for p in reader.pages)


def _read_csv(path: Path) -> str:
    """CSVs become line-per-row prose so they chunk and embed like any other doc."""
    df = pd.read_csv(path)
    header = f"Table {path.name} with columns: {', '.join(map(str, df.columns))}."
    rows = [
        "; ".join(f"{c}: {r[c]}" for c in df.columns if pd.notna(r[c]))
        for _, r in df.iterrows()
    ]
    return header + "\n" + "\n".join(rows)


def load_folder(folder: Path) -> tuple[list[DocumentRef], dict[str, str], list[str]]:
    """Return (refs, doc_id -> text, skipped descriptions)."""
    refs: list[DocumentRef] = []
    texts: dict[str, str] = {}
    skipped: list[str] = []

    for path in sorted(folder.rglob("*")):
        if not path.is_file() or path.name.startswith("."):
            continue
        kind = SUPPORTED.get(path.suffix.lower())
        if kind is None:
            skipped.append(f"{path.name}: unsupported extension")
            continue
        try:
            if kind == "pdf":
                text = _read_pdf(path)
            elif kind == "csv":
                text = _read_csv(path)
            else:
                text = path.read_text(encoding="utf-8", errors="replace")
        except Exception as exc:  # noqa: BLE001 - a bad file must not kill the run
            skipped.append(f"{path.name}: {type(exc).__name__}: {exc}")
            continue

        text = text.strip()
        if len(text) < 50:
            skipped.append(f"{path.name}: extracted under 50 chars (scanned image?)")
            continue

        doc_id = f"doc_{len(refs):02d}"
        refs.append(DocumentRef(
            doc_id=doc_id, filename=path.name, kind=kind,
            n_chars=len(text), sha256=DocumentRef.hash_text(text),
        ))
        texts[doc_id] = text
    return refs, texts, skipped
