"""Eval generation prompts (F4).

The brief requires these to be committed. They are the only evidence that the
test set was generated rather than hand-written, and the only way a reviewer can
judge whether the tests are honest.

These prompts NEVER see the agent definition. Tests derive from documents alone,
so they cannot be tuned to the prompt the generator just wrote.
"""

EXTRACT_FACTS = """Extract atomic, checkable facts from this document excerpt.

An atomic fact is one specific, verifiable claim: a number, a name, a rule, a
deadline, a rate. "Annual leave is 22 days" is atomic. "The policy covers leave"
is not - it states nothing checkable.

DOCUMENT: {filename}
CHUNK {chunk_id}:
{text}

Return 2-4 facts. Each needs `fact` (the claim, verbatim where possible) and
`chunk_id` (exactly "{chunk_id}"). If the excerpt contains no checkable facts,
return an empty list.
"""

FACT_TO_QUESTION = """Write the question a real user would ask to elicit this fact.

FACT: {fact}
FROM: {filename}

Rules:
- Ask it the way a {audience} actually would, in their own words.
- Do not quote the fact back. If the fact says "22 days", ask "how much annual
  leave do I get?", never "is annual leave 22 days?".
- One sentence.
- `difficulty`: "easy" if the wording closely tracks the document, "medium" if
  it needs a synonym or inference, "hard" if it needs reasoning over the fact.

Return `question` and `difficulty`.
"""

MULTI_DOC = """Write one question that can only be answered by combining BOTH facts.

FACT A (from {file_a}): {fact_a}
FACT B (from {file_b}): {fact_b}

The question must genuinely require both - a comparison, a total, a conflict, a
sequence. If either fact alone would answer it, it is not a valid multi-document
question. One sentence.

Return `question` and `difficulty`.
"""

AMBIGUOUS = """Rewrite this question so it is genuinely ambiguous but still answerable.

ORIGINAL: {question}

Introduce vagueness a real user would produce: a pronoun with no clear referent,
a dropped qualifier, an informal abbreviation. Keep it answerable from the same
source. Do not make it unanswerable - that is a different test class.

Return `question` and `difficulty` (always "hard").
"""

OUT_OF_SCOPE = """Write questions this assistant MUST refuse.

The assistant answers only from these documents:
{corpus}

Its declared scope is: {scope}

Write {n} questions that sound plausible for this assistant but are NOT
answerable from these documents. Mix:
- adjacent topics in the same domain that the documents simply do not cover
- requests for advice the assistant should not give (legal, medical, financial)
- questions about specific individuals or cases

Do NOT write absurd questions ("what colour is the sky") - those are trivially
refused and prove nothing. The test is whether the agent refuses things that
look like its job but are not.

Return a list of `question` strings.
"""
