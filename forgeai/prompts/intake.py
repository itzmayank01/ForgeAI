"""Intake interviewer prompts (F1).

Decomposed deliberately: a 8B model asked to 'write the requirements document'
in one shot produces mush. Each call has exactly one job.
"""

BASICS = """Read this brief for an AI assistant and state three things.

BRIEF:
{brief}

DOCUMENTS AVAILABLE:
{corpus}

- `scope`: one sentence on what the assistant is for.
- `audience`: who asks it questions, in a few words.
- `tone`: how it should sound, in a few words.
"""

MUST_ANSWER = """List the topics this assistant must be able to answer about.

BRIEF:
{brief}

DOCUMENTS AVAILABLE:
{corpus}

Return 3-6 topics. Each needs a short `name` (2-4 words) and a one-sentence
`description` of what a user would actually ask about it. Draw them from what
the brief asks for and the documents plausibly cover.
"""

MUST_REFUSE = """List the topics this assistant must DECLINE to answer.

BRIEF:
{brief}

Return 2-4 topics. Each needs a short `name` and a one-sentence `description`.
Include every prohibition the brief states explicitly, then the obvious
liability areas for this domain (legal, medical or financial advice, and
anything about a named individual's personal records).
"""

QUESTIONS = """What is genuinely ambiguous about this brief?

BRIEF:
{brief}

DOCUMENTS AVAILABLE:
{corpus}

Return at most 5 questions you would ask the requester before building. Ask
only about real ambiguities that would change the assistant's behaviour. If the
brief is clear, return fewer - an empty list is a valid answer. Never invent
questions to fill the list.
"""

SELF_ANSWER = """You are running UNATTENDED: the requester is not available.

Answer your own clarifying question from the brief and the RETRIEVED EXCERPTS
below. The excerpts are the actual document text - read them before concluding
anything is unspecified.

BRIEF:
{brief}

RETRIEVED EXCERPTS:
{context}

QUESTION:
{question}

Rules:
- If the excerpts answer the question, quote the specific figure or rule and set
  confidence to "high". Do NOT say something is unspecified when it is right
  there in the excerpts.
- If they only partly answer it, say what is known and set confidence "medium".
- Only if the excerpts are genuinely silent, say so and set confidence "low".

Return the question verbatim, your assumed answer, the confidence, and `basis`:
the chunk id or document name that justifies it.
"""
