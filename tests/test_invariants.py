"""Tests for the properties the assignment actually grades.

These are the checks that would catch the pipeline lying to itself, so they are
asserted rather than assumed. None of them touches the network.
"""
from __future__ import annotations

import pytest

from forgeai.ingest.index import ChunkIndex
from forgeai.models.agent_def import AgentDefinition, ToolBinding
from forgeai.models.common import Chunk, RetrievedChunk
from forgeai.models.evals import EvalCase
from forgeai.models.iteration import FailureDiagnosis
from forgeai.models.requirements import RequirementsDoc, Topic
from forgeai.runtime.agent import AgentResponse
from forgeai.stages import critic, evalgen, judge, optimizer
from forgeai.stages.generator import audit_tools


@pytest.fixture(scope="module")
def index() -> ChunkIndex:
    return ChunkIndex([
        Chunk(chunk_id="c0", doc_id="d0", filename="hr.md", ordinal=0,
              text="Shore staff accrue 22 days of annual leave per calendar year."),
        Chunk(chunk_id="c1", doc_id="d0", filename="hr.md", ordinal=1,
              text="Travel per-diem is 65 EUR domestic and 95 EUR international."),
    ])


def _retrieved() -> list[RetrievedChunk]:
    return [RetrievedChunk(chunk_id="c0", doc_id="d0", filename="hr.md", score=0.9,
                           text="Shore staff accrue 22 days of annual leave per calendar year.")]


# ── eval gate ─────────────────────────────────────────────────────────────
def test_gate_drops_secretly_answerable_out_of_scope(index):
    """The decisive check: an out-of-scope question the corpus CAN answer would
    score a correct answer as a failure, teaching the optimizer to refuse
    everything."""
    cases = [EvalCase(id="o1", kind="out_of_scope", should_refuse=True,
                      question="How many days of annual leave do shore staff accrue?")]
    kept, report = evalgen.quality_gate(cases, index)
    assert kept == []
    assert report["oos_is_answerable"] == 1


def test_gate_drops_fact_not_in_cited_source(index):
    cases = [EvalCase(id="a1", kind="answerable", source_chunks=["c0"],
                      question="What is the parental leave entitlement?",
                      expected_facts=["Parental leave is 16 weeks fully paid"])]
    kept, report = evalgen.quality_gate(cases, index)
    assert kept == []
    assert report["fact_not_in_source"] == 1


def test_gate_keeps_a_sound_case(index):
    cases = [EvalCase(id="a1", kind="answerable", source_chunks=["c0"],
                      question="How much annual leave do shore staff get each year?",
                      expected_facts=["Shore staff accrue 22 days of annual leave"])]
    kept, _ = evalgen.quality_gate(cases, index)
    assert [c.id for c in kept] == ["a1"]


# ── judge ─────────────────────────────────────────────────────────────────
def test_wrong_number_fails_even_when_phrasing_matches():
    case = EvalCase(id="a1", kind="answerable", question="q",
                    expected_facts=["22 days of annual leave"], source_chunks=["c0"])
    v = judge.judge_case(
        case,
        AgentResponse(answer="Shore staff get 20 days of annual leave per year.",
                      citations=["c0"], retrieved=_retrieved()),
        client=None,  # must never need a model for this
    )
    assert not v.passed and v.fact_recall == 0.0


def test_fabricated_citation_fails():
    case = EvalCase(id="a1", kind="answerable", question="q",
                    expected_facts=["22 days of annual leave"], source_chunks=["c0"])
    v = judge.judge_case(
        case,
        AgentResponse(answer="Shore staff get 22 days of annual leave per year.",
                      citations=["c99"], retrieved=_retrieved()),
        client=None,
    )
    assert not v.passed and not v.citations_valid


def test_refusing_an_answerable_question_fails():
    case = EvalCase(id="a1", kind="answerable", question="q",
                    expected_facts=["22 days"], source_chunks=["c0"])
    v = judge.judge_case(case, AgentResponse(answer="I can't help", refused=True,
                                             retrieved=_retrieved()), client=None)
    assert not v.passed and "refused an answerable question" in v.notes


def test_verbosity_cannot_inflate_a_score():
    """Length is recorded but must never enter the verdict."""
    case = EvalCase(id="a1", kind="answerable", question="q",
                    expected_facts=["22 days of annual leave"], source_chunks=["c0"])
    short = judge.judge_case(case, AgentResponse(
        answer="Shore staff get 22 days of annual leave.",
        citations=["c0"], retrieved=_retrieved()), client=None)
    padded = judge.judge_case(case, AgentResponse(
        answer="Shore staff get 22 days of annual leave. " + "Padding. " * 40,
        citations=["c0"], retrieved=_retrieved()), client=None)
    assert short.passed == padded.passed
    assert padded.answer_length > short.answer_length


