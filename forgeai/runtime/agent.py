"""F8: the generic runtime. Loads ANY AgentDefinition and runs it.

Shares nothing with the factory but the definition schema - which is what makes
"the generated agent must actually run" true rather than aspirational.
"""
from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

from ..config import settings
from ..ingest.index import ChunkIndex
from ..llm.client import LLMClient
from ..llm.structured import structured
from ..models.agent_def import AgentDefinition
from ..models.common import RetrievedChunk
from .tools.registry import REGISTRY


class AgentAnswer(BaseModel):
    answer: str = ""
    citations: list[str] = Field(default_factory=list)
    refused: bool = False
    confidence: float = 0.5


class AgentResponse(BaseModel):
    """What the judge scores. `retrieved` is carried so retrieval_miss is
    diagnosable deterministically rather than guessed at."""

    answer: str
    citations: list[str] = Field(default_factory=list)
    refused: bool = False
    confidence: float = 0.5
    retrieved: list[RetrievedChunk] = Field(default_factory=list)
    tool_calls: list[dict] = Field(default_factory=list)


CHUNK_CHARS = 700
"""Retrieved text dominates every agent call, so it is the only lever that
meaningfully changes a run's token cost. 700 characters keeps whole policy
clauses intact while cutting a top_k=8 context roughly in half."""


def format_context(chunks: list[RetrievedChunk], limit: int = CHUNK_CHARS) -> str:
    if not chunks:
        return "(no context retrieved)"
    parts = []
    for c in chunks:
        text = c.text if len(c.text) <= limit else c.text[:limit].rsplit(" ", 1)[0] + " …"
        parts.append(f"[{c.chunk_id}] {text}")
    return "\n\n".join(parts)


class Agent:
    def __init__(self, definition: AgentDefinition, index: ChunkIndex,
                 client: LLMClient) -> None:
        self.definition = definition
        self.index = index
        self.client = client

    @classmethod
    def from_file(cls, path: str | Path, index: ChunkIndex, client: LLMClient) -> "Agent":
        return cls(AgentDefinition.model_validate_json(Path(path).read_text()), index, client)

    def answer(self, question: str) -> AgentResponse:
        chunks = self.index.search(question, self.definition.retrieval)

        # Nothing cleared the retrieval floor: refuse deterministically rather
        # than inviting the model to fill the gap from memory.
        if not chunks:
            return AgentResponse(
                answer=self.definition.output_contract.refusal_message,
                refused=True, confidence=0.0, retrieved=[],
            )

        tools = ", ".join(self.definition.tool_names) or "none"
        out, trace = structured(
            self.client,
            system=self.definition.system_prompt,
            instruction=(
                f"CONTEXT:\n{format_context(chunks)}\n\n"
                f"AVAILABLE TOOLS: {tools}\n\n"
                f"QUESTION: {question}\n\n"
                f"Answer only from the context above. Cite the chunk_id in "
                f"square brackets for every claim. If the context does not "
                f"support an answer, set refused to true."
            ),
            model_cls=AgentAnswer,
            model=settings.agent_model,
            temperature=self.definition.temperature,
        )
        if out is None:  # unusable output is a refusal, never a guess
            return AgentResponse(
                answer=self.definition.output_contract.refusal_message,
                refused=True, confidence=0.0, retrieved=chunks,
            )
        return AgentResponse(
            answer=out.answer, citations=out.citations, refused=out.refused,
            confidence=out.confidence, retrieved=chunks,
        )
