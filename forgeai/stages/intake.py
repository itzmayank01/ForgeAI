"""F1: intake interviewer.

Resolves the brief's own contradiction - "asks at most 5 clarifying questions"
vs "runs unattended in front of us" - by supporting both from one code path.
Unattended mode asks the same questions, answers them itself, and records every
answer as an explicit Assumption. Surfacing assumptions beats skipping them.
"""
from __future__ import annotations

from ..llm.client import LLMClient
from ..llm.structured import structured
from ..models.common import CorpusSummary
from ..models.requirements import MAX_QUESTIONS, Assumption, RequirementsDoc, Topic
from ..prompts import intake as P


def describe_corpus(summary: CorpusSummary) -> str:
    lines = [f"{len(summary.documents)} documents, {summary.total_chars:,} characters."]
    for d in summary.documents:
        lines.append(f"- {d.filename} ({d.kind}, {d.n_chars:,} chars)")
    if summary.sample_excerpts:
        lines.append("\nExcerpts:")
        lines += [f'  "{e[:220]}..."' for e in summary.sample_excerpts[:4]]
    return "\n".join(lines)


def _fallback(brief: str, summary: CorpusSummary, mode: str) -> RequirementsDoc:
    """The pipeline must finish even when the model returns nothing usable."""
    return RequirementsDoc(
        brief=brief,
        scope=brief.strip()[:300],
        audience="unspecified",
        tone="professional and concise",
        must_answer=[
            Topic(name=d.filename.rsplit(".", 1)[0].replace("_", " "),
                  description=f"Questions answerable from {d.filename}.")
            for d in summary.documents[:5]
        ],
        must_refuse=[
            Topic(name="legal advice", description="Anything requiring a lawyer."),
            Topic(name="out-of-corpus questions",
                  description="Anything the supplied documents do not cover."),
        ],
        corpus_manifest=summary.documents,
        mode=mode,  # type: ignore[arg-type]
    )


def run_intake(
    client: LLMClient,
    brief: str,
    summary: CorpusSummary,
    *,
    interactive: bool = False,
    ask=input,
    log=print,
) -> RequirementsDoc:
    mode = "interactive" if interactive else "unattended"
    corpus = describe_corpus(summary)

    doc, trace = structured(
        client,
        instruction=P.DRAFT.format(brief=brief, corpus=corpus, mode=mode),
        model_cls=RequirementsDoc,
        temperature=0.2,
    )
    if doc is None:
        log(f"  intake: model failed after {trace.attempts} attempts; using fallback")
        doc = _fallback(brief, summary, mode)

    doc.brief = brief
    doc.mode = mode  # type: ignore[assignment]
    doc.corpus_manifest = summary.documents
    doc.questions_asked = doc.questions_asked[:MAX_QUESTIONS]

    if not doc.questions_asked:
        return doc

    if interactive:
        for q in doc.questions_asked:
            answer = ask(f"  ? {q}\n  > ").strip()
            if answer:
                doc.assumptions.append(Assumption(
                    question=q, assumed_answer=answer,
                    confidence="high", basis="answered by requester",
                ))
        return doc

    for q in doc.questions_asked:  # unattended: answer, and show your working
        a, _ = structured(
            client,
            instruction=P.SELF_ANSWER.format(brief=brief, corpus=corpus, question=q),
            model_cls=Assumption,
            temperature=0.1,
        )
        doc.assumptions.append(a or Assumption(
            question=q, assumed_answer="could not infer; treated as out of scope",
            confidence="low", basis="model produced no usable answer",
        ))
    return doc
