"""ForgeAI CLI.

    forgeai build --brief demos/hr_policy/brief.txt --docs demos/hr_policy/docs
    forgeai chat  --run runs/hr_policy_xyz
    forgeai calibrate --run runs/hr_policy_xyz --gold gold/hr.json
"""
from __future__ import annotations

import json
from pathlib import Path

import typer
from rich.console import Console

from .models.agent_def import AgentDefinition
from .models.iteration import JudgeCalibration, RunReport

app = typer.Typer(add_completion=False, help="ForgeAI - the agent that builds agents.")
console = Console()


def _resolve_docs(run: Path) -> Path | None:
    """Find the corpus a run was built from, by CONTENT not filename.

    demos/hr_policy and demos/hr_policy_changed hold the same filenames with
    different text - matching on names would silently attach the wrong corpus
    to a chat session, and the mistake would look like a bad answer rather than
    a bad lookup. The manifest records a hash per document, so use that.
    """
    # Hash through the real loader. A CSV is converted to row-per-line prose
    # before hashing, so reading the raw bytes gives a different digest and the
    # spares corpus would never match itself.
    from .ingest.loaders import load_folder

    manifest = run / "00_inputs" / "manifest.json"
    if not manifest.exists():
        return None
    wanted = {d["sha256"] for d in json.loads(manifest.read_text())["documents"]}
    if not wanted:
        return None

    for candidate in sorted(Path(".").glob("*/*/docs")) + sorted(Path(".").glob("*/docs")):
        if not candidate.is_dir():
            continue
        try:
            refs, _, _ = load_folder(candidate)
        except Exception:  # noqa: BLE001 - an unreadable folder just does not match
            continue
        if wanted <= {r.sha256 for r in refs}:
            return candidate
    return None


@app.command()
def build(
    brief: Path = typer.Option(..., help="File containing the one-paragraph brief."),
    docs: Path = typer.Option(..., help="Folder of source documents."),
    out: Path = typer.Option(None, help="Run directory (default runs/<name>_<ts>)."),
    interactive: bool = typer.Option(False, help="Ask clarifying questions instead of self-answering."),
    max_iterations: int = typer.Option(None, help="Override the iteration cap."),
    resume: bool = typer.Option(False, help="Reuse artifacts already in the run directory."),
    tournament: bool = typer.Option(False, help="Score 3 candidate prompts and keep the winner."),
) -> None:
    """Run the factory end to end."""
    from datetime import datetime

    from .pipeline import build as run_build
    from .stages.reporter import render

    text = brief.read_text().strip()
    out = out or Path("runs") / f"{docs.parent.name}_{datetime.now():%Y%m%d_%H%M%S}"

    console.rule(f"[bold]ForgeAI[/bold]  {out.name}")
    report = run_build(text, docs, out, interactive=interactive,
                       max_iterations=max_iterations, resume=resume,
                       tournament=tournament, log=console.print)

    final = out / "03_agent_def.final.json"
    if final.exists():
        md = render(report, AgentDefinition.model_validate_json(final.read_text()))
        (out / "06_report.md").write_text(md)
        console.print(f"\n[dim]report ->[/dim] {out / '06_report.md'}")
    headline = (f"[bold]{report.final_pass_rate:.0%} pass[/bold]"
                if report.evaluated else "[bold yellow]not scored[/bold yellow]")
    console.rule(f"{headline}  ·  {report.stop_reason}")


@app.command()
def budget(
    docs: Path = typer.Option(..., help="Folder of source documents."),
    cases: int = typer.Option(22, help="Eval cases to plan for."),
    iterations: int = typer.Option(2, help="Loop iterations to plan for."),
) -> None:
    """Estimate a run's token cost per model BEFORE spending it.

    Daily caps are per model, so what matters is not the total but whether any
    single bucket overflows. Free tier is 200,000 per model per day.
    """
    import httpx

    from .config import settings
    from .ingest.chunker import chunk_corpus
    from .ingest.loaders import load_folder
    from .runtime.agent import CHUNK_CHARS

    refs, texts, _ = load_folder(docs)
    chunks = chunk_corpus(refs, texts, 800, 120)

    # Per-call estimates measured from live runs: a structured call with
    # reasoning_effort=low lands near 250 tokens plus its prompt.
    ctx = (CHUNK_CHARS * 5) // 4            # top_k=5 of trimmed chunks
    per_agent = ctx + 400 + 300             # context + prompt + completion
    per_small = 700

    plan = {
        settings.gen_model: 4 * per_small + 2 * per_small + cases * per_agent * iterations,
        settings.evalgen_model: (len(chunks) + cases + 8) * per_small,
        settings.judge_model: int(cases * 0.25) * per_small * iterations,
    }

    console.print(f"\n[bold]{len(refs)} documents · {len(chunks)} chunks · "
                  f"{cases} cases · {iterations} iterations[/bold]\n")
    console.print(f"{'model':28} {'projected':>10} {'cap':>9}  status")
    ok = True
    for model, tokens in plan.items():
        over = tokens > 200_000
        ok &= not over
        flag = "[red]OVER[/red]" if over else "[green]fits[/green]"
        console.print(f"{model:28} {tokens:>10,} {200_000:>9,}  {flag}")

    console.print(f"\ntotal across buckets: {sum(plan.values()):,}")
    console.print("Caps are per model, so the total is not the limit - "
                  "only a single bucket overflowing is.")

    # Report whatever headroom the provider says is left right now.
    try:
        h = {"Authorization": f"Bearer {settings.require_key()}"}
        console.print()
        for model in plan:
            r = httpx.post(f"{settings.base_url}/chat/completions", headers=h, timeout=20,
                           json={"model": model, "messages": [{"role": "user", "content": "hi"}],
                                 "max_tokens": 5})
            state = "[red]exhausted[/red]" if r.status_code == 429 else "[green]available[/green]"
            console.print(f"  {model:28} {state}")
    except Exception as exc:  # noqa: BLE001 - a probe failure must not fail the estimate
        console.print(f"[dim]could not probe live quota: {exc}[/dim]")

    raise typer.Exit(0 if ok else 1)


