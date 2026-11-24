# ForgeAI run report - hr_policy_live

**Brief.** I need an assistant that answers HR policy questions for shore staff - annual
leave and carry-over, parental leave, travel expense reimbursement, and how to
raise a grievance. It should sound plain and reassuring, never give legal advice,
and never discuss an individual employee's salary or disciplinary record.

**Final pass rate: 86%** (agent v0, stopped because: iteration cap (2) reached)

Budget: 52,565/500,000 tokens, 345.7s/2400s, 2/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 86% | 24/28 | 100% | 100% | 50% | 4% |
| 1 | 86% | 24/28 | 100% | 100% | 50% | 4% |
| 2 | 82% | 23/28 | 93% | 100% | 50% | 4% |

## What changed, and whether it helped

> No fix beat the baseline. Every attempted change was reverted and the shipped agent is the one the generator produced first. That is a real result: on this corpus the generated definition was already at its best, and the loop's job was to establish that rather than to improve on it.

**Iteration 0: `prompt_defect` -> `patch_format_block`** (REVERTED - scored 86% against best 86%; reverted to v0)

- Diagnosed: {'prompt_defect': 2, 'wrong_refusal': 1, 'hallucination': 1}
- Rationale: 4 failures classified prompt_defect; applying patch_format_block
- Changed: `{'system_prompt': '<995 chars>'}` -> `{'system_prompt': '<1014 chars, FORMAT revised>'}`
- Targeted: edge_multi_00, edge_multi_03
- Score: 86% -> 86% (delta +0%)

**Iteration 1: `prompt_defect` -> `patch_scope_block`** (REVERTED - scored 82% against best 86%; reverted to v0)

- Diagnosed: {'prompt_defect': 2, 'wrong_refusal': 1, 'hallucination': 1}
- Rationale: 4 failures classified prompt_defect; applying patch_scope_block
- Changed: `{'system_prompt': '<995 chars>'}` -> `{'system_prompt': '<1081 chars, SCOPE revised>'}`
- Targeted: edge_multi_00, edge_multi_03
- Score: 86% -> 82% (delta -4%)

## What still fails

4 of 28 cases still fail:

| case | question | why |
|---|---|---|
| `edge_multi_00` | If an employee submits an appeal 8 working days after receiving a writ | fact recall 0.0 |
| `edge_multi_01` | If a staff member falls ill during booked annual leave and provides a  | refused an answerable question |
| `edge_multi_02` | If an employee appeals a grievance decision, within how many working d | cited chunks it never retrieved |
| `edge_multi_03` | What is the maximum travel expense amount a line manager can approve i | fact recall 0.5 |

## Judge calibration

Agreement with hand labels: **80%** (8/10), Cohen's kappa 0.55.

Disagreements:

- `edge_multi_01`: judge said False, human said True
- `edge_multi_03`: judge said False, human said True

## Final agent definition

- Tools: none
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1