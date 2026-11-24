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


@app.command()
def build(
    brief: Path = typer.Option(..., help="File containing the one-paragraph brief."),
    docs: Path = typer.Option(..., help="Folder of source documents."),
    out: Path = typer.Option(None, help="Run directory (default runs/<name>_<ts>)."),
    interactive: bool = typer.Option(False, help="Ask clarifying questions instead of self-answering."),
    max_iterations: int = typer.Option(None, help="Override the iteration cap."),
    resume: bool = typer.Option(False, help="Reuse artifacts already in the run directory."),
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
                       log=console.print)

    final = out / "03_agent_def.final.json"
    if final.exists():
        md = render(report, AgentDefinition.model_validate_json(final.read_text()))
        (out / "06_report.md").write_text(md)
        console.print(f"\n[dim]report ->[/dim] {out / '06_report.md'}")
    console.rule(f"[bold]{report.final_pass_rate:.0%} pass[/bold]  ·  {report.stop_reason}")


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
) -> None:
    """Talk to a generated agent. Loads ANY definition (F8)."""
    from .runtime.runner import chat as run_chat

    run_chat(definition or run / "03_agent_def.final.json", run / "web" / "chunks.json")


@app.command()
def calibrate(
    run: Path = typer.Option(..., help="Run directory holding judged verdicts."),
    gold: Path = typer.Option(..., help='JSON: {"case_id": true|false, ...} hand labels.'),
    iteration: int = typer.Option(0, help="Which iteration's verdicts to check."),
) -> None:
    """Measure judge-vs-human agreement. A judge nobody has checked is not evidence."""
    labels: dict[str, bool] = json.loads(gold.read_text())
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
