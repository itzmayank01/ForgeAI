"""The brief: "an HR agent with a weather tool is a factory defect".

Asserted, not hoped for. Runs against whatever definitions the demos produced.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

RUNS = Path(__file__).resolve().parents[1] / "runs"
EXPECTED_ABSENT = {
    "hr_policy": {"weather", "csv_lookup"},
    "ship_spares": {"weather"},
}


def _final_defs():
    for run in sorted(RUNS.glob("*/03_agent_def.final.json")):
        yield run.parent.name, json.loads(run.read_text())


@pytest.mark.parametrize("prefix,forbidden", EXPECTED_ABSENT.items())
def test_no_irrelevant_tools(prefix, forbidden):
    found = [(n, d) for n, d in _final_defs() if n.startswith(prefix)]
    if not found:
        pytest.skip(f"no committed run for {prefix} yet")
    for name, definition in found:
        attached = {t["name"] for t in definition.get("tools", [])}
        assert attached.isdisjoint(forbidden), (
            f"{name} attached {attached & forbidden}; factory defect"
        )


def test_every_tool_cites_a_requirement():
    for name, definition in _final_defs():
        for tool in definition.get("tools", []):
            assert tool.get("triggering_requirement"), (
                f"{name}: tool {tool['name']} attached with no triggering requirement"
            )


# --- a tool call's provenance record must survive json.dumps ----------------
# The answer cache flushes after every answer, so an unserializable value in a
# tool record does not fail one case - it kills the pass and loses every answer
# banked so far. `_root` is a Path the agent injects into csv_lookup; recording
# it alongside the model's own arguments crashed ship_spares at 9/29. Latent
# until tool calls actually started firing.

def test_tool_record_is_json_serializable(tmp_path, monkeypatch):
    from forgeai.models.agent_def import AgentDefinition, ToolBinding
    from forgeai.models.common import Chunk
    from forgeai.ingest.index import ChunkIndex
    from forgeai.runtime import agent as agent_mod

    csv = tmp_path / "parts.csv"
    csv.write_text("part,qty\nFIL-1210,4\n")

    definition = AgentDefinition(
        name="spares", system_prompt="Answer from context.",
        tools=[ToolBinding(name="csv_lookup", reason="tabular corpus",
                           triggering_requirement="stock levels")],
    )
    index = ChunkIndex([Chunk(chunk_id="c0", doc_id="d0", filename="parts.csv",
                              ordinal=0, text="FIL-1210 has 4 in stock.")])

    plan = agent_mod._ToolPlan(tool="csv_lookup",
                               args={"file": "parts.csv", "column": "part",
                                     "value": "FIL-1210"})
    monkeypatch.setattr(agent_mod, "structured", lambda *a, **k: (plan, None))

    a = agent_mod.Agent(definition, index, client=None, docs_dir=tmp_path)
    text, records = a._run_tool("How many FIL-1210 are in stock?", "context")

    assert records, "the tool was attached and planned, so it must be recorded"
    json.dumps(records)          # the actual regression: this used to raise
    for rec in records:
        assert "_root" not in rec.get("args", {}), (
            "injected plumbing leaked into the provenance record"
        )
    assert "FIL-1210" in text, "tool result should reach the prompt"


# --- the audit's tool verdict, including the branch real data cannot reach --
# Both committed rehearsal runs attach no tools, so the "nothing fired" branch
# is unreachable from the repository's own artifacts. It is the branch that
# matters most -- it is the bug this check was written for -- so it is asserted
# directly rather than left to chance.

from forgeai import tool_discipline as td  # noqa: E402


def test_attached_but_never_fired_is_a_failure() -> None:
    v, which = td.verdict(["calculator", "current_date"], set(),
                          {"calculator": "travel expenses"}, {"travel expenses"})
    assert v == td.DECORATION
    assert which == ["calculator", "current_date"]


def test_idle_tool_citing_no_must_answer_topic_is_unjustified() -> None:
    v, which = td.verdict(
        ["calculator", "weather"], {"calculator"},
        {"calculator": "travel expenses", "weather": "sailing conditions"},
        {"travel expenses"})
    assert v == td.UNJUSTIFIED
    assert which == ["weather"], "an HR agent with a weather tool is the brief's example"


def test_idle_but_justified_tool_is_an_eval_coverage_gap() -> None:
    # hr_policy's real shape: current_date is attached against "leave policy"
    # (leave accrues per calendar year, carry-over expires 31 March) and no
    # generated case happens to ask a date-dependent question.
    v, which = td.verdict(
        ["calculator", "current_date"], {"calculator"},
        {"calculator": "travel expenses", "current_date": "leave policy"},
        {"travel expenses", "leave policy", "grievance procedure"})
    assert v == td.COVERAGE_GAP
    assert which == ["current_date"]


def test_every_attached_tool_firing_is_clean() -> None:
    v, which = td.verdict(["calculator"], {"calculator"},
                          {"calculator": "order total calculation"},
                          {"order total calculation"})
    assert v == td.CLEAN and which == []


def test_attaching_nothing_is_restraint_not_a_defect() -> None:
    assert td.verdict([], set(), {}, {"anything"})[0] == td.RESTRAINT
