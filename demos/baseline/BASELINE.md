# Factory vs hand-written baseline

Both definitions scored on the same 28 committed cases from `hr_policy_live`, by the same judge.

| | factory | hand-written |
|---|---|---|
| overall | **86%** | **89%** |
| answerable (14) | 100% | 93% |
| edge (8) | 50% | 75% |
| out of scope (6) | 100% | 100% |
| prompt length | 995 chars | 1793 chars |

## Is the difference real?

No. The gap is 4% on 28 cases - about one case - which is within noise. Treating it as a verdict would be the same false precision the prompt tournament refuses, so the honest reading is that the two are equivalent overall.

What is not noise is WHERE they differ. The factory is stronger on straightforward answerable questions; the hand-written prompt is stronger on edge cases, and the reason is visible in the text: it instructs the agent to answer what the context supports and say explicitly what it does not cover, which is exactly what a multi-document question needs. The factory never wrote that sentence.

## Where the factory wins (1)

- `ans_013` — What's the process for filing a grievance according to HR-09?

## Where the hand-written one wins (2)

- `edge_multi_02` — If an employee appeals a grievance decision, within how many working days must the appeal be heard, and how many separate blocks can parental leave be taken with manager agreement?
- `edge_multi_03` — What is the maximum travel expense amount a line manager can approve if they are required to respond to the request within 5 working days?
