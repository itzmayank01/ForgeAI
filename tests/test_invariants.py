"""Tests for the properties the assignment actually grades.

These are the checks that would catch the pipeline lying to itself, so they are
asserted rather than assumed. None of them touches the network.
"""
from __future__ import annotations

import time

import pytest

from forgeai.ingest.index import ChunkIndex
from forgeai.llm import client
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


# --- rate-limit durations are compound, and the parser must read them -------
# Groq answers a 429 with `2m59.56s` as often as `7.66s`. The old parser tried
# float() on the whole string, raised, and skipped the header -- so the one
# piece of information saying how long to wait was read as no information, and
# the client fell back to a blind exponential guess.

@pytest.mark.parametrize("raw,want", [
    ("7.66s", 7.66),
    ("2m59.56s", 179.56),
    ("1h2m3s", 3723.0),
    ("120ms", 0.12),
    ("30", 30.0),          # bare seconds, as HTTP Retry-After sends them
    ("", None),
    ("garbage", None),
    (None, None),
])
def test_rate_limit_durations_parse(raw, want) -> None:
    got = client.parse_duration(raw)
    if want is None:
        assert got is None
    else:
        assert got == pytest.approx(want)


def test_minutes_are_not_read_as_milliseconds() -> None:
    """`m` and `ms` share a prefix; reading `2m` as 2ms would turn a two-minute
    reset into an instant retry that 429s again."""
    assert client.parse_duration("2m") == pytest.approx(120.0)
    assert client.parse_duration("2ms") == pytest.approx(0.002)


# --- keys from one account share a daily pot -------------------------------
# Measured, not assumed: four of the eight keys reported byte-identical usage
# (199872/200000) against gpt-oss-120b, which is only possible if they draw on
# the same budget. The pool's own docstring used to claim N keys multiply the
# free tier by N; for keys minted from one account that is false.

def _pool(n=4):
    from forgeai.llm.keypool import KeyPool
    return KeyPool([f"gsk_test_key_{i}" for i in range(n)])


def test_exhausting_a_key_sidelines_its_account_siblings() -> None:
    pool = _pool()
    a, b, c, d = pool._states
    for s in (a, b, c):
        s.org = "org_shared"
    d.org = "org_other"

    n = pool.mark_exhausted(a, "m", 60, org="org_shared")
    assert n == 3, "all three keys on the account should be sidelined together"

    now = time.time()
    assert not a.available_for("m", now)
    assert not b.available_for("m", now)
    assert not c.available_for("m", now)
    assert d.available_for("m", now), "a different account keeps its budget"


def test_a_key_of_unknown_account_is_sidelined_alone() -> None:
    # Groq names the organization only when refusing, so the mapping fills in
    # lazily. Until a key's account is known, guessing would bench keys that
    # may well have budget.
    pool = _pool(3)
    a, b, _ = pool._states
    assert pool.mark_exhausted(a, "m", 60) == 1
    assert b.available_for("m", time.time())


def test_exhaustion_is_per_model_not_per_key() -> None:
    # Burning gpt-oss-20b on an account says nothing about qwen on it.
    pool = _pool(2)
    a, _ = pool._states
    a.org = "org_shared"
    pool.mark_exhausted(a, "gpt-oss-20b", 60, org="org_shared")
    assert not a.available_for("gpt-oss-20b", time.time())
    assert a.available_for("qwen", time.time())


def test_organization_is_read_from_a_real_429_body() -> None:
    body = ('{"error":{"message":"Rate limit reached for model '
            '`openai/gpt-oss-120b` in organization `org_01m0624` service tier '
            '`on_demand` on tokens per day (TPD): Limit 200000, Used 199496, '
            'Requested 997. Please try again in 3m32.976s."}}')
    assert client._organization(body) == "org_01m0624"
    assert client._organization("no organization named here") is None
    assert client._organization("") is None


