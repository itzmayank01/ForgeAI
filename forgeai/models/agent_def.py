"""The declarative agent definition (F3) - the ONLY contract shared between
the factory and the runtime. If it serialises, the chat runner can run it."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

RetrievalStrategy = Literal["dense", "bm25", "hybrid"]


# Every field here is a lever the optimizer can pull on a `retrieval_miss`.
class RetrievalConfig(BaseModel):

    chunk_size: int = 800
    chunk_overlap: int = 120
    top_k: int = 5
    strategy: RetrievalStrategy = "dense"
    hybrid_alpha: float = 0.5
    query_rewrite: bool = False
    min_score: float = 0.25


# NOTE: a class docstring becomes the JSON-schema "description" and the model
# reads it as instruction. This one used to say "an HR agent with a weather tool
# is a factory defect", which taught the generator to attach NOTHING - even to a
# spares brief whose own requirements include "Order Total Calculation". The
# rationale lives here, out of the schema, where only maintainers see it:
# triggering_requirement is what makes the tool audit deterministic rather than
# hopeful, because it must resolve against a real must-answer topic.
class ToolBinding(BaseModel):
    name: str = Field(description="Tool name, exactly as listed in the registry.")
    reason: str = Field(description="Why this assistant needs it, in one line.")
    triggering_requirement: str = Field(
        description="The exact must-answer topic name that requires this tool.")


# Forcing structured output buys free, reliable refusal detection: the judge
# reads a boolean instead of guessing from prose.
class OutputContract(BaseModel):

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
