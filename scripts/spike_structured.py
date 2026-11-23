"""Phase 0 risk spike: can a small open model drive our schemas?

Everything downstream assumes structured() returns valid artifacts. If an 8B
model cannot hit RequirementsDoc reliably even with the repair loop, we must
learn that in hour one - not on day two - and simplify the schemas or move to
grammar-constrained decoding.

    uv run python scripts/spike_structured.py --n 10
"""
from __future__ import annotations

import argparse
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from forgeai.config import settings                      # noqa: E402
from forgeai.llm.client import LLMClient                 # noqa: E402
from forgeai.llm.structured import structured            # noqa: E402
from forgeai.models.requirements import RequirementsDoc  # noqa: E402

BRIEF = (
    "I need an assistant that answers HR policy questions for shore staff - "
    "leave entitlement, parental leave, travel reimbursement and the grievance "
    "procedure. It must never give legal advice or discuss individual salaries."
)
CORPUS = (
    "Corpus: 3 documents. leave_policy.pdf (annual leave, carry-over, parental "
    "leave), travel_expenses.pdf (per-diem rates, receipts, approval limits), "
    "grievance_procedure.md (raising, escalation, timelines)."
)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--model", default=settings.gen_model)
    args = ap.parse_args()

    client = LLMClient()
    instruction = (
        f"You are an intake interviewer for an agent factory.\n\nBRIEF:\n{BRIEF}\n\n"
        f"{CORPUS}\n\nWrite the structured requirements document. Set mode to "
        f"'unattended'. Ask at most 5 clarifying questions and record an "
        f"assumption for each. Topics need a name and a description."
    )


    print(f"spiking {args.model}: {args.n} x RequirementsDoc\n")
    oks, attempts, salvages, latencies = 0, [], 0, []

    for i in range(args.n):
        t0 = time.time()
        doc, trace = structured(
            client, instruction=instruction, model_cls=RequirementsDoc,
            model=args.model, temperature=0.2,
        )
        latencies.append(time.time() - t0)
        attempts.append(trace.attempts)
        salvages += trace.salvaged
        if doc is not None:
            oks += 1
            print(f"  {i+1:2d}. ok   attempts={trace.attempts} "
                  f"topics={len(doc.must_answer)}/{len(doc.must_refuse)} "
                  f"qs={len(doc.questions_asked)} {latencies[-1]:.1f}s")
        else:
            print(f"  {i+1:2d}. FAIL attempts={trace.attempts} :: {trace.errors[-1][:90]}")

    rate = oks / args.n
    print(f"\n  valid-parse rate : {rate:.0%}  ({oks}/{args.n})")
    print(f"  mean attempts    : {statistics.mean(attempts):.2f}")
    print(f"  salvaged (fences): {salvages}/{args.n}")
    print(f"  mean latency     : {statistics.mean(latencies):.1f}s")
    print(f"  tokens used      : {client.usage.total}")

    if rate >= 0.9:
        print("\n  VERDICT: schemas are safe for an 8B model. Proceed.")
    elif rate >= 0.7:
        print("\n  VERDICT: marginal. Flatten the deepest schema or raise max_repairs.")
    else:
        print("\n  VERDICT: too fragile. Split into per-field calls or use a larger model.")
    return 0 if rate >= 0.7 else 1


if __name__ == "__main__":
    raise SystemExit(main())
