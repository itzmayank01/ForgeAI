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
