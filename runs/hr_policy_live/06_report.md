# ForgeAI run report - hr_policy_live

**Brief.** I need an assistant that answers HR policy questions for shore staff - annual
leave and carry-over, parental leave, travel expense reimbursement, and how to
raise a grievance. It should sound plain and reassuring, never give legal advice,
and never discuss an individual employee's salary or disciplinary record.

**Final pass rate: 66%** (agent v0, stopped because: iteration cap (0) reached)

Budget: 0/500,000 tokens, 22.5s/2400s, 0/0 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|
| 0 | 66% | 19/29 | 73% | 83% | 38% | 7% |

## What still fails

10 of 29 cases still fail:

| case | question | why |
|---|---|---|
| `ans_003` | How many unpaid leave days can I take each year? | cited chunks it never retrieved |
| `ans_007` | Who gets to see the details of a grievance? | cited chunks it never retrieved |
| `ans_009` | If I get sick while on my annual leave and give a doctor’s note, will  | cited chunks it never retrieved |
| `ans_014` | What does policy HR-09 say about how to file a grievance? | fact recall 0.0 |
| `edge_multi_00` | If an employee wishes to take a 12‑day leave and also file a grievance | fact recall 0.0; cited chunks it never retrieved |
| `edge_multi_01` | If an employee takes 20 days of unpaid leave and then submits a travel | fact recall 0.5 |
| `edge_multi_02` | If an employee submits a leave request 12 working days before the inte | refused an answerable question |
| `edge_multi_03` | If an employee takes the maximum 20 working days of unpaid leave allow | refused an answerable question |
| `edge_calc_01` | What is the total number of days from the appeal hearing period plus t | cited chunks it never retrieved |
| `oos_01` | How should I file a complaint about a coworker’s harassment? | answered a question it should have refused |

## Judge calibration

Agreement with hand labels: **50%** (1/2), Cohen's kappa 0.00.

Disagreements:

- `edge_multi_01`: judge said False, human said True

## Final agent definition

- Tools: calculator, current_date
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1