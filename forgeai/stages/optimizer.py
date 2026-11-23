"""F6b: targeted fixes, not regeneration.

One rung per iteration, aimed at the largest failure cluster, so every change
is attributable to a measured delta. The ladder is deterministic; the model is
used only to WRITE prompt patch text, never to decide what to fix.
"""
from __future__ import annotations

from pydantic import BaseModel

from ..llm.client import LLMClient
from ..llm.structured import structured
from ..models.agent_def import AgentDefinition
from ..models.iteration import FIX_LADDER, FailureDiagnosis, FixAction

PATCH = """Patch ONE section of this assistant's system prompt.

CURRENT PROMPT:
{prompt}

SECTION TO STRENGTHEN: {section}

These test cases failed. Fix the cause, do not rewrite the prompt:
{failures}

Return the COMPLETE revised prompt with only that section changed. Keep every
other section byte-identical. Do not add new sections.
"""


class _Patched(BaseModel):
    system_prompt: str


def choose(diagnoses: list[FailureDiagnosis], used: set[tuple[str, str]]) -> tuple[str, str] | None:
    """Largest cluster first; skip rungs already spent on that category."""
    counts: dict[str, int] = {}
    for d in diagnoses:
        counts[d.category] = counts.get(d.category, 0) + 1

    for category, _ in sorted(counts.items(), key=lambda kv: -kv[1]):
        for rung in FIX_LADDER[category]:
            if (category, rung) not in used:
                return category, rung
    return None


def apply_fix(
    definition: AgentDefinition, category: str, rung: str,
    diagnoses: list[FailureDiagnosis], client: LLMClient, *, log=print,
) -> tuple[AgentDefinition, FixAction]:
    new = definition.model_copy(deep=True)
    new.version = definition.version + 1
    r = new.retrieval
    before: dict = {}
    after: dict = {}

    def note(field: str, old, val) -> None:
        before[field] = old
        after[field] = val

    if rung == "raise_top_k":
        note("top_k", r.top_k, min(r.top_k + 3, 12)); r.top_k = after["top_k"]
    elif rung == "shrink_chunks":
        note("chunk_size", r.chunk_size, max(300, r.chunk_size // 2))
        r.chunk_size = after["chunk_size"]
        note("chunk_overlap", r.chunk_overlap, min(250, r.chunk_overlap + 80))
        r.chunk_overlap = after["chunk_overlap"]
    elif rung == "enable_hybrid":
        note("strategy", r.strategy, "hybrid"); r.strategy = "hybrid"
    elif rung == "enable_query_rewrite":
        note("query_rewrite", r.query_rewrite, True); r.query_rewrite = True
    elif rung == "lower_min_score":
        note("min_score", r.min_score, max(0.0, round(r.min_score - 0.1, 2)))
        r.min_score = after["min_score"]
    elif rung == "raise_min_score":
        note("min_score", r.min_score, round(r.min_score + 0.1, 2))
        r.min_score = after["min_score"]
    elif rung == "drop_temperature":
        note("temperature", new.temperature, 0.0); new.temperature = 0.0
    elif rung == "force_citations":
        note("require_citations", new.output_contract.require_citations, True)
        new.output_contract.require_citations = True
    else:
        section = {
            "patch_format_block": "FORMAT", "patch_scope_block": "SCOPE",
            "add_worked_example": "GROUNDING", "add_grounding_clause": "GROUNDING",
            "widen_scope_statement": "SCOPE", "soften_refusal_clause": "REFUSAL",
        }.get(rung, "SCOPE")
        failures = "\n".join(f"- {d.case_id}: {d.evidence}" for d in diagnoses[:6])
        out, _ = structured(
            client, model_cls=_Patched, temperature=0.2,
            instruction=PATCH.format(
                prompt=definition.system_prompt, section=section, failures=failures),
        )
        if out and out.system_prompt.strip():
            note("system_prompt", f"<{len(definition.system_prompt)} chars>",
                 f"<{len(out.system_prompt)} chars, {section} revised>")
            new.system_prompt = out.system_prompt
        else:
            log(f"  optimizer: patch call failed for {rung}; no change applied")

    return new, FixAction(
        category=category, rung=rung,
        rationale=f"{len(diagnoses)} failures classified {category}; applying {rung}",
        targets_case_ids=[d.case_id for d in diagnoses if d.category == category],
        diff={"before": before, "after": after},
    )
