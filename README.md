# ForgeAI — the agent that builds agents

A factory that takes a one-paragraph brief and a folder of documents, then
autonomously produces a working, tested retrieval agent: system prompt,
retrieval configuration, tool selection, output contract, an auto-generated
evaluation set, and an honest report of what still fails.

**Live:** https://forgeai-ashen.vercel.app

```bash
forgeai build --brief demos/hr_policy/brief.txt --docs demos/hr_policy/docs
forgeai chat  --run runs/hr_policy_live
```

---

## Results

Measured, not claimed: every figure below is read from a committed artifact.

| run | pass rate | cases | fix iterations | residual | judge agreement |
|---|---|---|---|---|---|
| `hr_policy_live` | **79%** (23/29) | 29 | 2 (both reverted) | 6 | 58% (kappa 0.17) |
| `ship_spares_live` | **66%** (19/29) | 29 | 2 (both reverted) | 10 | 58% (kappa 0.17) |

HR's 79% is up from an earlier 66%, and the failure taxonomy shows why:
`hallucination` went from 5 occurrences to **zero**. Those five were never
hallucinations - each was a correct answer whose supporting clause *was* in the
retrieved context, carrying a citation to a chunk the agent had never been
shown. Asked to cite `doc_01_c003`, the model reproduced the shape of an id
rather than the id. Numbering the sources removed the error instead of
discouraging it. A second defect fixed alongside it: tools had never fired, in
90 answers across three runs, because the planner prompt asserted "most
questions do not" need one and so decided before looking.

**Every fix either run attempted was reverted** - four in total, none beating
the definition the generator produced first. That is the loop doing its job
rather than a missing result: on these corpora its task was to establish that
the baseline was already at its best, and the iteration logs carry the scores
that settled it.

**The two runs use different models, and that is a free-tier consequence rather
than a design choice.** Daily token caps are per organization per model, and
both gpt-oss models were spent when `ship_spares` needed to run. So its agent
runs `qwen/qwen3.8-27b` and its judge `openai/gpt-oss-safeguard-20b`, whose cap
is its own because caps are per model and nothing had touched it. Requirement 5
asks that the judge not share a family with the agent; qwen-vs-gpt-oss satisfies
that exactly as well as the reverse pairing `hr_policy` uses. Each run's
definition records the model that produced it, and the answer cache refuses to
blend two models into one scorecard.

### What calibration found

The spares judge scored **kappa 0.00** - no better than chance. Reading its
disagreements showed why: the eval generator was producing questions with no
referent ("the unit price for *this* part", with no part ever named). The agent
correctly refused them and the judge marked every refusal a failure.

My own prompt caused it. `AMBIGUOUS` asked for "a pronoun with no clear
referent" and then demanded the result stay answerable - two instructions that
cannot both hold. Both prompts were rewritten and the gate now drops such
questions.

Publishing kappa 0.00 is the point. It is the number that found the bug.

It keeps earning its place. An earlier calibration of this run reached kappa
0.83, and its one disagreement was a **generator** defect rather than a judge
error: a case whose only expected fact was `Policy reference: HR-09`, a document
header. Since the judge requires *every* expected fact, one unanswerable fact
sinks a case no answer could pass. The gate now rejects front matter as a fact.

The current calibration is **58% agreement, kappa 0.17** over 12 freshly
adjudicated labels - and that low number is the finding, not a disappointment.
Four of its five disagreements are `edge_multi_*` cases where the judge fails
correct *applied* reasoning:

> *"If an employee wishes to take a 12-day leave and also file a grievance…"* The
> agent answered 20 working days' notice and 15 working days to file. Both are
> right. Recall scored 0.5 because the expected fact carries the rule's
> threshold - "requests of **10 consecutive days or more** require 20 working
> days notice" - and the answer applied the rule to a 12-day request without
> restating a threshold nothing had asked about.

`recall >= 0.99` over literal expected facts is the cause, and it is **left
alone deliberately**. Loosening a judge until it agrees with the author's own
labels is how a calibration number becomes decoration. The honest move is to
publish 0.17 with the diagnosis and leave the threshold where it is.

The fifth disagreement is a flatly mislabelled case: `oos_01` asks how to file a
harassment complaint and is marked out-of-scope, but HR-09 1.2 says harassment
complaints follow that very procedure. The agent answered correctly and was
marked wrong for it. The gate's out-of-scope check is embedding similarity at
0.72, and that question did not clear the bar.

