"""Factory vs human baseline (stretch goal).

Scores a hand-written agent definition against the SAME committed eval suite the
factory's definition was scored on, with the same judge. The point is not to
find a winner but to locate where each is better, because "the factory beats a
human" is only interesting if you can say at what.

    python scripts/baseline.py --run runs/hr_policy_live \
        --definition demos/baseline/hand_written_hr.json
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from forgeai.ingest.chunker import chunk_corpus          # noqa: E402
from forgeai.ingest.index import ChunkIndex              # noqa: E402
from forgeai.ingest.loaders import load_folder           # noqa: E402
from forgeai.llm.client import LLMClient                 # noqa: E402
from forgeai.models.agent_def import AgentDefinition     # noqa: E402
from forgeai.models.evals import CaseVerdict, EvalSuite  # noqa: E402
from forgeai.pipeline import run_eval                    # noqa: E402
from forgeai.runtime.agent import Agent                  # noqa: E402
from forgeai.stages import judge                         # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", type=Path, required=True)
    ap.add_argument("--definition", type=Path, required=True)
    ap.add_argument("--docs", type=Path, default=Path("demos/hr_policy/docs"))
    args = ap.parse_args()

    suite = EvalSuite.model_validate_json((args.run / "04_eval_suite.json").read_text())
    factory = [
        CaseVerdict.model_validate(v) for v in
        json.loads((args.run / "05_iterations/iter_0/verdicts.json").read_text())["verdicts"]
    ]
    human_def = AgentDefinition.model_validate_json(args.definition.read_text())

    refs, texts, _ = load_folder(args.docs)
    index = ChunkIndex(chunk_corpus(refs, texts,
                                    human_def.retrieval.chunk_size,
                                    human_def.retrieval.chunk_overlap))
    client = LLMClient()

    print(f"scoring hand-written definition on {len(suite.cases)} committed cases…")
    cache = args.run / "08_baseline" / "responses.json"
    responses, complete = run_eval(Agent(human_def, index, client), suite, None, cache, print)
    if not complete:
        print("incomplete pass; re-run to finish")
        return 1
    human = judge.judge_all(suite.cases, responses, client)

    by_id = {c.id: c for c in suite.cases}
    f = {v.case_id: v.passed for v in factory}
    h = {v.case_id: v.passed for v in human}
    shared = sorted(f.keys() & h.keys())

    kinds: dict[str, list[tuple[bool, bool]]] = defaultdict(list)
    for cid in shared:
        kinds[by_id[cid].kind].append((f[cid], h[cid]))

    fr = sum(f[c] for c in shared) / len(shared)
    hr = sum(h[c] for c in shared) / len(shared)
    factory_only = [c for c in shared if f[c] and not h[c]]
    human_only = [c for c in shared if h[c] and not f[c]]

    lines = ["# Factory vs hand-written baseline\n"]
    lines.append(f"Both definitions scored on the same {len(shared)} committed cases "
                 f"from `{args.run.name}`, by the same judge.\n")
    lines.append("| | factory | hand-written |")
    lines.append("|---|---|---|")
    lines.append(f"| overall | **{fr:.0%}** | **{hr:.0%}** |")
    for kind, pairs in sorted(kinds.items()):
        a = sum(p[0] for p in pairs) / len(pairs)
        b = sum(p[1] for p in pairs) / len(pairs)
        lines.append(f"| {kind.replace('_', ' ')} ({len(pairs)}) | {a:.0%} | {b:.0%} |")
    lines.append(f"| prompt length | {len(AgentDefinition.model_validate_json((args.run / '03_agent_def.final.json').read_text()).system_prompt)} chars | {len(human_def.system_prompt)} chars |")
    lines.append("")

    lines.append(f"## Where the factory wins ({len(factory_only)})\n")
    for cid in factory_only:
        lines.append(f"- `{cid}` — {by_id[cid].question}")
    lines.append("")
    lines.append(f"## Where the hand-written one wins ({len(human_only)})\n")
    for cid in human_only:
        lines.append(f"- `{cid}` — {by_id[cid].question}")
    lines.append("")

    out = ROOT / "demos/baseline/BASELINE.md"
    out.write_text("\n".join(lines))
    print(f"\n  factory {fr:.0%} · hand-written {hr:.0%}")
    print(f"  factory-only wins: {len(factory_only)} · human-only wins: {len(human_only)}")
    print(f"  report -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