@app.command()
def chat(
    run: Path = typer.Option(..., help="A run directory produced by `build`."),
    definition: Path = typer.Option(None, help="Override the agent definition path."),
    docs: Path = typer.Option(None, help="Document folder, so file-reading tools work."),
) -> None:
    """Talk to a generated agent. Loads ANY definition (F8)."""
    from .runtime.runner import chat as run_chat

    # csv_lookup reads from the corpus, so without this an attached tool would
    # silently fail at the one moment someone is watching it.
    if docs is None:
        docs = _resolve_docs(run)

    run_chat(definition or run / "03_agent_def.final.json",
             run / "web" / "chunks.json", docs)


@app.command()
def regress(
    run: Path = typer.Option(..., help="Baseline run whose eval suite to replay."),
    docs: Path = typer.Option(..., help="Changed document folder."),
    out: Path = typer.Option(None, help="Where to write the regression report."),
) -> None:
    """Replay a baseline eval set against an agent regenerated from changed docs.

    The question is not whether the new agent scores well but what this change
    BROKE: a case that passed before and fails now is a regression even if the
    headline rate improves.
    """
    from .ingest.chunker import chunk_corpus
    from .ingest.index import ChunkIndex
    from .ingest.loaders import load_folder
    from .llm.client import LLMClient
    from .models.evals import CaseVerdict, EvalSuite
    from .pipeline import build_corpus_summary, run_eval
    from .runtime.agent import Agent
    from .stages import generator, judge, intake
    from .stages.regression import compare, render

    suite = EvalSuite.model_validate_json((run / "04_eval_suite.json").read_text())
    baseline = json.loads(
        (run / "05_iterations" / "iter_0" / "verdicts.json").read_text())["verdicts"]
    before = [CaseVerdict.model_validate(v) for v in baseline]
    old_manifest = json.loads((run / "00_inputs" / "manifest.json").read_text())

    console.rule(f"[bold]regression[/bold] {run.name} vs {docs}")
    refs, texts, _ = load_folder(docs)
    chunks = chunk_corpus(refs, texts, 800, 120)
    index = ChunkIndex(chunks)
    summary = build_corpus_summary(refs, texts, chunks)
    console.print(f"  {len(refs)} documents, {len(chunks)} chunks")

    client = LLMClient()
    req = intake.run_intake(client, old_manifest["brief"], summary,
                            index=index, log=console.print)
    definition, _ = generator.generate_agent(client, req, summary, log=console.print)
    console.print(f"  regenerated agent v{definition.version}")

    responses, complete = run_eval(Agent(definition, index, client), suite,
                                   None, None, console.print)
    if not complete:
        console.print("[yellow]  incomplete pass — comparison would be misleading[/yellow]")
        raise typer.Exit(1)

    after = judge.judge_all(suite.cases, responses, client)
    report = compare(suite.cases, before, after, baseline_run=run.name,
                     corpus_before=old_manifest.get("corpus_hash", "?"),
                     corpus_after=summary.corpus_hash)

    out = out or run / "07_regression.md"
    out.write_text(render(report))
    (out.with_suffix(".json")).write_text(report.model_dump_json(indent=2))

    console.print(f"\n  {report.pass_rate_before:.0%} -> {report.pass_rate_after:.0%}  "
                  f"broke {len(report.broke)} · fixed {len(report.fixed)} · "
                  f"unchanged {report.unchanged}")
    for d in report.broke:
        console.print(f"  [red]broke[/red] {d.case_id}: {d.question[:70]}")
    console.print(f"  report -> {out}")
    raise typer.Exit(1 if report.regressed else 0)