A lexical complement was tried and **rejected on measurement**: dropping any
out-of-scope case whose question names a term appearing in only one or two
chunks. Against the two committed suites it would have discarded 6 of 10
legitimate out-of-scope cases, triggered by incidental vocabulary - `travel` in
a question about tax deductions, plus `second`, `provide` and `specific`. Only
`harassment` was a real signal. Growing the stopword list until the other five
survive is fitting a filter to ten examples, so it is not shipped and this
paragraph stands in its place.

One limitation stated plainly: these gold labels are **author-adjudicated**, not
independent. That bounds what the kappa proves, which is why every label in
`gold/` carries the clause it rests on - a reviewer can check the labelling
instead of trusting it.

`ship_spares` calibrates to the **same 58% / kappa 0.17** on a completely
different corpus, which makes the pattern a property of the judge rather than
of one document set. Its disagreements name three more generator defects:

- **A fabricated subject.** `ans_011` asks the stock quantity for part
  `PN-9876` and expects `stock_qty: 60`. No part number in that catalogue uses
  a `PN-` prefix at all. The agent refused, correctly, and the case scored it a
  failure - exactly the pressure that teaches an optimizer to stop refusing.
  The gate now drops any case whose question names an identifier absent from
  the documents; across both committed suites it catches that one case and
  nothing else.
- **Terms welded across two contracts.** `edge_multi_00` pairs Nordhavn's
  24-month warranty with Kowloon's 21-day return window - clauses from two
  different suppliers' agreements, which cannot both govern one part. The agent
  said the supplier was unspecified instead of inventing a composite, and was
  marked wrong for it. Cross-document cases need to share a subject, not merely
  a content word.
- **An aggregate beyond retrieval's reach.** `edge_calc_01` asks for the total
  inventory value of a 40-row catalogue. Here the judge was right and the agent
  wrong - but so was the case. The true `sum(unit_price * stock_qty)` is
  1,967,449.20; the agent answered 1,063,554.46 after summing only the rows
  top-k put in front of it, and the expected fact says 162,168.18, which is
  neither that nor `sum(unit_price)` (98,283.34). The agent has `csv_lookup`
  attached and should have read the whole file. A whole-table aggregate cannot
  be answered from five chunks, and nothing currently forces the tool.

### Rehearsal on an unseen corpus

`rehearsal/` holds a port-agency brief and documents the factory had never
seen, used to test the review condition rather than the two demos. A cold
unattended run completes in roughly two minutes.

## The problem this is actually solving

Building a RAG agent is easy. Building **evals honest enough to judge an agent
nobody hand-wrote** is not. A pipeline that writes its own tests, grades its own
output and fixes its own failures will happily report 100% and mean nothing by
it.

So the organising principle here is **adversarial separation plus determinism**:

| Guard | How |
|---|---|
| Eval generator never sees the agent | `stages/evalgen.py` does not import `AgentDefinition`. Tests derive from documents alone, so they cannot be tuned to the prompt just written |
| Judge never sees the system prompt | Runs a *different* open-weight family from the generator, scores each case against a rubric in isolation |
| No position bias | There is no pairwise comparison anywhere in the loop — nothing for order to bias |
| No verbosity bias | Score is fact recall + unsupported-claim rate, both length-independent. Answer length is recorded and **never** scored |
| Determinism first | Refusal is a boolean in the output contract. Citation validity is set arithmetic. Numeric facts must match exactly. Only the ambiguous residue reaches a model, and the escalation rate is reported |
| Fixes must earn their place | Every iteration is compared against the best score so far and **reverted** if it loses ground |
| The judge is itself checked | `forgeai calibrate` measures agreement against hand labels and publishes it with the disagreements. An uncalibrated run says so instead of showing a number |

The last one is the point. A judge nobody has checked is not evidence.

---

## The nine core requirements

| # | Requirement | Where |
|---|---|---|
| 1 | Intake interviewer | `stages/intake.py` |
| 2 | Groundability guard | `stages/groundability.py` |
| 3 | Agent generator | `stages/generator.py` |
| 4 | Eval generator | `stages/evalgen.py`, prompts in `prompts/evalgen.py` |
| 5 | Judge | `stages/judge.py` |
| 6 | Critic → optimizer loop | `stages/critic.py`, `stages/optimizer.py` |
| 7 | Honest reporting | `stages/reporter.py` |
| 8 | Runnable product | `runtime/agent.py`, `runtime/runner.py` |
| 9 | Two demonstrations | `demos/`, `runs/` |

