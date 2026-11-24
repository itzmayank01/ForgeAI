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

QUESTIONS = """What would you need to ask before building this assistant?

BRIEF:
{brief}

DOCUMENTS AVAILABLE:
{corpus}

Real briefs are always underspecified. Look specifically for:
- Boundaries: who is in and out of the audience? Are there adjacent groups the
  brief neither includes nor excludes?
- Detail: should it quote exact figures from the documents, or direct people
  elsewhere?
- Conflicts: what should it do when two documents disagree, or a document is
  out of date?
- Gaps: what will users obviously ask that these documents do not cover?

Return 2-5 questions whose answers would genuinely change how the assistant
behaves. Ask about THIS brief and THESE documents, never generic questions.
Do not pad the list, and do not return an empty one - a brief this short always
leaves something open.
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
