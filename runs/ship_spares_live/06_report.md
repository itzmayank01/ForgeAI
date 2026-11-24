# ForgeAI run report - ship_spares_live

**Brief.** Build me a procurement assistant for our ship spares desk. It should answer
questions about part availability, prices and lead times from the parts
catalogue, and about supplier terms, minimum order quantities and warranty
conditions from the supplier agreements. It needs to work out order totals.
Purchasing officers use it. It must not recommend one supplier over another or
commit to a delivery date it cannot evidence.

**Final pass rate: 21%** (agent v0, stopped because: incomplete eval pass (resume to finish))

Budget: 84,074/500,000 tokens, 928.1s/900s, 1/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 21% | 6/28 | 0% | 100% | 0% | 4% |

## What changed, and whether it helped

**Iteration 0: `prompt_defect` -> `patch_format_block`** (kept)

- Diagnosed: {'prompt_defect': 19, 'retrieval_miss': 1, 'wrong_refusal': 2}
- Rationale: 22 failures classified prompt_defect; applying patch_format_block
- Changed: `{'system_prompt': '<1173 chars>'}` -> `{'system_prompt': '<1375 chars, FORMAT revised>'}`
- Targeted: ans_000, ans_001, ans_002, ans_003, ans_004, ans_005
- Score: 21% -> 0% (delta -21%)

## What still fails

22 of 28 cases still fail:

| case | question | why |
|---|---|---|
| `ans_000` | What is the price in euros for part number FIL-1210? | fact recall 0.0 |
| `ans_001` | What’s the lead time for part SEA-1217? | fact recall 0.0 |
| `ans_002` | Do we have any stock of part SEA-1231? | fact recall 0.0 |
| `ans_003` | Can you confirm the price, availability, and lead time for part VAL-10 | fact recall 0.0 |
| `ans_004` | Can you tell me the price, availability and lead time for part VAL-109 | fact recall 0.0 |
| `ans_005` | Can you confirm the price, lead time, and availability for part VAL-11 | fact recall 0.0 |
| `ans_006` | Can you confirm the price, lead time and current stock for part SEA-12 | fact recall 0.0 |
| `ans_007` | Can you confirm the price, lead time, and availability for part SEA-12 | fact recall 0.0 |
| `ans_008` | Can you confirm the price, lead time, stock and supplier for part SEA- | fact recall 0.0 |
| `ans_009` | Can you confirm the price, lead time, and available stock for part SEA | fact recall 0.0 |
| `ans_010` | Can you confirm the price, lead time, and current stock for part PUM-1 | fact recall 0.0 |
| `ans_011` | Can you confirm the price and availability of part PUM-1028 from Kowlo | fact recall 0.0 |
| `ans_012` | Can you give me the price, lead time, stock quantity and supplier for  | fact recall 0.0 |
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