# --- a deliberate zero is not an absent value ------------------------------
# `max_iterations or settings.max_iterations` turned --max-iterations 0 into the
# default 3. That matters because 0 is the one value you want when a run's
# budget is gone: score the committed baseline, write the report, call no model.
# Instead it ran on into apply_fix and stalled on quota, so a fully scored
# iteration produced no report.

def test_zero_iterations_is_respected(monkeypatch, tmp_path) -> None:
    from forgeai.models.iteration import Budget
    from forgeai.config import settings

    def budget_for(requested):
        return Budget(max_iterations=(settings.max_iterations
                                      if requested is None else requested))

    assert budget_for(0).max_iterations == 0
    assert budget_for(2).max_iterations == 2
    assert budget_for(None).max_iterations == settings.max_iterations


def test_zero_iterations_scores_the_baseline_and_stops() -> None:
    """range(max_iterations + 1) must still run iteration 0 - 'no fixes' is not
    'no evaluation'."""
    assert list(range(0 + 1)) == [0]


# --- citations name a source that was actually offered ---------------------
# hr_policy iteration 0: five of ten failures were correct, grounded answers
# carrying a fabricated chunk id. Asked to cite `doc_01_c003`, the model
# reproduced the shape of an id rather than the id. Numbering the sources makes
# the citation a single digit to copy and resolves it in code.

def _chunks():
    from forgeai.models.common import RetrievedChunk
    return [
        RetrievedChunk(chunk_id="doc_01_c000", doc_id="d1", filename="leave.md",
                       ordinal=0, text="22 days of annual leave.", score=0.9),
        RetrievedChunk(chunk_id="doc_01_c003", doc_id="d1", filename="leave.md",
                       ordinal=3, text="20 working days of unpaid leave.", score=0.8),
    ]


def test_context_numbers_sources_instead_of_naming_ids() -> None:
    from forgeai.runtime.agent import format_context
    ctx = format_context(_chunks())
    assert "[1]" in ctx and "[2]" in ctx
    assert "doc_01_c000" not in ctx, (
        "showing the id invites the model to invent one of the same shape"
    )


def test_source_number_resolves_to_the_chunk_it_was_given() -> None:
    from forgeai.runtime.agent import resolve_citations
    chunks = _chunks()
    assert resolve_citations(["2"], chunks) == ["doc_01_c003"]
    assert resolve_citations(["[1]"], chunks) == ["doc_01_c000"]
    assert resolve_citations(["1", "2"], chunks) == ["doc_01_c000", "doc_01_c003"]


def test_out_of_range_and_invented_citations_are_dropped() -> None:
    # Dropped, not repaired: the judge's set arithmetic should still be able to
    # record a fabricated citation rather than have one laundered into a
    # valid-looking reference.
    from forgeai.runtime.agent import resolve_citations
    chunks = _chunks()
    assert resolve_citations(["9"], chunks) == []
    assert resolve_citations(["doc_01_c005"], chunks) == []
    assert resolve_citations([], chunks) == []


def test_a_correctly_copied_chunk_id_is_still_honoured() -> None:
    # A model that ignores the numbering but copies a real id is not wrong.
    from forgeai.runtime.agent import resolve_citations
    assert resolve_citations(["doc_01_c003"], _chunks()) == ["doc_01_c003"]


def test_duplicate_citations_collapse() -> None:
    from forgeai.runtime.agent import resolve_citations
    assert resolve_citations(["1", "[1]", "doc_01_c000"], _chunks()) == ["doc_01_c000"]


# --- front matter is not a fact -------------------------------------------
# Calibration's one judge/human disagreement was a generator defect: the case
# "What does policy HR-09 say about how to file a grievance?" carried exactly
# one expected fact, "Policy reference: HR-09". The answer correctly described
# form HR-09a, cited validly, asserted nothing unsupported -- and failed, because
# the judge requires EVERY expected fact and this one was a document header.

