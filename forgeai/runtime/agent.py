"""F8: the generic runtime. Loads ANY AgentDefinition and runs it.

Shares nothing with the factory but the definition schema - which is what makes
"the generated agent must actually run" true rather than aspirational.
"""
from __future__ import annotations

import re
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
    """Number the sources, rather than labelling them with their chunk ids.

    Asked to cite `doc_01_c003`, gpt-oss reproduces the *shape* of an id and
    not the id: on hr_policy it answered correctly from retrieved text and then
    cited doc_01_c005 and doc_01_c006, chunks it had never been shown. Five of
    that run's ten failures were this and nothing else - the supporting clause
    was in context every time.

    Copying `2` is a far easier task than copying `doc_01_c005`, and the index
    is resolved back to a chunk id in code, so a citation is either a source
    that was offered or an out-of-range number we can name. That removes the
    opportunity for the error instead of instructing harder against it.
    """
    if not chunks:
        return "(no context retrieved)"
    parts = []
    for n, c in enumerate(chunks, 1):
        text = c.text if len(c.text) <= limit else c.text[:limit].rsplit(" ", 1)[0] + " …"
        parts.append(f"[{n}] {text}")
    return "\n\n".join(parts)


_CITE_NUM = re.compile(r"^\s*\[?(\d+)\]?\s*$")


def resolve_citations(raw: list[str], chunks: list[RetrievedChunk]) -> list[str]:
    """Map the model's citations onto the chunks it was actually given.

    Accepts a source number (`2`, `[2]`) and resolves it positionally. A raw
    chunk id is still honoured when it names a retrieved chunk, so a model that
    ignores the numbering and copies an id correctly is not punished for it.
    Anything else - an out-of-range number, an invented id - is dropped, which
    leaves the judge's set arithmetic to record a fabricated citation rather
    than quietly laundering one into a valid-looking reference.
    """
    valid = {c.chunk_id for c in chunks}
    out: list[str] = []
    for item in raw or []:
        m = _CITE_NUM.match(str(item))
        if m:
            idx = int(m.group(1))
            if 1 <= idx <= len(chunks):
                cid = chunks[idx - 1].chunk_id
                if cid not in out:
                    out.append(cid)
            continue
        text = str(item).strip().strip("[]")
        if text in valid and text not in out:
            out.append(text)
    return out


class Agent:
    def __init__(self, definition: AgentDefinition, index: ChunkIndex,
                 client: LLMClient, docs_dir: Path | None = None) -> None:
        self.definition = definition
        self.index = index
        self.client = client
        self.docs_dir = docs_dir

    @staticmethod
    def _might_need_tool(question: str, names: list[str]) -> bool:
        """Cheap pre-filter: could any attached tool conceivably apply here?"""
        q = question.lower()
        signals = {
            "calculator": any(w in q for w in (
                "total", "sum", "how much", "how many", "multiply", "times",
                "cost of", "calculate", "altogether", "combined", "per unit",
                "discount", "percent", "%")) or bool(re.search(r"\d", q)),
            "csv_lookup": bool(re.search(r"[A-Z]{2,}-\d+", question))
            or any(w in q for w in ("part ", "catalogue", "catalog", "stock",
                                    "lead time", "in stock", "row", "column")),
            "current_date": any(w in q for w in (
                "today", "now", "current", "this year", "this month", "expire",
                "still valid", "up to date", "deadline")),
            "weather": any(w in q for w in (
                "weather", "forecast", "temperature", "wind", "sea state")),
        }
        return any(signals.get(n, True) for n in names)

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
        if not self._might_need_tool(question, names):
            # Planning costs a model call per question, and most questions
            # plainly need nothing - a policy lookup does not need a calculator.
            # The gate is deliberately generous: it only skips when no attached
            # tool could plausibly apply, so a missed tool call stays far more
            # expensive than a wasted plan.
            return "", []

        plan, _ = structured(
            self.client, model_cls=_ToolPlan, temperature=0.0, max_tokens=500,
            model=self.definition.model or settings.agent_model,
            instruction=(
                "AVAILABLE TOOLS:\n" +
                "\n".join(f"- {n}: {REGISTRY[n].description}"
                           for n in names if n in REGISTRY) +
                f"\n\nCONTEXT ALREADY RETRIEVED:\n{context[:1200]}\n\n"
                f"QUESTION: {question}\n\n"
                # This prompt used to read "Most questions do not - the
                # retrieved context usually suffices. Return the tool name ONLY
                # if it is genuinely needed", and the planner duly returned an
                # empty string for every question in every run: 90 answers,
                # zero tool calls, including an arithmetic case the model did in
                # its head and got right by luck. Stating a prior that strongly
                # decides the question before the model looks at it - the same
                # way a docstring saying "a weather tool is a factory defect"
                # once taught the generator to attach no tools at all.
                #
                # So: a concrete criterion per tool, and no thumb on the scale.
                f"Decide whether answering this requires one of those tools.\n"
                f"- calculator: the answer needs arithmetic over values. Use it "
                f"rather than computing in your head, even for simple sums - a "
                f"figure you assert without computing it is a guess.\n"
                f"- current_date: the answer depends on what today's date is.\n"
                f"- csv_lookup: the question asks for a row or field from "
                f"tabular data, such as a part number or a stock level.\n"
                f"Set `tool` to the name of the one that applies, or an empty "
                f"string if none does. Put its arguments in `args` as plain "
                f"strings."
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

        # Record what the MODEL chose, not the plumbing injected around it.
        # `_root` is a Path, and putting it in the provenance record made the
        # answer cache unserializable: json.dumps died in flush(), losing a
        # whole pass. The bug was latent for as long as no tool ever fired, so
        # it surfaced the moment tool calls started working.
        return (f"\n\nTOOL RESULT ({name}): {result}",
                [{"tool": name, "args": dict(plan.args), "result": result[:300]}])

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
                f"Answer only from the context above. Every claim must cite "
                f"the source number it came from: put those numbers in "
                f"`citations`, for example [\"2\"] or [\"1\", \"3\"]. Use only "
                f"numbers shown above. If the context does not support an "
                f"answer, set refused to true."
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
            answer=out.answer, citations=resolve_citations(out.citations, chunks),
            refused=out.refused,
            confidence=out.confidence, retrieved=chunks, tool_calls=tool_calls,
        )
