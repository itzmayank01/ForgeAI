"""Factory orchestration: brief + documents -> tested agent + evidence.

The loop invariant that matters: a fix is KEPT only if it measurably helps.
Three blindly-applied fixes that end worse than iteration 0 is a factory defect,
so every iteration compares against the best score so far and reverts when it
loses ground.
"""
from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .config import settings
from .ingest.chunker import chunk_corpus
from .ingest.index import ChunkIndex
from .ingest.loaders import load_folder
from .llm.client import LLMClient
from .models.agent_def import AgentDefinition
from .models.common import CorpusSummary
from .models.evals import CaseVerdict, EvalSuite, Scorecard
from .models.iteration import Budget, IterationLog, RunReport
from .runtime.agent import Agent, AgentResponse
from .stages import critic, evalgen, generator, groundability, intake, judge, optimizer

PASS_TARGET = 0.9


def _write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = obj.model_dump_json(indent=2) if hasattr(obj, "model_dump_json") else json.dumps(obj, indent=2)
    path.write_text(text)


def build_corpus_summary(refs, texts, chunks) -> CorpusSummary:
    kinds: dict[str, int] = {}
    for r in refs:
        kinds[r.kind] = kinds.get(r.kind, 0) + 1
    return CorpusSummary(
        documents=refs, n_chunks=len(chunks),
        total_chars=sum(r.n_chars for r in refs), kinds=kinds,
        sample_excerpts=[c.text[:300] for c in chunks[:4]],
    )


def run_eval(agent: Agent, suite: EvalSuite) -> dict[str, AgentResponse]:
    """Concurrent: 20 cases against a fast endpoint is seconds, not a minute.
    This is what makes a live unattended demo watchable."""
    def one(case):
        return case.id, agent.answer(case.question)

    with ThreadPoolExecutor(max_workers=settings.max_concurrency) as ex:
        return dict(ex.map(one, suite.cases))