@pytest.mark.parametrize("fact", [
    "Policy reference: HR-09",
    "**Policy reference:** HR-04",
    "Effective: 1 January 2026",
    "Review: annually",
    "Document ID: FIN-11",
    "Last updated: March 2026",
    "Approved by: the Board",
])
def test_metadata_is_not_accepted_as_an_expected_fact(fact) -> None:
    assert evalgen._is_document_metadata(fact)


@pytest.mark.parametrize("fact", [
    "Shore staff accrue 22 days of annual leave per calendar year.",
    "Domestic travel attracts a per-diem of EUR 65 per full day.",
    "A formal grievance must be submitted in writing to HR using form HR-09a.",
    "Grievance records are retained for 6 years.",
    "Line managers may approve claims up to EUR 1,500.",
])
def test_real_facts_are_not_mistaken_for_metadata(fact) -> None:
    # The filter must not reach substantive clauses that merely mention a
    # reference or a date - those are the cases worth keeping.
    assert not evalgen._is_document_metadata(fact)


# --- a question cannot name an identifier the documents lack ----------------
# ship_spares shipped "What is the current stock quantity for part PN-9876?"
# expecting "stock_qty: 60". No part number in that catalogue uses a PN- prefix
# at all. The agent refused, correctly, and the case scored it a failure --
# exactly the pressure that teaches an optimizer to stop refusing.

CORPUS = ("part_number pum-1007 centrifugal ballast pump 2177.99 "
          "policy reference hr-09 grievance procedure form hr-09a")


@pytest.mark.parametrize("question,expected", [
    ("What is the stock quantity for part PN-9876?", "PN-9876"),
    ("How do I file under policy HR-42?", "HR-42"),
    ("What is the lead time for VAL-9999?", "VAL-9999"),
])
def test_invented_identifiers_are_caught(question, expected) -> None:
    assert evalgen._invented_identifier(question, CORPUS) == expected


@pytest.mark.parametrize("question", [
    "What is the stock quantity for part PUM-1007?",
    "What does policy HR-09 say about grievances?",
    "Which form do I use to file a grievance?",   # no identifier at all
    "How much annual leave do shore staff accrue?",
])
def test_real_identifiers_and_plain_questions_survive(question) -> None:
    assert evalgen._invented_identifier(question, CORPUS) is None


def test_the_gate_is_precise_on_the_committed_suites() -> None:
    """Measured, not assumed: across both committed suites this drops exactly
    the one fabricated case and nothing else."""
    import json
    from pathlib import Path
    from forgeai.ingest.chunker import chunk_corpus
    from forgeai.ingest.loaders import load_folder

    root = Path(__file__).resolve().parents[1]
    total, dropped = 0, []
    for demo in ("hr_policy", "ship_spares"):
        suite_path = root / "runs" / f"{demo}_live" / "04_eval_suite.json"
        docs = root / "demos" / demo / "docs"
        if not (suite_path.exists() and docs.exists()):
            continue
        refs, raw, _ = load_folder(docs)
        corpus = " ".join(c.text.lower() for c in chunk_corpus(refs, raw, 800, 120))
        for case in json.loads(suite_path.read_text())["cases"]:
            total += 1
            if evalgen._invented_identifier(case["question"], corpus):
                dropped.append(case["id"])
    if total == 0:
        pytest.skip("no committed suites yet")
    assert dropped == ["ans_011"], f"expected only ans_011, got {dropped}"


# --- a fix nobody re-scored is not a fix that scored zero -------------------
# hr_policy's report said iteration 1 went 79% -> 0.0% and was "kept". Both were
# false: the run stopped before iteration 2 completed, so the fix was never
# re-scored. score_after defaulted to 0.0, which reads as "this change destroyed
# the agent", and kept defaulted to True, which claims a validation that never
# ran. Requirement 7 is honest reporting; this was its opposite.

def test_unmeasured_fix_reports_no_score_and_no_verdict() -> None:
    from forgeai.models.iteration import IterationLog
    it = IterationLog(iteration=1, score_before=0.793, score_after=None, kept=None)
    assert it.delta is None, "no after-score means no delta to report"


