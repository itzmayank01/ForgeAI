# ForgeAI run report - ship_spares_live

**Brief.** Build me a procurement assistant for our ship spares desk. It should answer
questions about part availability, prices and lead times from the parts
catalogue, and about supplier terms, minimum order quantities and warranty
conditions from the supplier agreements. It needs to work out order totals.
Purchasing officers use it. It must not recommend one supplier over another or
commit to a delivery date it cannot evidence.

> **Not scored.** No evaluation pass completed, so this run has no pass rate. Stopped because: incomplete eval pass (resume to finish).

> Reporting 0% here would be a fabricated number. Re-run with `--resume` to finish the suite.

Budget: 0/500,000 tokens, 252.8s/2400s, 0/2 iterations.

## Per-iteration scorecard

| iter | pass rate | passed/total | answerable | out of scope | edge | LLM-escalated |
|---|---|---|---|---|---|---|

## What still fails

No residual failures. Treat a 100% score with suspicion: check the eval suite's gate report for how many cases were dropped, and the judge calibration below before believing it.

## Judge calibration

Not calibrated. Every number above is unverified - run `forgeai calibrate` against a hand-labelled gold set before trusting this report.

## Final agent definition

- Tools: csv_lookup, calculator
- Retrieval: dense, chunk 800/120, top_k 5, min_score 0.25
- Temperature: 0.1