# ── critic ────────────────────────────────────────────────────────────────
def test_retrieval_miss_is_classified_without_a_model():
    """A NUMERIC expected fact resolves in tier 1, so no model is consulted.

    A non-numeric fact that neither matches literally nor by embedding does
    escalate, and should: that is the ambiguous residue the model exists for.
    This asserts the deterministic path specifically.
    """
    case = EvalCase(id="a1", kind="answerable", question="q",
                    expected_facts=["99 days of special leave"], source_chunks=["c7"])
    v = judge.judge_case(case, AgentResponse(answer="Shore staff get 22 days.",
                                             citations=[], retrieved=_retrieved()),
                         client=None)
    assert v.judge_path == "deterministic"
    d = critic.classify(case, v)
    assert d.category == "retrieval_miss" and d.classified_by == "deterministic"


def test_answering_an_out_of_scope_question_is_a_prompt_defect():
    case = EvalCase(id="o1", kind="out_of_scope", question="q", should_refuse=True)
    v = judge.judge_case(case, AgentResponse(answer="Sure, 22 days",
                                             retrieved=_retrieved()), client=None)
    assert critic.classify(case, v).category == "prompt_defect"


# ── optimizer ─────────────────────────────────────────────────────────────
def test_fix_ladder_never_repeats_a_rung():
    ds = [FailureDiagnosis(case_id="a1", category="retrieval_miss", evidence="e")]
    used: set[tuple[str, str]] = set()
    picks = []
    while (p := optimizer.choose(ds, used)) is not None:
        used.add(p)
        picks.append(p)
    assert len(picks) == len(set(picks))


def test_each_fix_changes_the_definition():
    ds = [FailureDiagnosis(case_id="a1", category="retrieval_miss", evidence="e")]
    d = AgentDefinition(name="x", system_prompt="p")
    new, fix = optimizer.apply_fix(d, "retrieval_miss", "raise_top_k", ds, None,
                                   log=lambda *a: None)
    assert new.retrieval.top_k > d.retrieval.top_k
    assert fix.diff["before"] != fix.diff["after"]
    assert new.version == d.version + 1


# ── tool discipline ───────────────────────────────────────────────────────
@pytest.mark.parametrize("binding,survives", [
    (ToolBinding(name="calculator", reason="per-diem totals",
                 triggering_requirement="travel reimbursement"), True),
    (ToolBinding(name="weather", reason="might help",
                 triggering_requirement="general helpfulness"), False),
    (ToolBinding(name="teleporter", reason="invented",
                 triggering_requirement="travel reimbursement"), False),
    (ToolBinding(name="csv_lookup", reason="no justification",
                 triggering_requirement=""), False),
])
def test_tool_audit(binding, survives):
    req = RequirementsDoc(
        brief="b", scope="s", audience="a", tone="t", must_refuse=[],
        must_answer=[Topic(name="travel reimbursement", description="d")])
    kept, _ = audit_tools([binding], req)
    assert bool(kept) is survives


# ── tool execution ────────────────────────────────────────────────────────
def test_agent_refuses_a_tool_its_definition_does_not_attach(monkeypatch):
    """The definition is the contract. A tool it does not attach is unreachable
    however convincingly the model asks for it."""
    from forgeai.runtime import agent as agent_mod

    d = AgentDefinition(name="x", system_prompt="p",
                        tools=[ToolBinding(name="calculator", reason="r",
                                           triggering_requirement="totals")])
    a = agent_mod.Agent(d, ChunkIndex([]), client=None)

    monkeypatch.setattr(
        agent_mod, "structured",
        lambda *args, **kw: (agent_mod._ToolPlan(tool="weather",
                                                 args={"latitude": "1", "longitude": "2"}), None))
    text, calls = a._run_tool("what is the weather", "ctx")
    assert text == ""
    assert calls and "refused" in calls[0]["status"]


def test_agent_executes_an_attached_tool(monkeypatch):
    from forgeai.runtime import agent as agent_mod

    d = AgentDefinition(name="x", system_prompt="p",
                        tools=[ToolBinding(name="calculator", reason="r",
                                           triggering_requirement="totals")])
    a = agent_mod.Agent(d, ChunkIndex([]), client=None)

    monkeypatch.setattr(
        agent_mod, "structured",
        lambda *args, **kw: (agent_mod._ToolPlan(tool="calculator",
                                                 args={"expression": "6*7"}), None))
    text, calls = a._run_tool("what is six times seven", "ctx")
    assert "42" in text and calls[0]["tool"] == "calculator"


def test_no_tools_means_no_tool_call(monkeypatch):
    from forgeai.runtime import agent as agent_mod

    a = agent_mod.Agent(AgentDefinition(name="x", system_prompt="p"),
                        ChunkIndex([]), client=None)
    text, calls = a._run_tool("anything", "ctx")
    assert text == "" and calls == []


def test_calculator_rejects_code_injection():
    from forgeai.runtime.tools.registry import calculator

    assert calculator("2+2") == "4"
    assert "error" in calculator("__import__('os').system('echo pwned')")
