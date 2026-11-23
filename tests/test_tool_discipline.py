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