---

## Two contradictions in the brief

Spotting them matters more than resolving them neatly, so both are handled
explicitly rather than quietly.

**1. "At most 5 clarifying questions" vs "runs unattended in front of us."**

Both, from one code path. `--interactive` asks. Unattended mode asks the *same*
questions, answers them itself from retrieved document text, and records each as
an `Assumption` carrying a confidence and the chunk that justified it. Surfacing
assumptions beats skipping the interview.

**2. Budget is listed as a stretch goal, but the overview defines the core loop
as running "until the evals pass or a budget runs out."**

Treated as core. `models/iteration.py::Budget` caps tokens, wall-clock and
iterations; running out is a normal, reported outcome, not a crash.

---

## How it works

```
brief + docs
   ├─ 0 ingest          pdf/csv/md/txt → chunk → embed → index
   ├─ 1 intake          four small calls → RequirementsDoc
   ├─ 2 groundability   can the documents support what was asked?
   ├─ 3 generate        → AgentDefinition v0
   ├─ 4 evalgen         documents only → ≥20 cases → quality gate
   ├─ 5 loop (≤3)       run → judge → classify → ONE targeted fix → re-run
   └─ 6 report          scorecards + what still fails
```

Every stage writes a committed artifact. **The run directory is the
deliverable** — the code is only how it gets made.

### The eval quality gate

Twenty trivially-passable questions are self-deception, so generated cases are
filtered before they ever score anything:

- an *out-of-scope* question that actually retrieves strong context is **secretly
  answerable** — keeping it would teach the optimizer to make the agent refuse
  everything
- an *answerable* question whose expected facts do not appear in its cited source
- near-duplicates

On a live run the gate dropped 3 of 31 cases, one of them exactly that first
case, unprompted.

### Failure taxonomy → fix ladder

Classification is **diagnostic-first**: the retrieval trace says what happened,
so most failures are categorised deterministically rather than by asking a model
what went wrong.

| Category | Fix ladder, one rung per iteration |
|---|---|
| `retrieval_miss` | ↑top_k → shrink chunks → hybrid → query rewrite |
| `prompt_defect` | patch FORMAT → patch SCOPE → add worked example |
| `hallucination` | grounding clause → force citations → ↓temperature → ↑min_score |
| `wrong_refusal` | ↓min_score → widen scope → soften refusal |

One fix per iteration, aimed at the largest cluster, so every change is
attributable to a measured delta.

---

## Tool discipline

The brief's test is restraint: *"an HR agent with a weather tool is a factory
defect."* Tools are model-proposed but **deterministically audited** — a binding
survives only if the tool exists *and* its claimed `triggering_requirement`
resolves to a real `must_answer` topic.

Restraint is only half of it, though. Failing to attach a tool a requirement
plainly needs is equally a defect, and for a long time this factory had exactly
that bug: every run attached zero tools, including a spares brief whose own
requirements list "Order Total Calculation".

Three causes compounded, each invisible alone:

- A Pydantic **class docstring becomes the JSON-schema `description`**, which the
  model reads as instruction. `ToolBinding`'s said *"an HR agent with a weather
  tool is a factory defect"* — so at the schema level the generator was being
  told to attach nothing, overriding the prompt.
- The selection call asked for a list of three-field objects. The model produced
  malformed JSON which, because the field carried a `default_factory`,
  **validated silently as an empty list**. A correct selection became "no tools"
  with no error anywhere.
- Small models emit the schema *then* the payload, so taking the first JSON
  object found meant accepting the schema echo.

Selection is now a list of plain strings with justification asked separately per
tool — the same decomposition that fixed intake. The runtime then **actually
executes** one tool call per question through the registry, refusing any tool
the definition does not attach. Before this, `REGISTRY` was imported and never
called: declared tools were decoration.

`tests/test_invariants.py` covers execution, refusal of unattached tools, the
no-tools path, and that the calculator still rejects code injection.

### And then the artifacts lied about it anyway

With tools working, both demos still finished with tools attached and **zero
tool calls recorded**. The runs had started before tool execution landed, so the
cached answers came from a runtime that could not call tools — and the cache had
no record of what produced it, so the new runtime reused them happily.

