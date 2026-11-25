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
