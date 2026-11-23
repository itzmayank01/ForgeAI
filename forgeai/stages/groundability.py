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

# Thresholds derived empirically, not guessed. Measured max-cosine over 14
# topic probes across BOTH demo corpora, each written twice (verbose and terse)
# to test phrasing sensitivity:
#
#   genuinely covered   min 0.703
#   absent from corpus  max 0.653
#
# so 0.68 sits in the measured gap. The margin is thin (0.05), and it only
# holds because index.topic_support() probes several phrasings and takes the
# best - a single probe string swung one real topic between 0.758 and 0.674.
#
# A contrastive signal was tried first and REJECTED on the data: both
# (max - mean) margin and its z-score OVERLAP between covered and absent topics
# (-0.033 and -1.01 separation respectively), because an absent topic can still
# produce one chunk that stands out from a flat field. Plain max was the only
# signal that separated. Re-derive all of this if the embedding model changes.
TAU_UNSUPPORTED = 0.68   # below: no chunk actually covers this
TAU_SUPPORTED = 0.78     # above: clearly covered
ABORT_RATIO = 0.5        # more than half unsupported: refuse to build


def run_groundability(
    requirements: RequirementsDoc, index: ChunkIndex, *, log=print
) -> GroundabilityReport:
    unsupported: list[str] = []
    kept = []

    for topic in requirements.must_answer:
        score, mean_score, chunk_ids = index.topic_support(topic.name, topic.description)
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
