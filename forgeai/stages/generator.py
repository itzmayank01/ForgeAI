"""F3: agent generator - requirements + corpus -> declarative AgentDefinition.

Split into single-purpose model calls (prompt, then tools) because an 8B model
asked for a whole definition at once produces mush. Retrieval config and output
contract are derived deterministically from corpus statistics: no reason to let
a small model guess numbers we can compute.
"""
from __future__ import annotations

import re

from pydantic import BaseModel, Field

from ..llm.client import LLMClient
from ..llm.structured import structured
from ..models.agent_def import (
    AgentDefinition, OutputContract, RetrievalConfig, ToolBinding,
)
from ..models.common import CorpusSummary
from ..models.requirements import RequirementsDoc
from ..prompts import generator as P
from ..runtime.tools.registry import REGISTRY, describe_registry


class _PromptOut(BaseModel):
    system_prompt: str


class _ToolsOut(BaseModel):
    tools: list[ToolBinding] = Field(default_factory=list)


def _normalise(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def audit_tools(proposed: list[ToolBinding], req: RequirementsDoc) -> tuple[list[ToolBinding], list[str]]:
    """Deterministic gate on model-proposed tools.

    Two ways to be rejected: the tool does not exist, or its claimed
    triggering_requirement does not resolve to a real must_answer topic. This is
    what turns "an HR agent with a weather tool is a factory defect" from a hope
    into a check.
    """
    topics = [_normalise(t.name) for t in req.must_answer]
    kept, rejected = [], []

    for binding in proposed:
        if binding.name not in REGISTRY:
            rejected.append(f"{binding.name}: not in registry")
            continue
        claim = _normalise(binding.triggering_requirement)
        if not claim:
            rejected.append(f"{binding.name}: no triggering requirement")
            continue
        if not any(claim in t or t in claim or
                   len(set(claim.split()) & set(t.split())) >= 2 for t in topics):
            rejected.append(
                f"{binding.name}: claimed requirement {binding.triggering_requirement!r} "
                f"matches no must_answer topic"
            )
            continue
        kept.append(binding)
    return kept, rejected


def derive_retrieval(summary: CorpusSummary) -> RetrievalConfig:
    """Deterministic starting point. The optimizer tunes from here."""
    avg = summary.total_chars / max(summary.n_chunks, 1)
    return RetrievalConfig(
        chunk_size=800 if avg > 400 else 500,
        chunk_overlap=120,
        top_k=5 if len(summary.documents) <= 4 else 7,
        strategy="dense",
        min_score=0.25,
    )


def generate_agent(
    client: LLMClient, req: RequirementsDoc, summary: CorpusSummary, *, log=print
) -> tuple[AgentDefinition, list[str]]:
    must_answer = ", ".join(t.name for t in req.must_answer) or "(none)"
    must_refuse = ", ".join(t.name for t in req.must_refuse) or "(none)"

    prompt_out, _ = structured(
        client, model_cls=_PromptOut, temperature=0.3,
        instruction=P.SYSTEM_PROMPT.format(
            scope=req.scope, audience=req.audience, tone=req.tone,
            must_answer=must_answer, must_refuse=must_refuse,
        ),
    )
    system_prompt = prompt_out.system_prompt if prompt_out else _fallback_prompt(req)
    if prompt_out is None:
        log("  generator: prompt call failed; using deterministic template")

    tools_out, _ = structured(
        client, model_cls=_ToolsOut, temperature=0.0,
        instruction=P.TOOLS.format(
            registry=describe_registry(), scope=req.scope, must_answer=must_answer,
            kinds=", ".join(sorted({d.kind for d in summary.documents})) or "none",
        ),
    )
    proposed = tools_out.tools if tools_out else []
    tools, rejected = audit_tools(proposed, req)
    for r in rejected:
        log(f"  tool rejected -> {r}")

    definition = AgentDefinition(
        version=0,
        name=req.scope[:60] or "assistant",
        description=req.scope,
        system_prompt=system_prompt,
        retrieval=derive_retrieval(summary),
        tools=tools,
        output_contract=OutputContract(refusal_message=(
            "I can't answer that from the documents I have been given."
        )),
        temperature=0.1,
        provenance={
            "corpus_hash": summary.corpus_hash,
            "n_documents": len(summary.documents),
            "must_answer": [t.name for t in req.must_answer],
            "tools_proposed": [t.name for t in proposed],
            "tools_rejected": rejected,
        },
    )
    return definition, rejected


def _fallback_prompt(req: RequirementsDoc) -> str:
    return f"""ROLE
You are an assistant for {req.audience}. {req.scope}

SCOPE
You answer questions about: {', '.join(t.name for t in req.must_answer) or 'the supplied documents'}.

REFUSAL
You decline: {', '.join(t.name for t in req.must_refuse) or 'anything outside the documents'}.
If the retrieved context does not support an answer, refuse. Refusing is correct
behaviour, not failure.

GROUNDING
Answer only from the retrieved context below. Cite the chunk_id for every claim.
Never use outside knowledge.

FORMAT
Reply as JSON: answer, citations (list of chunk_id), refused (bool), confidence (0-1).

TONE
{req.tone}
"""
