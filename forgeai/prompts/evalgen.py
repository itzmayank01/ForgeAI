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

ONE claim per fact. "The secondary caregiver is entitled to 4 weeks of fully
paid parental leave, which must be taken within 12 months" is TWO facts and must
be split: the entitlement, and the window. Bundling them makes a correct answer
to one of them look like a failure.

Return 2-4 facts. Each needs `fact` (the claim, verbatim where possible) and
`chunk_id` (exactly "{chunk_id}"). If the excerpt contains no checkable facts,
return an empty list.
"""

FACT_TO_QUESTION = """Write the question a real user would ask to elicit this fact.

FACT: {fact}
FROM: {filename}

Rules:
- Ask it the way a {audience} actually would, in their own words.
- Do not quote the ANSWER back. If the fact says "22 days", ask "how much annual
  leave do I get?", never "is annual leave 22 days?".
- The question must stand alone. Name whatever it is about - the part number,
  the policy, the supplier. Never "this part", "that item" or "its price": with
  no conversation history there is nothing for those to refer to, the question
  has no answer, and refusing it is the only correct behaviour.
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
question.

If the two facts are about unrelated things and no sensible question joins them,
return the single word SKIP as the question. Forcing them together produces a
question nobody can answer, and the agent is then penalised for correctly
refusing it. One sentence otherwise.

Return `question` and `difficulty`.
"""

AMBIGUOUS = """Rewrite this question so it is genuinely ambiguous but still answerable.

ORIGINAL: {question}

Make the PHRASING vague while keeping the question answerable: informal wording,
an abbreviation, a dropped qualifier, an indirect way of asking.

The subject must still be named. "What\'s the lead time for that part?" is not
an ambiguous question, it is an unanswerable one - there is no conversation
history, so nothing tells the assistant which part. Refusing it is correct, and
scoring that refusal as a failure teaches the optimizer exactly the wrong
lesson. Keep the part number, policy name or supplier in the question.

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


COMPUTATION = """Write a question that requires ARITHMETIC over values in this excerpt.

DOCUMENT: {filename}
CHUNK {chunk_id}:
{text}

The answer must not be readable straight from the text. It has to be computed -
a total, a multiple, a difference, a percentage - from figures the excerpt
states.

Good: "What is the total for 12 units at the listed unit price?"
Bad:  "What is the unit price?" (that is a lookup, not a computation)

Return `question`, `expected` (the computed answer as a plain number, no units
or currency symbol), and `difficulty`.

If the excerpt has no figures worth combining, return SKIP as the question.
"""
