"""Factory orchestration: brief + documents -> tested agent + evidence.

The loop invariant that matters: a fix is KEPT only if it measurably helps.
Three blindly-applied fixes that end worse than iteration 0 is a factory defect,
so every iteration compares against the best score so far and reverts when it
loses ground.
"""
from __future__ import annotations

import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .config import settings
from .ingest.chunker import chunk_corpus
from .ingest.index import ChunkIndex
from .ingest.loaders import load_folder
from .llm.client import LLMClient, QuotaExhausted
from .models.agent_def import AgentDefinition
from .models.common import CorpusSummary
from .models.requirements import GroundabilityReport, RequirementsDoc
from .models.evals import CaseVerdict, EvalSuite, Scorecard
from .models.iteration import Budget, IterationLog, RunReport
from .runtime.agent import Agent, AgentResponse
from .stages import critic, evalgen, generator, groundability, intake, judge, optimizer

PASS_TARGET = 0.9


def _load(path: Path, model_cls):
    """Reuse a completed stage's artifact if it is already on disk."""
    if not path.exists():
        return None
    try:
        return model_cls.model_validate_json(path.read_text())
    except Exception:  # noqa: BLE001 - a corrupt artifact just means redo it
        return None


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


def run_eval(
    agent: Agent, suite: EvalSuite, budget: Budget | None = None,
    cache_path: Path | None = None, log=print,
) -> tuple[dict[str, AgentResponse], bool]:
    """Answer every case, checkpointing each one as it lands.

    Returns (responses, complete). Writing only after a full pass meant a quota
    death discarded every answer already obtained - a 28-case suite that died on
    case 27 produced nothing. Each response is now persisted immediately, so a
    resumed run re-answers only what is genuinely missing and progress is
    monotonic even when the provider only drips capacity.
    """
    done: dict[str, AgentResponse] = {}
    if cache_path and cache_path.exists():
        try:
            raw = json.loads(cache_path.read_text())
            done = {k: AgentResponse.model_validate(v) for k, v in raw.items()}
        except Exception:  # noqa: BLE001 - a corrupt cache just means redo it
            done = {}

    pending = [c for c in suite.cases if c.id not in done]
    if done:
        log(f"  reusing {len(done)} cached answers; {len(pending)} to go")

    lock = threading.Lock()
    stopped = False

    def flush() -> None:
        if cache_path is None:
            return
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(
            {k: v.model_dump() for k, v in done.items()}, indent=1))

    def one(case) -> None:
        nonlocal stopped
        if stopped:
            return
        if budget is not None and budget.exhausted():
            stopped = True
            return
        try:
            response = agent.answer(case.question)
        except QuotaExhausted:
            stopped = True
            return
        with lock:
            done[case.id] = response
            flush()

    with ThreadPoolExecutor(max_workers=settings.max_concurrency) as ex:
        list(ex.map(one, pending))
    flush()

    missing = [c.id for c in suite.cases if c.id not in done]
    if missing:
        log(f"  stopped with {len(missing)} case(s) unanswered; "
            f"re-run with --resume to finish them")
        for cid in missing:  # keep the scorecard complete and honest
            done[cid] = AgentResponse(
                answer="(not evaluated)", refused=True, confidence=0.0, retrieved=[])
    return done, not missing


def build(
    brief: str, docs_dir: Path, out_dir: Path, *,
    interactive: bool = False, max_iterations: int | None = None,
    resume: bool = False, log=print,
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
    req = _load(out_dir / "01_requirements.json", RequirementsDoc) if resume else None
    if req is not None:
        log("  reusing committed requirements")
    else:
        req = intake.run_intake(client, brief, summary, interactive=interactive,
                                index=index, log=log)
    log(f"  {len(req.must_answer)} must-answer, {len(req.must_refuse)} must-refuse, "
        f"{len(req.questions_asked)} questions")

    # --- 2. groundability ---------------------------------------------------
    log("[2/6] groundability guard")
    ground = _load(out_dir / "02_groundability.json", GroundabilityReport) if resume else None
    if ground is not None:
        log("  reusing committed groundability report")
    else:
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
    definition = _load(out_dir / "03_agent_def.v0.json", AgentDefinition) if resume else None
    if definition is not None:
        log("  reusing committed agent definition v0")
        rejected = definition.provenance.get("tools_rejected", [])
    else:
        definition, rejected = generator.generate_agent(client, req, summary, log=log)
    log(f"  tools attached: {', '.join(definition.tool_names) or 'none'}")
    _write(out_dir / "03_agent_def.v0.json", definition)

    # --- 4. evals -----------------------------------------------------------
    log("[4/6] generating eval suite")
    suite = _load(out_dir / "04_eval_suite.json", EvalSuite) if resume else None
    if suite is not None:
        log(f"  reusing committed eval suite ({len(suite.cases)} cases)")
    else:
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
        cache = out_dir / "05_iterations" / f"iter_{i}" / "responses.json"
        responses, complete = run_eval(agent, suite, budget, cache, log)
        if not complete:
            stop_reason = "incomplete eval pass (resume to finish)"
            log(f"  stopping: {stop_reason}")
            break
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
            # Compare against the BEST so far, not the previous iteration: a fix
            # that recovers to a tie is still not an improvement, but saying
            # "score fell 75% -> 82%" about it is simply false.
            last = iterations[-1]
            last.kept = False
            last.revert_reason = (
                f"scored {card.pass_rate:.0%} against best {best_score:.0%}; "
                f"reverted to v{best_def.version}"
            )
            log(f"  reverting: {last.revert_reason}")
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
        evaluated=bool(scorecards),
        final_pass_rate=best_score if best_score >= 0 else 0.0,
        scorecards=scorecards, iterations=iterations, residual_failures=residual,
        stop_reason=stop_reason or "completed", budget=budget,
        best_version=definition.version,
    )
    _write(out_dir / "06_report.json", report)
    if report.evaluated:
        log(f"[6/6] done: {report.final_pass_rate:.0%} pass, "
            f"{len(residual)} residual failures, {budget.tokens_used:,} tokens, "
            f"{budget.seconds_used}s")
    else:
        log(f"[6/6] stopped before any eval pass completed - NOT SCORED. "
            f"{stop_reason}")
    return report
