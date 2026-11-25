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
| `hr_policy_live` | **66%** (19/29) | 29 | 0 | 10 | 92% (kappa 0.83) |
| `ship_spares_live` | not scored | 29 | — | — | — |

**Both figures are mid-work, and the gap is quota rather than capability.** The
free tier's daily token budget is spent (see *Known limits*), so `hr_policy_live`
was finalised from its completed baseline iteration with `--max-iterations 0` -
scored, calibrated, and honest, but with no fix iteration attempted - and
`ship_spares_live` stands at 9 of 29 answers with no scorecard. A run with no
scorecard reports none; nothing here is inferred from a partial pass.

Two defects found after that baseline was measured are fixed in the code but not
yet reflected in any score, because re-measuring needs the budget that is gone:

- **Five of the ten residual failures were one defect.** Each was a correct
  answer whose supporting clause *was* in the retrieved context, carrying a
  citation to a chunk the agent had never been shown - asked to cite
  `doc_01_c003`, the model reproduced the shape of an id rather than the id.
  Sources are numbered now and resolved to chunk ids in code, so the figure
  should rise materially on the next full run.
- **Tools never fired.** 90 answers across three runs, zero tool calls, because
  the planner prompt asserted "most questions do not" need a tool and so decided
  before looking. Both are verified working by live smoke test, not by argument.

`RUNTIME_VERSION` is 3 as a result, so the runtime-2 answers above will be
discarded rather than blended into the next run's scorecard.

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

The current HR calibration (92%, kappa 0.83 over 12 cases) did the same job
again. Its single judge/human disagreement was not a judge error but a
**generator** defect: a case whose only expected fact was `Policy reference:
HR-09`, a document header. Since the judge requires *every* expected fact, one
unanswerable fact sinks a case no answer could pass. The gate now rejects
expected facts that are front matter.

One limitation stated plainly: these gold labels are **author-adjudicated**, not
independent. That bounds what the kappa proves, which is why every label in
`gold/` carries the clause it rests on - a reviewer can check the labelling
instead of trusting it.

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
