# ForgeAI run report - ship_spares_live

**Brief.** Build me a procurement assistant for our ship spares desk. It should answer
questions about part availability, prices and lead times from the parts
catalogue, and about supplier terms, minimum order quantities and warranty
conditions from the supplier agreements. It needs to work out order totals.
Purchasing officers use it. It must not recommend one supplier over another or
commit to a delivery date it cannot evidence.

**Final pass rate: 66%** (agent v0, stopped because: iteration cap (2) reached)

Budget: 211,025/500,000 tokens, 12708.0s/2400s, 2/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 66% | 19/29 | 79% | 100% | 36% | 0% |
| 1 | 66% | 19/29 | 79% | 100% | 36% | 0% |
| 2 | 66% | 19/29 | 79% | 100% | 36% | 0% |

## What changed, and whether it helped

> No fix beat the baseline. Every attempted change was reverted and the shipped agent is the one the generator produced first. That is a real result: on this corpus the generated definition was already at its best, and the loop's job was to establish that rather than to improve on it.

**Iteration 0: `prompt_defect` -> `patch_format_block`** (REVERTED - scored 66% against best 66%; reverted to v0)

- Diagnosed: {'retrieval_miss': 2, 'prompt_defect': 4, 'wrong_refusal': 4}
- Rationale: 10 failures classified prompt_defect; applying patch_format_block
- Changed: `{'system_prompt': '<1183 chars>'}` -> `{'system_prompt': '<1733 chars, FORMAT revised>'}`
- Targeted: ans_013, edge_calc_00, edge_calc_01, edge_calc_02
- Score: 66% -> 66% (delta +0%)

**Iteration 1: `prompt_defect` -> `patch_scope_block`** (REVERTED - scored 66% against best 66%; reverted to v0)

- Diagnosed: {'retrieval_miss': 2, 'prompt_defect': 5, 'wrong_refusal': 3}
- Rationale: 10 failures classified prompt_defect; applying patch_scope_block
- Changed: `{'system_prompt': '<1183 chars>'}` -> `{'system_prompt': '<1217 chars, SCOPE revised>'}`
- Targeted: ans_013, edge_multi_03, edge_calc_00, edge_calc_01, edge_calc_02
- Score: 66% -> 66% (delta +0%)

## What still fails

10 of 29 cases still fail:

| case | question | why |
|---|---|---|
| `ans_009` | What is the unit price in euros for the component listed in parts_cata | fact recall 0.0 |
| `ans_011` | What is the current stock quantity for part PN-9876? | refused an answerable question |
| `ans_013` | What is the restocking fee if I place a replacement order of equal or  | fact recall 0.0 |
| `edge_multi_00` | If I return a mechanical part within 21 days of delivery, how many mon | refused an answerable question |
| `edge_multi_01` | If a shipment arrives on March 1 and the invoice is issued on March 5, | refused an answerable question |
| `edge_multi_02` | If a customer returns all 60 unused stock items within 30 days of deli | refused an answerable question |
| `edge_multi_03` | If you place an order 50 days in advance and later return unused stock | refused an answerable question |
| `edge_calc_00` | What is the total value of all parts currently in stock? | fact recall 0.0 |
| `edge_calc_01` | What is the total inventory value of all parts listed? | fact recall 0.0 |
| `edge_calc_02` | What is the total value of the stock for parts SEA-1252 and SEA-1259 c | fact recall 0.0 |

## Judge calibration

Agreement with hand labels: **58%** (7/12), Cohen's kappa 0.17.

Disagreements:

- `edge_multi_00`: judge said False, human said True
- `ans_013`: judge said False, human said True
- `ans_009`: judge said False, human said True
- `edge_multi_01`: judge said False, human said True
- `ans_011`: judge said False, human said True

## Final agent definition

- Tools: calculator, csv_lookup
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1