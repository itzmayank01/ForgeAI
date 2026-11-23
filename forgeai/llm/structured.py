"""Schema-constrained generation with a repair loop.

A 7-8B model free-generating JSON fails constantly: markdown fences, trailing
prose, single quotes, missing required fields. Every structured call therefore
goes: ask -> salvage -> validate -> feed the validation error back -> retry.
Nothing downstream ever parses free text.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from .client import LLMClient

T = TypeVar("T", bound=BaseModel)

_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


@dataclass
class RepairTrace:
    """Per-call evidence of how hard the model had to be pushed. Aggregated into
    the spike report and the run log."""

    attempts: int = 0
    errors: list[str] = field(default_factory=list)
    salvaged: bool = False
    ok: bool = False


def extract_json(text: str) -> str | None:
    """Pull the first plausible JSON object out of a messy completion."""
    if not text:
        return None
    m = _FENCE.search(text)
    if m:
        text = m.group(1)
    text = text.strip()
    start = text.find("{")
    if start == -1:
        return None
    depth, in_str, esc = 0, False, False
    for i, ch in enumerate(text[start:], start):
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def compact_schema(model_cls: type[BaseModel]) -> str:
    """Flatten $defs so a small model sees one readable shape, not a ref graph."""
    schema = model_cls.model_json_schema()
    defs = schema.pop("$defs", {})

    def resolve(node, depth=0):
        if depth > 6 or not isinstance(node, (dict, list)):
            return node
        if isinstance(node, list):
            return [resolve(x, depth + 1) for x in node]
        if "$ref" in node:
            name = node["$ref"].split("/")[-1]
            return resolve(defs.get(name, {}), depth + 1)
        return {
            k: resolve(v, depth + 1)
            for k, v in node.items()
            if k not in {"title", "additionalProperties"}
        }

    return json.dumps(resolve(schema), indent=1)


def structured(
    client: LLMClient,
    *,
    instruction: str,
    model_cls: type[T],
    system: str = "You output JSON only. No prose, no markdown fences.",
    model: str | None = None,
    temperature: float = 0.0,
    max_repairs: int = 2,
) -> tuple[T | None, RepairTrace]:
    """Return a validated instance, or (None, trace) after exhausting repairs.

    Callers MUST handle None with a deterministic fallback - the pipeline has to
    finish even when a stage's model output is unusable.
    """
    trace = RepairTrace()
    messages = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": (
                f"{instruction}\n\n"
                f"Reply with a single JSON object matching this schema:\n"
                f"{compact_schema(model_cls)}\n\n"
                f"Output ONLY the JSON object."
            ),
        },
    ]

    for attempt in range(max_repairs + 1):
        trace.attempts = attempt + 1
        raw = client.complete(
            messages, model=model, temperature=temperature, json_mode=True
        )
        candidate = extract_json(raw)
        if candidate is None:
            trace.errors.append("no JSON object found in completion")
        else:
            if candidate.strip() != raw.strip():
                trace.salvaged = True
            try:
                obj = model_cls.model_validate_json(candidate)
                trace.ok = True
                return obj, trace
            except ValidationError as ve:
                errs = "; ".join(
                    f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}"
                    for e in ve.errors()[:6]
                )
                trace.errors.append(errs)

        if attempt < max_repairs:  # feed the failure back and try again
            # A reasoning model can return empty content (it spent the budget
            # thinking). An empty assistant turn is rejected with a 400, so
            # substitute a marker rather than echoing nothing back.
            echoed = raw[:1500].strip() or "(empty response)"
            messages += [
                {"role": "assistant", "content": echoed},
                {
                    "role": "user",
                    "content": (
                        f"That was invalid: {trace.errors[-1]}\n"
                        f"Return ONLY a corrected JSON object. No other text."
                    ),
                },
            ]
    return None, trace
