# ForgeAI run report - hr_policy_live

**Brief.** I need an assistant that answers HR policy questions for shore staff - annual
leave and carry-over, parental leave, travel expense reimbursement, and how to
raise a grievance. It should sound plain and reassuring, never give legal advice,
and never discuss an individual employee's salary or disciplinary record.

**Final pass rate: 71%** (agent v0, stopped because: incomplete eval pass (resume to finish))

Budget: 78,431/500,000 tokens, 914.1s/900s, 2/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 71% | 20/28 | 62% | 100% | 67% | 4% |
| 1 | 68% | 19/28 | 75% | 83% | 33% | 4% |

## What changed, and whether it helped

**Iteration 0: `prompt_defect` -> `patch_format_block`** (REVERTED - score fell 71% -> 68%; reverted to v0)

- Diagnosed: {'hallucination': 1, 'prompt_defect': 4, 'wrong_refusal': 3}
- Rationale: 8 failures classified prompt_defect; applying patch_format_block
- Changed: `{'system_prompt': '<995 chars>'}` -> `{'system_prompt': '<1415 chars, FORMAT revised>'}`
- Targeted: ans_001, ans_007, ans_013, ans_014
- Score: 71% -> 68% (delta -4%)

**Iteration 1: `prompt_defect` -> `patch_scope_block`** (kept)

- Diagnosed: {'prompt_defect': 5, 'wrong_refusal': 3, 'hallucination': 1}
- Rationale: 9 failures classified prompt_defect; applying patch_scope_block
- Changed: `{'system_prompt': '<995 chars>'}` -> `{'system_prompt': '<1131 chars, SCOPE revised>'}`
- Targeted: ans_001, ans_007, ans_014, edge_multi_03, oos_03
- Score: 68% -> 0% (delta -68%)

## What still fails

8 of 28 cases still fail:

| case | question | why |
|---|---|---|
| `ans_000` | How many weeks of fully paid parental leave do I get as the primary ca | fact recall 0.0; cited chunks it never retrieved |
| `ans_001` | How many weeks of fully paid parental leave can the secondary caregive | fact recall 0.0 |
| `ans_003` | How many weeks notice do I need to give before starting a new shift? | refused an answerable question |
| `ans_007` | If I take unpaid leave, does that break my continuous service record? | fact recall 0.0 |
| `ans_013` | How much per diem do I get for domestic travel? | fact recall 0.0 |
| `ans_014` | How much per diem do I get for international travel? | fact recall 0.0 |
| `edge_multi_00` | If a parent’s leave is split into three separate blocks, how many time | refused an answerable question |
| `edge_multi_02` | How many days of international travel can an employee claim per diem f | refused an answerable question |

## Judge calibration

Not calibrated. Every number above is unverified - run `forgeai calibrate` against a hand-labelled gold set before trusting this report.

## Final agent definition

- Tools: none
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1