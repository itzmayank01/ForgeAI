"""Judge prompts (F5).

Used only for the ambiguous residue that deterministic checks cannot settle.
Note what is NOT in these prompts: the agent's system prompt, its version
number, and any other answer to compare against. The judge cannot prefer its own
style, cannot be swayed by position, and has no length signal to reward.
"""

ENTAILMENT = """Does the ANSWER state the FACT? Judge meaning, not wording.

FACT: {fact}

ANSWER: {answer}

Return `entailed` true only if a careful reader would agree the answer conveys
that fact. Paraphrase is fine. A partially correct number is not. Silence about
the fact is not. Return `reason` in under 15 words.
"""

GROUNDED = """Is this CLAIM supported by the CONTEXT?

CONTEXT:
{context}

CLAIM: {claim}

Return `supported` true only if the context states or directly implies the
claim. General plausibility is not support. If the claim adds specifics the
context does not contain, it is unsupported. Return `reason` in under 15 words.
"""