def build(
    brief: str, docs_dir: Path, out_dir: Path, *,
    interactive: bool = False, max_iterations: int | None = None, log=print,
) -> RunReport:
    budget = Budget(
        max_tokens=settings.max_tokens, max_seconds=settings.max_seconds,
        max_iterations=max_iterations or settings.max_iterations,
    )
    client = LLMClient()
    out_dir.mkdir(parents=True, exist_ok=True)

    # --- 0. ingest ----------------------------------------------------------
    log("[0/6] ingesting documents")
    refs, texts, skipped = load_folder(docs_dir)
    if not refs:
        raise RuntimeError(f"no readable documents in {docs_dir}")
    for s in skipped:
        log(f"  skipped {s}")
    chunks = chunk_corpus(refs, texts, 800, 120)
    index = ChunkIndex(chunks)
    summary = build_corpus_summary(refs, texts, chunks)
    log(f"  {len(refs)} documents, {len(chunks)} chunks")
    _write(out_dir / "00_inputs" / "manifest.json",
           {"brief": brief, "documents": [r.model_dump() for r in refs],
            "skipped": skipped, "corpus_hash": summary.corpus_hash})

    # --- 1. intake ----------------------------------------------------------
    log("[1/6] intake interview")
    req = intake.run_intake(client, brief, summary, interactive=interactive,
                            index=index, log=log)
    log(f"  {len(req.must_answer)} must-answer, {len(req.must_refuse)} must-refuse, "
        f"{len(req.questions_asked)} questions")

    # --- 2. groundability ---------------------------------------------------
    log("[2/6] groundability guard")
    ground = groundability.run_groundability(req, index, log=log)
    _write(out_dir / "01_requirements.json", req)
    _write(out_dir / "02_groundability.json", ground)
    if ground.aborted:
        log(f"  ABORT: {ground.abort_reason}")
        report = RunReport(
            run_id=out_dir.name, brief=brief, corpus_hash=summary.corpus_hash,
            final_pass_rate=0.0, stop_reason=f"groundability abort: {ground.abort_reason}",
            budget=budget,
        )
        _write(out_dir / "06_report.json", report)
        return report

    # --- 3. generate --------------------------------------------------------
    log("[3/6] generating agent definition")
    definition, rejected = generator.generate_agent(client, req, summary, log=log)
    log(f"  tools attached: {', '.join(definition.tool_names) or 'none'}")
    _write(out_dir / "03_agent_def.v0.json", definition)

    # --- 4. evals -----------------------------------------------------------
    log("[4/6] generating eval suite")
    suite = evalgen.generate_suite(client, chunks, req, index, log=log)
    log(f"  {len(suite.cases)} cases: {suite.counts()}")
    _write(out_dir / "04_eval_suite.json", suite)

    # --- 5. critic -> optimizer loop ---------------------------------------
    log("[5/6] critic -> optimizer loop")
    scorecards: list[Scorecard] = []
    iterations: list[IterationLog] = []
    used_rungs: set[tuple[str, str]] = set()
    best_def, best_score, best_verdicts = definition, -1.0, []
    chunk_shape = (800, 120)
    stop_reason = ""

    for i in range(budget.max_iterations + 1):
        t0 = time.time()
        if (reason := budget.exhausted()):
            stop_reason = reason
            log(f"  stopping: {reason}")
            break

        # Re-chunk only when the shape actually changed: re-embedding the whole
        # corpus every iteration would dominate the time budget for nothing.
        shape = (definition.retrieval.chunk_size, definition.retrieval.chunk_overlap)
        if shape != chunk_shape:
            log(f"  re-chunking {chunk_shape} -> {shape}")
            index = ChunkIndex(chunk_corpus(refs, texts, *shape))
            chunk_shape = shape

        agent = Agent(definition, index, client)
        responses = run_eval(agent, suite)
        verdicts = judge.judge_all(suite.cases, responses, client)
        card = Scorecard.from_verdicts(i, verdicts, suite.cases)
        scorecards.append(card)
        budget.tokens_used = client.usage.total
        log(f"  iteration {i}: pass {card.pass_rate:.0%} ({card.passed}/{card.total})"
            f"  escalated {card.llm_escalation_rate:.0%}")
        _write(out_dir / "05_iterations" / f"iter_{i}" / "scorecard.json", card)
        _write(out_dir / "05_iterations" / f"iter_{i}" / "verdicts.json",
               {"verdicts": [v.model_dump() for v in verdicts]})

        if card.pass_rate > best_score:
            best_def, best_score, best_verdicts = definition, card.pass_rate, verdicts
        elif iterations:
            iterations[-1].kept = False
            iterations[-1].revert_reason = (
                f"score fell {iterations[-1].score_before:.0%} -> {card.pass_rate:.0%}; "
                f"reverted to v{best_def.version}"
            )
            log(f"  reverting: {iterations[-1].revert_reason}")
            definition = best_def

        if card.pass_rate >= PASS_TARGET:
            stop_reason = f"reached pass target {PASS_TARGET:.0%}"
            log(f"  stopping: {stop_reason}")
            break
        if i == budget.max_iterations:
            stop_reason = f"iteration cap ({budget.max_iterations}) reached"
            break

        diagnoses = critic.diagnose(suite.cases, verdicts)
        counts: dict[str, int] = {}
        for d in diagnoses:
            counts[d.category] = counts.get(d.category, 0) + 1
        log(f"  failures: {counts}")

        pick = optimizer.choose(diagnoses, used_rungs)
        if pick is None:
            stop_reason = "fix ladder exhausted"
            log(f"  stopping: {stop_reason}")
            break
        used_rungs.add(pick)
        definition, fix = optimizer.apply_fix(
            definition, pick[0], pick[1], diagnoses, client, log=log)
        log(f"  fix: {pick[0]} -> {pick[1]}")

        entry = IterationLog(
            iteration=i, failures_by_category=counts, diagnoses=diagnoses, fix=fix,
            score_before=card.pass_rate, seconds=round(time.time() - t0, 1),
            tokens=client.usage.total,
        )
        iterations.append(entry)
        _write(out_dir / "05_iterations" / f"iter_{i}" / "fix.json", entry)

    for n, entry in enumerate(iterations):  # back-fill the measured deltas
        if n + 1 < len(scorecards):
            entry.score_after = scorecards[n + 1].pass_rate

    # --- 6. report ----------------------------------------------------------
    definition = best_def
    _write(out_dir / "03_agent_def.final.json", definition)
    index.export_for_web(out_dir / "web" / "chunks.json")

    residual = [
        {"case_id": v.case_id, "question": next(
            (c.question for c in suite.cases if c.id == v.case_id), ""),
         "why": v.notes or "failed"}
        for v in best_verdicts if not v.passed
    ]
    report = RunReport(
        run_id=out_dir.name, brief=brief, corpus_hash=summary.corpus_hash,
        final_pass_rate=best_score if best_score >= 0 else 0.0,
        scorecards=scorecards, iterations=iterations, residual_failures=residual,
        stop_reason=stop_reason or "completed", budget=budget,
        best_version=definition.version,
    )
    _write(out_dir / "06_report.json", report)
    log(f"[6/6] done: {report.final_pass_rate:.0%} pass, "
        f"{len(residual)} residual failures, {budget.tokens_used:,} tokens, "
        f"{budget.seconds_used}s")
    return report
