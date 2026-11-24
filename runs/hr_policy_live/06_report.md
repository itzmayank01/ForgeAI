# ForgeAI run report - hr_policy_live

**Brief.** I need an assistant that answers HR policy questions for shore staff - annual
leave and carry-over, parental leave, travel expense reimbursement, and how to
raise a grievance. It should sound plain and reassuring, never give legal advice,
and never discuss an individual employee's salary or disciplinary record.

> **Not scored.** No evaluation pass completed, so this run has no pass rate. Stopped because: incomplete eval pass (resume to finish).

> Reporting 0% here would be a fabricated number. Re-run with `--resume` to finish the suite.

Budget: 0/500,000 tokens, 164.8s/2400s, 0/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|

## What still fails

No residual failures. Treat a 100% score with suspicion: check the eval suite's gate report for how many cases were dropped, and the judge calibration below before believing it.

## Judge calibration

Not calibrated. Every number above is unverified - run `forgeai calibrate` against a hand-labelled gold set before trusting this report.

## Final agent definition

- Tools: none
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1