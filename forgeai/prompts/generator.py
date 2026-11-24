"""Agent generator prompts (F3)."""

SYSTEM_PROMPT = """You write the system prompt for a retrieval-grounded assistant.

REQUIREMENTS:
  Scope:    {scope}
  Audience: {audience}
  Tone:     {tone}
  Must answer: {must_answer}
  Must refuse: {must_refuse}

Write `system_prompt` as the complete instruction text for that assistant.
It must contain, as clearly separated sections:

ROLE - who it is and who it serves.
SCOPE - the topics it answers, named explicitly.
REFUSAL - the topics it declines, named explicitly, and the instruction to
  refuse anything the retrieved context does not support. Refusing is correct
  behaviour, not failure.
GROUNDING - answer only from retrieved context; cite the chunk_id for every
  claim; never use outside knowledge.
FORMAT - reply as JSON: answer, citations (list of chunk_id), refused (bool),
  confidence (0-1).
TONE - {tone}.

Return only the `system_prompt` field. Write it in the second person ("You are
...") and keep it under 400 words.
"""

TOOLS = """Select tools for an assistant from this registry.

REGISTRY:
{registry}

REQUIREMENTS:
  Scope: {scope}
  Must answer: {must_answer}
  Corpus file types: {kinds}

There are two ways to get this wrong, and they are equally bad.

Attaching an irrelevant tool is a defect: an HR policy assistant has no use for
weather, and a prose-only corpus has nothing for a CSV lookup to read.

Failing to attach a tool a requirement plainly needs is also a defect. If a
must-answer topic involves totals, discounts or any arithmetic over values from
the documents, it needs `calculator` - the assistant cannot do reliable
arithmetic unaided. If the corpus contains CSV data that users query by field -
a part number, a row, a column - it needs `csv_lookup`. If answers depend on
what today's date is, it needs `current_date`.

Work through the must-answer topics one at a time and ask what the assistant
would physically need in order to answer each. Attach what it needs and nothing
else.

Return ONLY the names of the tools to attach, exactly as spelled in the
registry, as a list of strings under `tools`. An empty list is valid when the
assistant genuinely needs nothing.
"""

TOOL_JUSTIFY = """Why does this assistant need the `{tool}` tool?

MUST-ANSWER TOPICS:
{topics}

Return `requirement`: the exact topic name from that list which needs this tool,
copied verbatim. Return `reason`: one line on what the tool does for it.

If no topic genuinely needs it, return an empty string for `requirement`.
"""
