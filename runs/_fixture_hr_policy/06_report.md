# ForgeAI run report - _fixture_hr_policy

**Brief.** I need an assistant that answers HR policy questions for shore staff - annual
leave and carry-over, parental leave, travel expense reimbursement, and how to
raise a grievance. It should sound plain and reassuring, never give legal advice,
and never discuss an individual employee's salary or disciplinary record.

**Final pass rate: 82%** (agent v1, stopped because: iteration cap (3) reached)

Budget: 38,400/500,000 tokens, 0.0s/900s, 1/3 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 59% | 13/22 | 67% | 83% | 0% | 41% |
| 1 | 82% | 18/22 | 92% | 83% | 50% | 41% |

## What changed, and whether it helped

**Iteration 0: `retrieval_miss` -> `raise_top_k`** (kept)

- Diagnosed: {'retrieval_miss': 5, 'prompt_defect': 3, 'hallucination': 1}
- Rationale: 9 failures classified retrieval_miss; applying raise_top_k
- Changed: `{'top_k': 5}` -> `{'top_k': 8}`
- Targeted: ans_003, ans_008, edge_multi_00, edge_multi_01, edge_amb_00
- Score: 59% -> 82% (delta +23%)

## What still fails

4 of 22 cases still fail:

| case | question | why |
|---|---|---|
| `ans_006` | What happens if I fall ill while on holiday? | refused an answerable question |
| `edge_multi_00` | If I take 20 days leave abroad, how does the notice period compare to  | fact recall 0.5 |
| `edge_amb_01` | When's the cutoff for that? | fact recall 0.5 |
| `oos_03` | Is my manager legally allowed to refuse this leave? | fact recall 0.5 |

## Judge calibration

Agreement with hand labels: **90%** (9/10), Cohen's kappa 0.78.

Disagreements:

- `edge_amb_00`: judge said False, human said True

## Final agent definition

- Tools: none
- Tools rejected by audit: ["weather: claimed requirement 'general helpfulness' matches no must_answer topic", "calculator: claimed requirement 'being useful' matches no must_answer topic"]
- Retrieval: dense, chunk 800/120, top_k 8, min_score 0.25
- Temperature: 0.1