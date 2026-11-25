"""Check this repository against the assignment, from the artifacts outward.

Nothing here trusts a claim in the README: every check reads a committed file,
counts what is in it, or imports the code and inspects it. A requirement with
no evidence on disk fails, and partial evidence says so rather than rounding up.

    python scripts/audit.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "runs"
sys.path.insert(0, str(ROOT))

PASS, PART, FAIL = "PASS", "PARTIAL", "FAIL"
results: list[tuple[str, str, str, str]] = []


def record(rid: str, name: str, status: str, evidence: str) -> None:
    results.append((rid, name, status, evidence))


def real_runs() -> list[Path]:
    """Runs the factory actually produced; the fixture is scaffolding."""
    return [
        d for d in sorted(RUNS.glob("*"))
        if d.is_dir() and not d.name.startswith("_")
    ]


def load(path: Path):
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def scored(run: Path) -> dict | None:
    rep = load(run / "06_report.json")
    return rep if rep and rep.get("evaluated", True) else None


runs = real_runs()

# ── F1 intake ─────────────────────────────────────────────────────────────
ok, notes = [], []
for r in runs:
    req = load(r / "01_requirements.json")
    if not req:
        notes.append(f"{r.name}: no requirements doc")
        continue
    fields = all(req.get(k) for k in ("scope", "audience", "tone"))
    topics = bool(req.get("must_answer")) and bool(req.get("must_refuse"))
    nq = len(req.get("questions_asked", []))
    ok.append(fields and topics and nq <= 5)
    notes.append(f"{r.name}: {len(req['must_answer'])} answer / "
                 f"{len(req['must_refuse'])} refuse, {nq} questions, "
                 f"{len(req.get('assumptions', []))} assumptions, {req.get('mode')}")
record("F1", "Intake interviewer", PASS if ok and all(ok) else FAIL if not ok else PART,
       "; ".join(notes))

# ── F2 groundability ──────────────────────────────────────────────────────
ok, notes = [], []
for r in runs:
    g = load(r / "02_groundability.json")
    if not g:
        notes.append(f"{r.name}: missing")
        continue
    graded = [t for t in g["topics"] if t.get("verdict")]
    ok.append(bool(graded))
    notes.append(f"{r.name}: {len(graded)} topics scored, "
                 f"{len(g.get('moved_to_refuse', []))} demoted")
record("F2", "Groundability guard", PASS if ok and all(ok) else FAIL, "; ".join(notes))

# ── F3 generator ──────────────────────────────────────────────────────────
ok, notes = [], []
for r in runs:
    d = load(r / "03_agent_def.final.json") or load(r / "03_agent_def.v0.json")
    if not d:
        notes.append(f"{r.name}: missing")
        continue
    has = all(d.get(k) for k in ("system_prompt", "retrieval", "output_contract"))
    audited = "tools_rejected" in (d.get("provenance") or {})
    unjustified = [t for t in d.get("tools", []) if not t.get("triggering_requirement")]
    ok.append(has and audited and not unjustified)
    notes.append(f"{r.name}: {len(d.get('tools', []))} tools, "
                 f"{len(d['provenance'].get('tools_rejected', []))} rejected")
record("F3", "Agent generator + tool audit",
       PASS if ok and all(ok) else FAIL, "; ".join(notes))

# ── F4 eval generator ─────────────────────────────────────────────────────
ok, notes = [], []
for r in runs:
    s = load(r / "04_eval_suite.json")
    if not s:
        notes.append(f"{r.name}: missing")
        continue
    kinds = {c["kind"] for c in s["cases"]}
    grounded = all(c.get("expected_facts") and c.get("source_documents")
                   for c in s["cases"] if c["kind"] == "answerable")
    enough = len(s["cases"]) >= 20
    prompts = len(s.get("generation_prompts", [])) >= 3
    ok.append(enough and prompts and grounded and
              {"answerable", "out_of_scope", "edge"} <= kinds)
    notes.append(f"{r.name}: {len(s['cases'])} cases, kinds={len(kinds)}, "
                 f"{len(s.get('generation_prompts', []))} prompts committed")
record("F4", "Eval generator (>=20, 3 kinds, prompts committed)",
       PASS if ok and all(ok) else FAIL, "; ".join(notes))

# ── F5 judge ──────────────────────────────────────────────────────────────
from forgeai.config import settings  # noqa: E402

defenses = {
    "different family from agent": settings.judge_model != settings.agent_model,
    "no pairwise comparison": "position" not in (ROOT / "forgeai/stages/judge.py").read_text().lower()
    or "no pairwise" in (ROOT / "forgeai/stages/judge.py").read_text().lower(),
    "length recorded not scored": "answer_length" in (ROOT / "forgeai/models/evals.py").read_text(),
}
esc = []
for r in runs:
    rep = scored(r)
    if rep and rep["scorecards"]:
        esc.append(f"{r.name}: escalation {rep['scorecards'][-1]['llm_escalation_rate']:.0%}")
record("F5", "Judge + bias defenses",
       PASS if all(defenses.values()) and esc else PART if esc else FAIL,
       f"{settings.agent_model} judged by {settings.judge_model}; " + "; ".join(esc))

# ── F6 critic -> optimizer ────────────────────────────────────────────────
ok, notes = [], []
for r in runs:
    rep = scored(r)
    if not rep:
        notes.append(f"{r.name}: not scored")
        ok.append(False)
        continue
    its = rep["iterations"]
    logged = all(i.get("fix") and "before" in i["fix"]["diff"] for i in its)
    capped = len(its) <= 3
    reverts = sum(1 for i in its if not i["kept"])
    ok.append(logged and capped)
    notes.append(f"{r.name}: {len(its)} iterations, {reverts} reverted, "
                 f"{len(rep['scorecards'])} scorecards")
record("F6", "Critic -> optimizer loop",
       PASS if ok and all(ok) else PART if any(ok) else FAIL, "; ".join(notes))

# ── F7 honest reporting ───────────────────────────────────────────────────
ok, notes = [], []
for r in runs:
    md = r / "06_report.md"
    rep = scored(r)
    if not md.exists() or not rep:
        notes.append(f"{r.name}: incomplete")
        ok.append(False)
        continue
    text = md.read_text()
    names_failures = "What still fails" in text
    calibrated = bool(rep.get("calibration"))
    ok.append(names_failures)
    notes.append(f"{r.name}: {len(rep['residual_failures'])} residual named, "
                 f"{'calibrated' if calibrated else 'NOT calibrated'}")
record("F7", "Honest reporting",
       PASS if ok and all(ok) else PART if any(ok) else FAIL, "; ".join(notes))

# ── F3b tools are actually exercised ──────────────────────────────────────
# A definition that attaches tools which never fire is decoration, and the
# committed evidence looks identical either way. This check exists because
# exactly that slipped through: HR shipped with calculator and current_date
# attached and zero tool calls across 28 cases.
ok, notes = [], []
for r in runs:
    d = load(r / "03_agent_def.final.json") or {}
    attached = [t["name"] for t in d.get("tools", [])]
    if not attached:
        notes.append(f"{r.name}: no tools attached")
        ok.append(True)  # restraint is a valid outcome
        continue
    fired = set()
    for it in sorted((r / "05_iterations").glob("iter_*/verdicts.json")):
        for v in (load(it) or {}).get("verdicts", []):
            for tc in v.get("tool_calls", []) or []:
                fired.add(tc.get("tool"))
    unused = [t for t in attached if t not in fired]
    ok.append(not unused)
    notes.append(f"{r.name}: attached {attached}, fired {sorted(fired) or 'none'}"
                 + (f", UNUSED {unused}" if unused else ""))
record("F3b", "Attached tools actually fire",
       PASS if ok and all(ok) else PART, "; ".join(notes))

# ── F8 runnable product ───────────────────────────────────────────────────
runner = (ROOT / "forgeai/runtime/runner.py").exists()
web_chat = (ROOT / "app/chat/[id]/page.tsx").exists()
loadable = [r.name for r in runs if (r / "03_agent_def.final.json").exists()
            and (r / "web" / "chunks.json").exists()]
record("F8", "Runnable product",
       PASS if runner and loadable else PART,
       f"CLI runner={runner}, web chat={web_chat}, loadable definitions: {loadable}")

# ── F9 two demonstrations ─────────────────────────────────────────────────
complete = [r.name for r in runs if scored(r)]
record("F9", "Two full demonstrations",
       PASS if len(complete) >= 2 else PART if complete else FAIL,
       f"{len(runs)} runs present, scored: {complete or 'none'}")

# ── assets ────────────────────────────────────────────────────────────────
from forgeai.runtime.tools.registry import REGISTRY  # noqa: E402

synth = (ROOT / "demos/SYNTHESIS_PROMPTS.md").exists()
corpora = sorted(p.name for p in (ROOT / "demos").glob("*/docs"))
record("A1", "Tool registry (3-4 tools)",
       PASS if 3 <= len(REGISTRY) <= 5 else FAIL, f"{len(REGISTRY)}: {', '.join(REGISTRY)}")
record("A2", "Two dissimilar corpora + synthesis prompts",
       PASS if len(corpora) >= 2 and synth else FAIL,
       f"{len(corpora)} corpora, synthesis prompts committed={synth}")

# ── stretch ───────────────────────────────────────────────────────────────
stretch = {
    "Budget enforcement": (ROOT / "forgeai/models/iteration.py").read_text().count("class Budget") > 0,
    "UI + hosting": (ROOT / "app/page.tsx").exists(),
    "Human checkpoint": "--interactive" in (ROOT / "forgeai/cli.py").read_text()
    or "interactive" in (ROOT / "forgeai/cli.py").read_text(),
    "Prompt tournament": (ROOT / "forgeai/stages/tournament.py").exists()
    and "tournament: bool" in (ROOT / "forgeai/cli.py").read_text(),
    "Regression mode": (ROOT / "forgeai/stages/regression.py").exists()
    and "def regress(" in (ROOT / "forgeai/cli.py").read_text(),
    "Factory vs human baseline": (ROOT / "demos/baseline/BASELINE.md").exists()
    and (ROOT / "scripts/baseline.py").exists(),
}

# ── output ────────────────────────────────────────────────────────────────
width = max(len(n) for _, n, _, _ in results) + 2
print("\n  ForgeAI — assignment audit\n")
print(f"  {'id':4} {'requirement':{width}} {'status':8} evidence")
print(f"  {'-' * 4} {'-' * width} {'-' * 8} {'-' * 40}")
for rid, name, status, ev in results:
    print(f"  {rid:4} {name:{width}} {status:8} {ev[:90]}")

print("\n  stretch goals")
for k, v in stretch.items():
    print(f"    {'done' if v else '--  '}  {k}")

core = [s for _, _, s, _ in results]
print(f"\n  core: {core.count(PASS)} pass, {core.count(PART)} partial, {core.count(FAIL)} fail")
print(f"  stretch: {sum(stretch.values())}/{len(stretch)}\n")
sys.exit(1 if FAIL in core else 0)
