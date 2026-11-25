"""CLI chat runner. `forgeai chat --definition <any .json>`"""
from __future__ import annotations

import json
from pathlib import Path

from rich.console import Console
from rich.panel import Panel

from ..ingest.index import ChunkIndex
from ..llm.client import LLMClient
from ..models.common import Chunk
from .agent import Agent


def load_index(chunks_path: Path) -> ChunkIndex:
    """Rebuild an index from a committed web export.

    Only the fields Chunk needs are taken: the export also carries the
    embedding vector, and an export written before `ordinal` was included must
    still open rather than making an older run unloadable.
    """
    data = json.loads(chunks_path.read_text())
    chunks = [
        Chunk(
            chunk_id=c["chunk_id"], doc_id=c["doc_id"], filename=c["filename"],
            text=c["text"], ordinal=c.get("ordinal", i),
        )
        for i, c in enumerate(data["chunks"])
    ]
    return ChunkIndex(chunks)


def chat(definition_path: Path, chunks_path: Path,
         docs_dir: Path | None = None) -> None:
    console = Console()
    agent = Agent.from_file(definition_path, load_index(chunks_path),
                            LLMClient(), docs_dir=docs_dir)
    d = agent.definition

    console.print(Panel(
        f"[bold]{d.name}[/bold]\n{d.description}\n\n"
        f"tools: {', '.join(d.tool_names) or 'none'}  |  "
        f"retrieval: {d.retrieval.strategy} top_k={d.retrieval.top_k}  |  "
        f"version {d.version}",
        title="ForgeAI runtime", border_style="bright_black",
    ))
    console.print("[dim]Ctrl-C to exit.[/dim]\n")

    while True:
        try:
            q = console.input("[bold cyan]you ›[/bold cyan] ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]bye[/dim]")
            return
        if not q:
            continue
        r = agent.answer(q)
        style = "yellow" if r.refused else "green"
        label = "refused" if r.refused else "answer"
        console.print(f"\n[bold {style}]{label} ›[/bold {style}] {r.answer}")
        if r.citations:
            console.print(f"[dim]cited: {', '.join(r.citations)}[/dim]")
        console.print(f"[dim]retrieved: {', '.join(c.chunk_id for c in r.retrieved)} "
                      f"| confidence {r.confidence}[/dim]\n")
