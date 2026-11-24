"""F8: the generic runtime. Loads ANY AgentDefinition and runs it.

Shares nothing with the factory but the definition schema - which is what makes
"the generated agent must actually run" true rather than aspirational.
"""
from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, Field

from ..config import settings
from ..ingest.index import ChunkIndex
from ..llm.client import LLMClient
from ..llm.structured import structured
from ..models.agent_def import AgentDefinition
from ..models.common import RetrievedChunk
from .tools.registry import REGISTRY


class _ToolPlan(BaseModel):
    """Whether this question needs a tool, and with what arguments.

    Deliberately flat: a small model reliably produces a name and a shallow
    argument map, and produced malformed JSON for anything more nested.
    """

    tool: str = ""
    args: dict[str, str] = Field(default_factory=dict)


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
                 client: LLMClient, docs_dir: Path | None = None) -> None:
        self.definition = definition
        self.index = index
        self.client = client
        self.docs_dir = docs_dir

    def _run_tool(self, question: str, context: str) -> tuple[str, list[dict]]:
        """One optional tool call before answering.

        A declared tool that is never invoked is decoration, and an agent
        definition that lists `calculator` for "Order Total Calculation" has to
        be able to actually add up. One round keeps it bounded: the tool informs
        the answer, it does not drive a loop.
        """
        names = sorted(self.definition.tool_names)
        if not names:
            return "", []

        plan, _ = structured(
            self.client, model_cls=_ToolPlan, temperature=0.0,
            model=self.definition.model or settings.agent_model,
            instruction=(
                "AVAILABLE TOOLS:\n" +
                "\n".join(f"- {n}: {REGISTRY[n].description}"
                           for n in names if n in REGISTRY) +
                f"\n\nCONTEXT ALREADY RETRIEVED:\n{context[:1200]}\n\n"
                f"QUESTION: {question}\n\n"
                f"Does answering this need one of those tools? Most questions do "
                f"not - the retrieved context usually suffices. Return `tool` as "
                f"the tool name ONLY if it is genuinely needed, otherwise an "
                f"empty string. Put its arguments in `args` as plain strings."
            ),
        )
        if plan is None or not plan.tool.strip():
            return "", []

        name = plan.tool.strip()
        if name not in self.definition.tool_names or name not in REGISTRY:
            # The definition is the contract: a tool it does not attach cannot
            # be reached, whatever the model asks for.
            return "", [{"tool": name, "status": "refused: not attached"}]

        kwargs = dict(plan.args)
        if name == "csv_lookup" and self.docs_dir is not None:
            kwargs["_root"] = self.docs_dir
        try:
            result = str(REGISTRY[name].fn(**kwargs))[:800]
        except Exception as exc:  # noqa: BLE001 - a bad call must not kill the answer
            result = f"error: {type(exc).__name__}: {exc}"

        return (f"\n\nTOOL RESULT ({name}): {result}",
                [{"tool": name, "args": kwargs, "result": result[:300]}])

    @classmethod
    def from_file(cls, path: str | Path, index: ChunkIndex, client: LLMClient,
                  docs_dir: Path | None = None) -> "Agent":
        return cls(AgentDefinition.model_validate_json(Path(path).read_text()),
                   index, client, docs_dir)

    def answer(self, question: str) -> AgentResponse:
        chunks = self.index.search(question, self.definition.retrieval)

        # Nothing cleared the retrieval floor: refuse deterministically rather
        # than inviting the model to fill the gap from memory.
        if not chunks:
            return AgentResponse(
                answer=self.definition.output_contract.refusal_message,
                refused=True, confidence=0.0, retrieved=[],
            )

        context = format_context(chunks)
        tool_text, tool_calls = self._run_tool(question, context)
        tools = ", ".join(self.definition.tool_names) or "none"
        out, trace = structured(
            self.client,
            system=self.definition.system_prompt,
            instruction=(
                f"CONTEXT:\n{context}{tool_text}\n\n"
                f"AVAILABLE TOOLS: {tools}\n\n"
                f"QUESTION: {question}\n\n"
                f"Answer only from the context above. Cite the chunk_id in "
                f"square brackets for every claim. If the context does not "
                f"support an answer, set refused to true."
            ),
            model_cls=AgentAnswer,
            model=self.definition.model or settings.agent_model,
            temperature=self.definition.temperature,
        )
        if out is None:  # unusable output is a refusal, never a guess
            return AgentResponse(
                answer=self.definition.output_contract.refusal_message,
                refused=True, confidence=0.0, retrieved=chunks,
            )
        return AgentResponse(
            answer=out.answer, citations=out.citations, refused=out.refused,
            confidence=out.confidence, retrieved=chunks, tool_calls=tool_calls,
        )