Nothing in the evidence flagged it. A definition attaching `calculator` with no
tool calls reads exactly like a model that chose not to use one. The response
cache now stores a signature (runtime version, model, attached tools, retrieval
config) and discards anything produced by a different agent, and the audit has a
check — `F3b` — that compares attached tools against tools that actually fire.

That check is the useful artifact here. The bug was invisible precisely because
both states produce identical-looking evidence.

## Running it

```bash
uv venv --python 3.12 && uv pip install -e .
cp .env.example .env     # add a Groq key: https://console.groq.com/keys
./scripts/doctor.sh      # preflight: key, auth, venv, live API call
```

```bash
forgeai build --brief <brief.txt> --docs <folder>   # add --resume to continue
forgeai chat  --run runs/<id>
forgeai calibrate --run runs/<id> --gold gold/<labels>.json
```

**Models.** The free tier exposes exactly two usable instruct families —
`openai/gpt-oss-{20b,120b}` and `qwen/qwen3.8-27b` — so the three roles cannot
each hold a family of their own. The judge gets first claim on the scarce one: it
always runs `qwen/qwen3.8-27b`, a different family from whichever gpt-oss the
agent uses, because judge-versus-agent is the separation the self-preference
defense actually rests on. Eval generation shares the agent's family and is kept
apart structurally instead — it never imports `AgentDefinition`, so it cannot
shape cases around the prompt it is testing.

The agent's route is `FORGEAI_AGENT_MODEL`, and it moves between 20b and 120b as
per-key daily caps land. The chosen model is stamped into `03_agent_def.json` and
folded into the answer-cache signature, so a re-route *discards* answers produced
by the previous model instead of blending two agents into one scorecard. An
explicit route also outranks the one recorded in a resumed definition, which is
what makes the switch a flag rather than a hand-edit of committed JSON.

Any OpenAI-compatible endpoint works; swapping provider is one env var.

`reasoning_effort=low` is set for gpt-oss: left unbounded it spends its whole
allowance thinking and returns *empty* content, which JSON mode rejects outright.
Capping it also cut a structured call from ~2,400 tokens to ~227.

---

## Known limits

- **Hosted chat retrieves differently.** `bge-small` cannot run inside a Vercel
  function, so the deployed chat uses BM25 over the same chunks and the same
  agent definition. The CLI is the reference implementation and every published
  score was measured with it. The page says so rather than hiding it.
- **Groundability thresholds are model-specific.** Derived from 14 topic probes
  across both corpora, each written verbose and terse. Re-derive them if the
  embedding model changes; `stages/groundability.py` records the measurements and
  a contrastive alternative that was tried and rejected on the data.
- **The generated suites do not exercise every attached tool.** `hr_policy`
  attaches `current_date` against its "leave policy" topic - leave accrues per
  calendar year and carry-over expires 31 March, so today's date genuinely
  bears on it - but no generated case asks a date-dependent question, so the
  tool never fires. That is a gap in the evals rather than an over-attachment,
  and the audit reports it as one: it fails a run where *nothing* fires, flags
  an idle tool that cites no must-answer topic, and otherwise records the
  coverage gap. A generator that guaranteed a case per attached tool would
  close this properly.
- **Whole-table aggregates exceed what retrieval shows the agent.**
  `ship_spares` asks for the total inventory value of a 40-row catalogue and
  the agent sums only the rows top-k retrieved. It has `csv_lookup` attached
  and should read the file; nothing currently forces the tool for questions
  that span a whole document.
- **Free-tier quota is the binding constraint, and keys do not multiply it.**
  200k tokens/day *per organization, per model*, against roughly 40–80k per full
  run. The daily cap is the one limit no header reports: a request that fits in
  the per-minute window returns `x-ratelimit-remaining-tokens: 8000` and a cheap
  probe returns `200` while the day's budget is gone, because the probe is small
  enough to fit in what little remains. The figure appears only in a 429 body —
  `in organization org_abc … (TPD): Limit 200000, Used 199496`. Reading those
  bodies is also how the key arithmetic got corrected: eight keys reporting
  identical usage turned out to be 3 accounts, not 8 budgets, so `KeyPool`
  sidelines an account's keys together instead of spending attempts on siblings
  drawing from the same empty pot. Budget scales with accounts, not keys.
