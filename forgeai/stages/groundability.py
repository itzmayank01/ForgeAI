"""F2: groundability guard.

If the brief asks for what the documents cannot support, say so HERE - before
any agent exists to hallucinate the gap away. Unsupported topics are moved into
must_refuse, so the generated agent declines them by construction.

The signal is deterministic (mean top-k cosine). Only the ambiguous middle band
escalates to the model, keeping the guard cheap and reproducible.
"""
from __future__ import annotations

from ..ingest.index import ChunkIndex
from ..models.requirements import GroundabilityReport, RequirementsDoc

# Calibrated on bge-small-en-v1.5 cosine against the HR fixture, where a
# genuinely covered topic scores 0.83-0.85, a domain-adjacent but absent topic
# 0.54, and an unrelated topic 0.44. Re-check these if the embedding model
# changes - they are model-specific, not universal.
TAU_UNSUPPORTED = 0.62   # below: no chunk actually covers this
TAU_SUPPORTED = 0.74     # above: clearly covered
ABORT_RATIO = 0.5        # more than half unsupported: refuse to build


def run_groundability(
    requirements: RequirementsDoc, index: ChunkIndex, *, log=print
) -> GroundabilityReport:
    unsupported: list[str] = []
    kept = []

    for topic in requirements.must_answer:
        query = f"{topic.name}. {topic.description}"
        score, mean_score, chunk_ids = index.support_score(query)
        topic.support_score = score
        topic.supporting_chunks = chunk_ids

        if score < TAU_UNSUPPORTED:
            topic.verdict = "unsupported"
            unsupported.append(topic.name)
            log(f"  unsupported: {topic.name!r} (max {score}, mean {mean_score})")
        else:
            topic.verdict = "supported" if score >= TAU_SUPPORTED else "weak"
            kept.append(topic)

    total = len(requirements.must_answer)
    ratio = round(len(unsupported) / total, 3) if total else 0.0

    report = GroundabilityReport(
        topics=requirements.must_answer,
        unsupported=unsupported,
        unsupported_ratio=ratio,
    )

    if ratio > ABORT_RATIO:
        report.aborted = True
        report.abort_reason = (
            f"{len(unsupported)}/{total} requested topics have no support in the "
            f"corpus. Building an agent here would guarantee hallucination. "
            f"Supply documents covering: {', '.join(unsupported)}."
        )
        return report

    # Demote rather than delete: the agent must actively refuse these.
    for topic in requirements.must_answer:
        if topic.verdict == "unsupported":
            topic.description = (
                f"{topic.description} NOT COVERED by the supplied documents."
            )
            requirements.must_refuse.append(topic)
            report.moved_to_refuse.append(topic.name)
    requirements.must_answer = kept
    return report
