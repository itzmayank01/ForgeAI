# Demo corpus synthesis prompts

The brief permits LLM-synthesized documents and requires the synthesis prompts
to be committed. These are those prompts, verbatim.

Both corpora are deliberately dissimilar - different domains, different file
types (prose vs tabular), different tool needs (none vs calculator + csv_lookup)
- because the point of two demos is to show the factory is not tuned to one
shape of problem.

## HR policy corpus

> Write an internal HR policy document for a shipping company's **shore-based**
> staff, titled `{title}`. Cover {topics}. Use specific, checkable numbers
> throughout: day counts, percentages, currency amounts, deadlines in working
> days. Write it as a real policy document with numbered clauses - no preamble,
> no commentary. 500-700 words. Do NOT mention stock options, equity or
> share schemes: their absence is a deliberate test of the groundability guard.

Documents generated: `leave_policy.md`, `travel_expenses.md`, `grievance_procedure.md`.

## Ship spares corpus

> Generate a CSV parts catalogue for a marine spares supplier with columns
> `part_number, description, category, unit_price_eur, lead_time_days,
> stock_qty, supplier`. 40 rows across pumps, valves, filters, seals and
> electrical. Prices 12-4800 EUR, lead times 2-120 days. Use three suppliers:
> Nordhavn Marine, Kowloon Diesel Parts, Adriatic Supply.

> Write a supplier agreement for `{supplier}` covering minimum order quantity,
> volume discount tiers, payment terms, warranty period, and the returns
> process. Specific numbers throughout. 300-400 words, numbered clauses.

Documents generated: `parts_catalogue.csv`, `supplier_nordhavn.md`,
`supplier_kowloon.md`.

## Why these two

| | HR policy | Ship spares |
|---|---|---|
| File types | markdown prose | CSV + markdown |
| Expected tools | **none** | `csv_lookup`, `calculator` |
| Groundability trap | equity/stock questions | delivery-date commitments |
| Refusal surface | legal advice, individual records | supplier recommendations |

The HR run attaching a `csv_lookup` or `weather` tool would be a factory defect,
and `tests/test_tool_discipline.py` asserts exactly that against the committed
definitions.
