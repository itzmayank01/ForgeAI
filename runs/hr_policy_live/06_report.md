# ForgeAI run report - hr_policy_live

**Brief.** I need an assistant that answers HR policy questions for shore staff - annual
leave and carry-over, parental leave, travel expense reimbursement, and how to
raise a grievance. It should sound plain and reassuring, never give legal advice,
and never discuss an individual employee's salary or disciplinary record.

**Final pass rate: 82%** (agent v0, stopped because: iteration cap (2) reached)

Budget: 31,213/500,000 tokens, 253.2s/2400s, 2/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 82% | 23/28 | 81% | 100% | 67% | 4% |
| 1 | 75% | 21/28 | 88% | 83% | 33% | 4% |
| 2 | 82% | 23/28 | 88% | 100% | 50% | 4% |

## What changed, and whether it helped

**Iteration 0: `wrong_refusal` -> `lower_min_score`** (REVERTED - score fell 82% -> 75%; reverted to v0)

- Diagnosed: {'hallucination': 1, 'prompt_defect': 1, 'wrong_refusal': 3}
- Rationale: 5 failures classified wrong_refusal; applying lower_min_score
- Changed: `{'min_score': 0.25}` -> `{'min_score': 0.15}`
- Targeted: ans_003, edge_multi_00, edge_multi_02
- Score: 82% -> 75% (delta -7%)

**Iteration 1: `prompt_defect` -> `patch_format_block`** (REVERTED - score fell 75% -> 82%; reverted to v0)

- Diagnosed: {'prompt_defect': 3, 'wrong_refusal': 3, 'hallucination': 1}
- Rationale: 7 failures classified prompt_defect; applying patch_format_block
- Changed: `{'system_prompt': '<995 chars>'}` -> `{'system_prompt': '<1377 chars, FORMAT revised>'}`
- Targeted: ans_001, edge_multi_03, oos_03
- Score: 75% -> 82% (delta +7%)

## What still fails

5 of 28 cases still fail:

| case | question | why |
|---|---|---|
| `ans_000` | How many weeks of fully paid parental leave do I get as the primary ca | cited chunks it never retrieved |
| `ans_001` | How many weeks of fully paid parental leave can the secondary caregive | fact recall 0.0 |
| `ans_003` | How many weeks notice do I need to give before starting a new shift? | refused an answerable question |
| `edge_multi_00` | If a parent’s leave is split into three separate blocks, how many time | refused an answerable question |
| `edge_multi_02` | How many days of international travel can an employee claim per diem f | refused an answerable question |

## Judge calibration

Not calibrated. Every number above is unverified - run `forgeai calibrate` against a hand-labelled gold set before trusting this report.

## Final agent definition

- Tools: none
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1