# ForgeAI run report - _rehearsal_port

**Brief.** We need an assistant for our port agency desk. It should answer questions about
port call procedures, documentation deadlines, tariff charges and pilotage
requirements from our operations manuals. Agents use it while a vessel is
inbound, so answers must be exact and cite the clause. It must not give customs
or immigration rulings, and must not estimate charges for ports we have no
tariff for.

**Final pass rate: 88%** (agent v0, stopped because: iteration cap (2) reached)

Budget: 110,858/500,000 tokens, 603.1s/2400s, 2/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 88% | 23/26 | 91% | 100% | 67% | 0% |
| 1 | 88% | 23/26 | 91% | 100% | 67% | 0% |
| 2 | 88% | 23/26 | 91% | 100% | 67% | 0% |

## What changed, and whether it helped

> No fix beat the baseline. Every attempted change was reverted and the shipped agent is the one the generator produced first. That is a real result: on this corpus the generated definition was already at its best, and the loop's job was to establish that rather than to improve on it.

**Iteration 0: `prompt_defect` -> `patch_format_block`** (REVERTED - scored 88% against best 88%; reverted to v0)

- Diagnosed: {'prompt_defect': 3}
- Rationale: 3 failures classified prompt_defect; applying patch_format_block
- Changed: `{'system_prompt': '<949 chars>'}` -> `{'system_prompt': '<1267 chars, FORMAT revised>'}`
- Targeted: ans_007, edge_multi_02, edge_multi_03
- Score: 88% -> 88% (delta +0%)

**Iteration 1: `prompt_defect` -> `patch_scope_block`** (REVERTED - scored 88% against best 88%; reverted to v0)

- Diagnosed: {'prompt_defect': 3}
- Rationale: 3 failures classified prompt_defect; applying patch_scope_block
- Changed: `{'system_prompt': '<949 chars>'}` -> `{'system_prompt': '<983 chars, SCOPE revised>'}`
- Targeted: ans_007, edge_multi_02, edge_multi_03
- Score: 88% -> 88% (delta +0%)

## What still fails

3 of 26 cases still fail:

| case | question | why |
|---|---|---|
| `ans_007` | What is the penalty if we cancel a pilotage booking within four hours  | fact recall 0.0 |
| `edge_multi_02` | What is the total pilotage fee for a vessel that is 200 metres long? | fact recall 0.0 |
| `edge_multi_03` | If a vessel 110 metres long holding a valid Pilotage Exemption Certifi | fact recall 0.5 |

## Judge calibration

Not calibrated. Every number above is unverified - run `forgeai calibrate` against a hand-labelled gold set before trusting this report.

## Final agent definition

- Tools: none
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1