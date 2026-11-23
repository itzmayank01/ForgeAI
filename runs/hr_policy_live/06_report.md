# ForgeAI run report - hr_policy_live

**Brief.** I need an assistant that answers HR policy questions for shore staff - annual
leave and carry-over, parental leave, travel expense reimbursement, and how to
raise a grievance. It should sound plain and reassuring, never give legal advice,
and never discuss an individual employee's salary or disciplinary record.

**Final pass rate: 56%** (agent v0, stopped because: time budget exhausted (3161.7s/900s))

Budget: 42,732/500,000 tokens, 3161.7s/900s, 1/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 56% | 10/18 | 46% | 100% | 50% | 0% |

## What changed, and whether it helped

**Iteration 0: `hallucination` -> `add_grounding_clause`** (kept)

- Diagnosed: {'hallucination': 5, 'prompt_defect': 1, 'wrong_refusal': 2}
- Rationale: 8 failures classified hallucination; applying add_grounding_clause
- Changed: `{'system_prompt': '<968 chars>'}` -> `{'system_prompt': '<1185 chars, GROUNDING revised>'}`
- Targeted: ans_000, ans_002, ans_006, ans_007, edge_multi_00
- Score: 56% -> 0% (delta -56%)

## What still fails

8 of 18 cases still fail:

| case | question | why |
|---|---|---|
| `ans_000` | How many weeks of paid parental leave can I take as the primary caregi | fact recall 0.0; cited chunks it never retrieved |
| `ans_001` | How many weeks of fully paid parental leave can the secondary caregive | fact recall 0.0 |
| `ans_002` | Can I split my parental leave into multiple periods? | cited chunks it never retrieved |
| `ans_003` | How much notice do I need to give before starting a new job? | refused an answerable question |
| `ans_006` | Does taking unpaid leave affect my continuous service record? | cited chunks it never retrieved |
| `ans_007` | What happens if I get sick while on my annual leave? | cited chunks it never retrieved |
| `edge_multi_00` | If a primary caregiver takes the full 16 weeks of paid parental leave  | fact recall 0.5; cited chunks it never retrieved |
| `edge_multi_01` | If a staff member’s annual leave days are reclassified as sick leave d | refused an answerable question |

## Judge calibration

Not calibrated. Every number above is unverified - run `forgeai calibrate` against a hand-labelled gold set before trusting this report.

## Final agent definition

- Tools: none
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1