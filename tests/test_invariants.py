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
from forgeai.stages import calibration, critic, evalgen, judge, optimizer
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
    # The question must pass the pre-filter so planning actually runs; the point
    # of the test is the refusal, not the gate.
    text, calls = a._run_tool("what is the total of 2 and 2", "ctx")
    assert text == ""
    assert calls and "refused" in calls[0]["status"]


def test_prefilter_skips_planning_when_no_tool_could_apply():
    """A policy lookup with only a calculator attached should never cost a
    planning call."""
    from forgeai.runtime import agent as agent_mod

    d = AgentDefinition(name="x", system_prompt="p",
                        tools=[ToolBinding(name="calculator", reason="r",
                                           triggering_requirement="totals")])
    a = agent_mod.Agent(d, ChunkIndex([]), client=None)
    # client=None would raise if a model call were attempted.
    text, calls = a._run_tool("What is the grievance appeal procedure?", "ctx")
    assert text == "" and calls == []


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


# ── response cache staleness ──────────────────────────────────────────────
def test_cache_is_discarded_when_the_agent_changes(tmp_path):
    """Answers cached by one agent must not be reused by a different one.

    Without this, answers from a runtime that could not call tools were reused
    by one that could, so runs shipped with tools attached and zero tool calls
    recorded - and nothing in the artifacts explained the contradiction.
    """
    import json

    from forgeai import pipeline
    from forgeai.models.evals import EvalSuite
    from forgeai.runtime.agent import AgentResponse

    cases = [EvalCase(id=f"c{i}", question=f"q{i}", kind="answerable",
                      expected_facts=["f"]) for i in range(3)]
    suite = EvalSuite(cases=cases, generated_by="stub")

    class Stub:
        def __init__(self, d):
            self.definition = d
            self.calls = 0

        def answer(self, q):
            self.calls += 1
            return AgentResponse(answer="a", refused=False, confidence=1.0, retrieved=[])

    cache = tmp_path / "responses.json"
    plain = AgentDefinition(name="x", system_prompt="p")

    first = Stub(plain)
    pipeline.run_eval(first, suite, None, cache, log=lambda *a: None)
    assert first.calls == 3

    same = Stub(plain)
    pipeline.run_eval(same, suite, None, cache, log=lambda *a: None)
    assert same.calls == 0, "an unchanged agent should reuse every cached answer"

    with_tools = Stub(AgentDefinition(
        name="x", system_prompt="p",
        tools=[ToolBinding(name="calculator", reason="r", triggering_requirement="t")]))
    pipeline.run_eval(with_tools, suite, None, cache, log=lambda *a: None)
    assert with_tools.calls == 3, "a changed agent must re-answer, not inherit"

    stored = json.loads(cache.read_text())
    assert "_signature" in stored and stored["_signature"]["tools"] == ["calculator"]


# ── F8: the runner loads ANY produced definition ──────────────────────────
def test_every_committed_definition_loads():
    """F8 is "loads any produced definition", so it is checked against every
    run in the repository rather than one.

    This caught a real break: the web export omitted `ordinal`, which Chunk
    requires, so `forgeai chat` crashed on load for every run.
    """
    from pathlib import Path

    from forgeai.runtime.runner import load_index

    runs = Path(__file__).resolve().parents[1] / "runs"
    checked = 0
    for run in sorted(runs.glob("*")):
        definition = run / "03_agent_def.final.json"
        chunks = run / "web" / "chunks.json"
        if not (definition.exists() and chunks.exists()):
            continue
        d = AgentDefinition.model_validate_json(definition.read_text())
        index = load_index(chunks)
        assert d.system_prompt, f"{run.name}: definition has no system prompt"
        assert index.chunks, f"{run.name}: web export has no chunks"
        checked += 1

    if checked == 0:
        pytest.skip("no committed runs with a final definition yet")


def test_loader_tolerates_an_export_without_ordinal(tmp_path):
    """Older exports predate the ordinal field and must still open."""
    import json

    from forgeai.runtime.runner import load_index

    p = tmp_path / "chunks.json"
    p.write_text(json.dumps({"dim": 2, "chunks": [
        {"chunk_id": "c0", "doc_id": "d0", "filename": "f.md",
         "text": "some text", "vector": [0.1, 0.2]},
    ]}))
    index = load_index(p)
    assert index.chunks[0].ordinal == 0


# --- calibration cannot rest on labels for answers that changed -------------
# The bug this guards: calibrate joins gold labels to verdicts on case_id, so
# re-answering a suite with a different agent model leaves every label still
# matching by id while describing text no human ever read. That produces a
# confident kappa over pairs nobody labelled.

def test_label_for_a_changed_answer_is_stale() -> None:
    gold = {"ans_1": {"answer": "Shore staff accrue 22 days per year.", "human": True}}
    assert calibration.stale_labels(
        gold, {"ans_1": "Shore staff accrue 25 days per year."}) == ["ans_1"]


def test_label_survives_truncation_and_whitespace_drift() -> None:
    # The template stores answers cut to 400 raw chars, often mid-word, and
    # whitespace is not stable between runs. Neither is a real change.
    full = "Shore staff accrue 22 days of annual leave per calendar year, " \
           "pro-rated for joiners."
    gold = {"ans_1": {"answer": "Shore staff accrue 22 days of annual lea"}}
    spaced = full.replace(" ", "\n  ")
    assert calibration.stale_labels(gold, {"ans_1": spaced}) == []


def test_label_without_a_recorded_answer_is_trusted() -> None:
    # Flat {case_id: bool} gold files predate the template; they carry no answer
    # to check and must not be thrown away.
    assert calibration.stale_labels({"ans_1": True}, {"ans_1": "anything"}) == []
    assert calibration.stale_labels(
        {"ans_1": {"human": True}}, {"ans_1": "anything"}) == []


def test_label_for_a_case_absent_from_this_run_is_not_stale() -> None:
    # Not scored here is not the same as scored against different text; the
    # caller's own overlap check owns that case.
    assert calibration.stale_labels(
        {"ans_9": {"answer": "x"}}, {"ans_1": "y"}) == []