@app.command()
def gold(
    run: Path = typer.Option(..., help="Run directory holding judged verdicts."),
    out: Path = typer.Option(None, help="Where to write the template."),
    iteration: int = typer.Option(0, help="Which iteration's verdicts to label."),
    sample: int = typer.Option(12, help="How many cases to put in the template."),
) -> None:
    """Emit a hand-labelling template for judge calibration.

    Calibration is the difference between a score and evidence, but it only
    happens if labelling is easy. This writes the question, the agent's answer
    and the judge's verdict side by side, with a `human` field to correct - and
    deliberately samples across pass AND fail so the labels cannot be trivially
    agreeable.
    """
    import random

    verdicts = json.loads(
        (run / "05_iterations" / f"iter_{iteration}" / "verdicts.json").read_text()
    )["verdicts"]
    suite = json.loads((run / "04_eval_suite.json").read_text())
    questions = {c["id"]: c["question"] for c in suite["cases"]}

    rng = random.Random(13)
    passed = [v for v in verdicts if v["passed"]]
    failed = [v for v in verdicts if not v["passed"]]
    half = max(1, sample // 2)
    picked = rng.sample(passed, min(half, len(passed))) + \
             rng.sample(failed, min(sample - half, len(failed)))

    template = {
        "_README": (
            "Set `human` to true if the agent's answer is genuinely acceptable, "
            "false otherwise. Then: forgeai calibrate --run <run> --gold <this file>"
        ),
        "labels": {
            v["case_id"]: {
                "question": questions.get(v["case_id"], ""),
                "answer": v["answer"][:400],
                "judge": v["passed"],
                "judge_notes": v["notes"],
                "human": v["passed"],
            }
            for v in picked
        },
    }

    out = out or Path("gold") / f"{run.name}_iter{iteration}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(template, indent=2))
    console.print(f"wrote {len(picked)} cases to [bold]{out}[/bold] "
                  f"({len(passed)} passes / {len(failed)} fails available)")
    console.print("Edit the `human` fields, then run `forgeai calibrate`.")


@app.command()
def calibrate(
    run: Path = typer.Option(..., help="Run directory holding judged verdicts."),
    gold: Path = typer.Option(..., help='JSON: {"case_id": true|false, ...} hand labels.'),
    iteration: int = typer.Option(0, help="Which iteration's verdicts to check."),
) -> None:
    """Measure judge-vs-human agreement. A judge nobody has checked is not evidence."""
    raw = json.loads(gold.read_text())
    # Accept either a flat {case_id: bool} mapping or the richer template that
    # `forgeai gold` emits.
    labels: dict[str, bool] = (
        {k: bool(v["human"]) for k, v in raw["labels"].items()}
        if isinstance(raw.get("labels"), dict)
        else {k: bool(v) for k, v in raw.items() if not k.startswith("_")}
    )
    verdicts = json.loads((run / "05_iterations" / f"iter_{iteration}" / "verdicts.json").read_text())
    by_id = {v["case_id"]: v["passed"] for v in verdicts["verdicts"]}

    pairs = [(by_id[k], v) for k, v in labels.items() if k in by_id]
    if not pairs:
        console.print("[red]no overlap between gold labels and verdicts[/red]")
        raise typer.Exit(1)

    n = len(pairs)
    agree = sum(a == b for a, b in pairs)
    po = agree / n
    pj = sum(a for a, _ in pairs) / n
    ph = sum(b for _, b in pairs) / n
    pe = pj * ph + (1 - pj) * (1 - ph)
    kappa = (po - pe) / (1 - pe) if pe < 1 else 1.0

    cal = JudgeCalibration(
        n_cases=n, agreements=agree, agreement_rate=round(po, 3),
        cohens_kappa=round(kappa, 3),
        disagreements=[
            {"case_id": k, "judge": by_id[k], "human": v}
            for k, v in labels.items() if k in by_id and by_id[k] != v
        ],
    )

    report_path = run / "06_report.json"
    if report_path.exists():
        report = RunReport.model_validate_json(report_path.read_text())
        report.calibration = cal
        report_path.write_text(report.model_dump_json(indent=2))
        final = run / "03_agent_def.final.json"
        if final.exists():
            from .stages.reporter import render
            (run / "06_report.md").write_text(
                render(report, AgentDefinition.model_validate_json(final.read_text())))

    console.print(f"agreement [bold]{po:.0%}[/bold] ({agree}/{n})   kappa {kappa:.2f}")
    for d in cal.disagreements:
        console.print(f"  [yellow]{d['case_id']}[/yellow]: judge={d['judge']} human={d['human']}")


if __name__ == "__main__":
    app()
