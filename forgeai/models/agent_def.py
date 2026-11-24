"""The declarative agent definition (F3) - the ONLY contract shared between
the factory and the runtime. If it serialises, the chat runner can run it."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

RetrievalStrategy = Literal["dense", "bm25", "hybrid"]


class RetrievalConfig(BaseModel):
    """Every field here is a lever the optimizer can pull on a `retrieval_miss`."""

    chunk_size: int = 800
    chunk_overlap: int = 120
    top_k: int = 5
    strategy: RetrievalStrategy = "dense"
    hybrid_alpha: float = 0.5
    query_rewrite: bool = False
    min_score: float = 0.25


class ToolBinding(BaseModel):
    """`triggering_requirement` must resolve against the requirements doc.

    This is what makes the "HR agent with a weather tool is a factory defect"
    check deterministic instead of hopeful.
    """

    name: str
    reason: str
    triggering_requirement: str


class OutputContract(BaseModel):
    """Forcing structured output buys free, reliable refusal detection -
    the judge reads a boolean instead of guessing from prose."""

    format: Literal["json"] = "json"
    require_citations: bool = True
    refusal_message: str = "That is outside what these documents cover."
    answer_schema: dict[str, Any] = Field(
        default_factory=lambda: {
            "answer": "string",
            "citations": "list[chunk_id]",
            "refused": "bool",
            "confidence": "float 0-1",
        }
    )


class AgentDefinition(BaseModel):
    version: int = 0
    name: str
    description: str = ""
    system_prompt: str
    retrieval: RetrievalConfig = Field(default_factory=RetrievalConfig)
    tools: list[ToolBinding] = Field(default_factory=list)
    output_contract: OutputContract = Field(default_factory=OutputContract)
    model: str = ""
    """Which model answers with this definition. Empty falls back to settings
    for older definitions, but the generator always records it: a definition
    that does not name its model cannot be reproduced, and the judge's
    self-preference defense depends on knowing it differs from the judge's."""
    temperature: float = 0.1
    provenance: dict[str, Any] = Field(default_factory=dict)

    @property
    def tool_names(self) -> set[str]:
        return {t.name for t in self.tools}
