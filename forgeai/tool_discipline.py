"""Did a run's attached tools earn their place?

The brief's test is that the factory attaches "only the tools the brief
actually needs" - an HR agent with a weather tool is a factory defect. Two
different failures hide behind a single "unused tool" observation, and they
deserve different verdicts:

  * Nothing fired at all. The tools are decoration and the committed evidence
    looks identical whether the registry was ever reachable or not. This really
    happened: 90 answers across three runs with zero tool calls, because the
    planner prompt talked itself out of every call.

  * Some tool fired, another sat idle. That is only a defect if the idle tool
    was never justified. A tool attached against a real must-answer topic can
    go unexercised simply because no generated case happens to need it, which
    is a gap in the EVALS and should be reported as one rather than blamed on
    the generator.
"""
from __future__ import annotations

DECORATION = "decoration"      # tools attached, none ever fired
UNJUSTIFIED = "unjustified"    # an idle tool that cites no must-answer topic
COVERAGE_GAP = "coverage_gap"  # idle but justified: the suite never needed it
CLEAN = "clean"
RESTRAINT = "restraint"        # no tools attached at all, which is allowed


def verdict(attached: list[str], fired: set[str],
            triggering: dict[str, str], must_answer: set[str]) -> tuple[str, list[str]]:
    """Classify a run's tool discipline.

    `triggering` maps tool name -> the must-answer topic it was attached for;
    `must_answer` is that run's topics, lowercased. Returns the verdict and the
    tools it concerns.
    """
    if not attached:
        return RESTRAINT, []
    if not fired:
        return DECORATION, sorted(attached)
    idle = [t for t in attached if t not in fired]
    if not idle:
        return CLEAN, []
    unjustified = [
        t for t in idle
        if (triggering.get(t) or "").strip().lower() not in must_answer
    ]
    if unjustified:
        return UNJUSTIFIED, sorted(unjustified)
    return COVERAGE_GAP, sorted(idle)
