# ForgeAI run report - ship_spares_live

**Brief.** Build me a procurement assistant for our ship spares desk. It should answer
questions about part availability, prices and lead times from the parts
catalogue, and about supplier terms, minimum order quantities and warranty
conditions from the supplier agreements. It needs to work out order totals.
Purchasing officers use it. It must not recommend one supplier over another or
commit to a delivery date it cannot evidence.

**Final pass rate: 57%** (agent v0, stopped because: incomplete eval pass (resume to finish))

Budget: 566/500,000 tokens, 358.8s/2400s, 1/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 57% | 16/28 | 71% | 100% | 0% | 7% |

## What changed, and whether it helped

**Iteration 0: `prompt_defect` -> `patch_format_block`** (kept)

- Diagnosed: {'prompt_defect': 9, 'retrieval_miss': 1, 'wrong_refusal': 2}
- Rationale: 12 failures classified prompt_defect; applying patch_format_block
- Changed: `{'system_prompt': '<1173 chars>'}` -> `{'system_prompt': '<1692 chars, FORMAT revised>'}`
- Targeted: ans_004, ans_006, ans_011, ans_013, edge_multi_01, edge_multi_02
- Score: 57% -> 0% (delta -57%)

## What still fails

12 of 28 cases still fail:

| case | question | why |
|---|---|---|
| `ans_004` | Can you tell me the price, availability and lead time for part VAL-109 | fact recall 0.0 |
| `ans_006` | Can you confirm the price, lead time and current stock for part SEA-12 | fact recall 0.0 |
| `ans_011` | Can you confirm the price and availability of part PUM-1028 from Kowlo | fact recall 0.0 |
| `ans_013` | Can you confirm the price, lead time, stock quantity and supplier for  | fact recall 0.0 |
| `edge_multi_00` | If you place an order for part SEA-1266 today, on which date will the  | refused an answerable question |
| `edge_multi_01` | What is the minimum number of VAL-1077 butterfly valves that must be p | fact recall 0.0 |
| `edge_multi_02` | Is it possible to place an order for a single FIL-1175 air intake filt | fact recall 0.5 |
| `edge_multi_03` | If a customer orders 10 units of part SEA-1238 from Nordhavn Marine, w | fact recall 0.0 |
| `edge_amb_00` | What's the price in euros for that part? | refused an answerable question |
| `edge_amb_01` | What’s the lead time for that part? | fact recall 0.0 |
| `edge_amb_02` | Do we have any of those parts in stock? | fact recall 0.0 |
| `edge_amb_03` | Could you let me know the price, availability, and lead time for that  | refused an answerable question |

## Judge calibration

Not calibrated. Every number above is unverified - run `forgeai calibrate` against a hand-labelled gold set before trusting this report.

## Final agent definition

- Tools: none
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1