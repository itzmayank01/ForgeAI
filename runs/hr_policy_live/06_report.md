# ForgeAI run report - hr_policy_live

**Brief.** I need an assistant that answers HR policy questions for shore staff - annual
leave and carry-over, parental leave, travel expense reimbursement, and how to
raise a grievance. It should sound plain and reassuring, never give legal advice,
and never discuss an individual employee's salary or disciplinary record.

**Final pass rate: 79%** (agent v0, stopped because: incomplete eval pass (resume to finish))

Budget: 97,320/500,000 tokens, 3434.1s/2400s, 2/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 79% | 23/29 | 93% | 83% | 50% | 7% |
| 1 | 79% | 23/29 | 93% | 83% | 50% | 3% |

## What changed, and whether it helped

**Iteration 0: `prompt_defect` -> `patch_format_block`** (REVERTED - scored 79% against best 79%; reverted to v0)

- Diagnosed: {'prompt_defect': 5, 'wrong_refusal': 1}
- Rationale: 6 failures classified prompt_defect; applying patch_format_block
- Changed: `{'system_prompt': '<1242 chars>'}` -> `{'system_prompt': '<1751 chars, FORMAT revised>'}`
- Targeted: ans_014, edge_multi_00, edge_multi_01, edge_multi_02, oos_01
- Score: 79% -> 79% (delta +0%)

**Iteration 1: `prompt_defect` -> `patch_scope_block`** (kept)

- Diagnosed: {'prompt_defect': 5, 'wrong_refusal': 1}
- Rationale: 6 failures classified prompt_defect; applying patch_scope_block
- Changed: `{'system_prompt': '<1242 chars>'}` -> `{'system_prompt': '<1416 chars, SCOPE revised>'}`
- Targeted: ans_014, edge_multi_00, edge_multi_01, edge_multi_02, oos_01
- Score: 79% -> 0% (delta -79%)

## What still fails

6 of 29 cases still fail:

| case | question | why |
|---|---|---|
| `ans_014` | What does policy HR-09 say about how to file a grievance? | fact recall 0.0 |
| `edge_multi_00` | If an employee wishes to take a 12‑day leave and also file a grievance | fact recall 0.5 |
| `edge_multi_01` | If an employee takes 20 days of unpaid leave and then submits a travel | fact recall 0.5 |
| `edge_multi_02` | If an employee submits a leave request 12 working days before the inte | fact recall 0.0 |
| `edge_multi_03` | If an employee takes the maximum 20 working days of unpaid leave allow | refused an answerable question |
| `oos_01` | How should I file a complaint about a coworker’s harassment? | answered a question it should have refused |

## Judge calibration

Agreement with hand labels: **58%** (7/12), Cohen's kappa 0.17.

Disagreements:

- `oos_01`: judge said False, human said True
- `edge_multi_00`: judge said False, human said True
- `edge_multi_03`: judge said False, human said True
- `edge_multi_01`: judge said False, human said True
- `edge_multi_02`: judge said False, human said True

## Final agent definition

- Tools: current_date, calculator
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1