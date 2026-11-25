"""Guards for judge calibration.

Calibration is the only thing separating a pass rate from evidence, so the
labels it rests on have to be labels for the answers actually scored. The join
in `forgeai calibrate` is on case_id, which is not enough: re-answer a suite
with a different model or a repaired prompt and every old label still "fits"
by id while describing text nobody ever read.
"""
from __future__ import annotations

PREFIX_CHARS = 160


def answer_key(text: str, n: int = PREFIX_CHARS) -> str:
    """Collapse an answer to a comparable prefix.

    The gold template stores the answer truncated to 400 raw characters, often
    mid-word, and whitespace drifts between runs. Comparing lowercase
    alphanumerics only makes the check robust to both without being so loose
    that a genuinely different answer slips through.
    """
    return "".join(c for c in (text or "").lower() if c.isalnum())[:n]


def stale_labels(
    gold_labels: dict[str, dict], answers: dict[str, str]
) -> list[str]:
    """Return the ids whose labelled answer is not the answer now scored.

    A label with no recorded answer cannot be checked, so it is trusted rather
    than discarded - flat {case_id: bool} gold files predate the template and
    are still legitimate. An id absent from this run is simply not scored here
    and is left for the caller's own overlap check.
    """
    stale: list[str] = []
    for cid, rec in gold_labels.items():
        if cid not in answers:
            continue
        if not isinstance(rec, dict):
            continue
        want = answer_key(rec.get("answer", ""))
        if want and want != answer_key(answers[cid], len(want)):
            stale.append(cid)
    return stale