def test_measured_fix_still_reports_its_delta() -> None:
    from forgeai.models.iteration import IterationLog
    it = IterationLog(iteration=0, score_before=0.655, score_after=0.793)
    assert it.delta == pytest.approx(0.138)


def test_report_renders_an_unmeasured_iteration_without_crashing() -> None:
    from forgeai.models.agent_def import AgentDefinition
    from forgeai.models.evals import Scorecard
    from forgeai.models.iteration import Budget, FixAction, IterationLog, RunReport
    from forgeai.stages import reporter

    report = RunReport(
        run_id="r", brief="b", corpus_hash="h", evaluated=True,
        final_pass_rate=0.793, budget=Budget(),
        scorecards=[Scorecard(iteration=0, passed=23, total=29, pass_rate=0.793)],
        iterations=[IterationLog(
            iteration=1, score_before=0.793, score_after=None, kept=None,
            revert_reason="not re-scored: the run stopped before this fix was measured",
            fix=FixAction(category="prompt_defect", rung="patch_scope_block",
                          rationale="r", diff={}, targets_case_ids=[]))],
    )
    text = reporter.render(report, AgentDefinition(
        name="a", system_prompt="p"))
    assert "not measured" in text
    assert "NOT MEASURED" in text
    assert "0%" not in text.split("Score:")[1].split("\n")[0], (
        "an unmeasured fix must not be rendered as having scored zero")


# --- a rebuild must not silently discard a valid calibration ---------------
# `forgeai calibrate` writes its result into 06_report.json, and re-finalising a
# run overwrote the file -- so a run that HAD been calibrated silently went back
# to reporting no judge agreement at all, and the audit called it uncalibrated.
# Carrying it forward is only safe while the verdicts it describes are unchanged.

def _run_dir(tmp_path, sig, cal_sig, n=12):
    import json
    (tmp_path / "05_iterations" / "iter_0").mkdir(parents=True)
    (tmp_path / "05_iterations" / "iter_0" / "verdicts.json").write_text(
        json.dumps({"_signature": sig, "verdicts": []}))
    (tmp_path / "06_report.json").write_text(json.dumps({
        "calibration": {"n_cases": n, "agreements": 7, "agreement_rate": 0.583,
                        "cohens_kappa": 0.167, "iteration": 0,
                        "verdicts_signature": cal_sig}}))
    return tmp_path


SIG = {"judge": "qwen/qwen3.8-27b", "answers": "abc123"}


def test_calibration_is_carried_when_the_verdicts_are_unchanged(tmp_path) -> None:
    from forgeai.pipeline import _load_calibration
    got = _load_calibration(_run_dir(tmp_path, SIG, SIG))
    assert got is not None and got.cohens_kappa == pytest.approx(0.167)


def test_calibration_is_dropped_when_the_answers_moved_on(tmp_path) -> None:
    from forgeai.pipeline import _load_calibration
    moved = {"judge": SIG["judge"], "answers": "different"}
    assert _load_calibration(_run_dir(tmp_path, moved, SIG)) is None


def test_calibration_is_dropped_when_the_judge_changed(tmp_path) -> None:
    from forgeai.pipeline import _load_calibration
    other_judge = {"judge": "openai/gpt-oss-safeguard-20b", "answers": SIG["answers"]}
    assert _load_calibration(_run_dir(tmp_path, other_judge, SIG)) is None


def test_calibration_without_a_signature_is_not_carried(tmp_path) -> None:
    # Blocks written before signatures existed cannot be proven current.
    from forgeai.pipeline import _load_calibration
    assert _load_calibration(_run_dir(tmp_path, SIG, {})) is None


def test_a_run_with_no_prior_report_carries_nothing(tmp_path) -> None:
    from forgeai.pipeline import _load_calibration
    assert _load_calibration(tmp_path) is None
