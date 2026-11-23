"""Intake interviewer prompts (F1).

Decomposed deliberately: a 8B model asked to 'write the requirements document'
in one shot produces mush. Each call has exactly one job.
"""

DRAFT = """You are an intake interviewer for an agent factory.

A requester wants an AI assistant built over a document collection.

BRIEF:
{brief}

DOCUMENT COLLECTION:
{corpus}

Write the structured requirements document.

Rules:
- `scope`: one sentence on what the assistant is for.
- `audience`: who asks it questions.
- `tone`: how it should sound.
- `must_answer`: 3-6 topics the documents should cover. Each needs a short
  `name` and a one-sentence `description` of what a user would ask about it.
- `must_refuse`: 2-4 topics it must decline, taken from the brief's explicit
  prohibitions plus obvious liability areas (legal, medical, financial advice).
- `questions_asked`: at most 5 genuine ambiguities in the brief. If the brief
  is clear, return fewer. Never invent questions to fill the list.
- `brief`: copy the brief verbatim.
- `mode`: "{mode}"
- Leave `assumptions` and `corpus_manifest` empty.
"""

SELF_ANSWER = """You are running UNATTENDED: the requester is not available.

Answer your own clarifying question using only the brief and the document list.
Be concrete. If the evidence is thin, say so and set confidence to "low".

BRIEF:
{brief}

DOCUMENTS:
{corpus}

QUESTION:
{question}

Return the question verbatim, your assumed answer, a confidence of
"high"/"medium"/"low", and `basis`: the specific brief phrase or document name
that justifies it.
"""
