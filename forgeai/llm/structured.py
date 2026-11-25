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

from .client import LLMClient, LLMError, QuotaExhausted

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


def _balanced_objects(text: str) -> list[str]:
    """Every top-level {...} in the text, in order."""
    out: list[str] = []
    depth = start = 0
    in_str = esc = False
    for i, ch in enumerate(text):
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
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and depth:
            depth -= 1
            if depth == 0:
                out.append(text[start : i + 1])
    return out


def _looks_like_schema_echo(blob: str) -> bool:
    """A JSON Schema repeated back instead of an instance of it.

    Small models do this: they emit the schema, then the real payload. Taking
    the first object found means silently accepting the schema - and because
    list fields carry a default_factory, it validates as EMPTY rather than
    failing. A correct tool selection became "no tools attached" with no error
    anywhere.
    """
    return '"properties"' in blob and '"type"' in blob


def extract_json(text: str) -> str | None:
    """The first plausible JSON object, skipping a schema echo."""
    if not text:
        return None
    m = _FENCE.search(text)
    if m:
        text = m.group(1)
    objects = _balanced_objects(text.strip())
    if not objects:
        return None
    for blob in objects:
        if not _looks_like_schema_echo(blob):
            return blob
    return objects[0]


def extract_json_candidates(text: str) -> list[str]:
    """All candidates, best first, for callers willing to try several."""
    if not text:
        return []
    m = _FENCE.search(text)
    if m:
        text = m.group(1)
    objects = _balanced_objects(text.strip())
    real = [b for b in objects if not _looks_like_schema_echo(b)]
    return real + [b for b in objects if b not in real]


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
    max_tokens: int = 1100,
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
        try:
            raw = client.complete(
                messages, model=model, temperature=temperature,
                json_mode=True, max_tokens=max_tokens,
            )
        except QuotaExhausted:
            raise  # a daily cap must stop the run, not degrade it silently
        except LLMError as exc:
            # The whole design rests on callers having a deterministic fallback.
            # Propagating here would let one unlucky call kill a 20-minute run,
            # which is exactly the failure mode the fallbacks exist to prevent.
            trace.errors.append(str(exc)[:200])
            if attempt >= max_repairs:
                return None, trace
            continue
        candidates = extract_json_candidates(raw)
        if not candidates:
            trace.errors.append("no JSON object found in completion")
        else:
            last_error = None
            for candidate in candidates:
                if candidate.strip() != raw.strip():
                    trace.salvaged = True
                try:
                    obj = model_cls.model_validate_json(candidate)
                    trace.ok = True
                    return obj, trace
                except ValidationError as ve:
                    last_error = "; ".join(
                        f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}"
                        for e in ve.errors()[:6]
                    )
            if last_error:
                trace.errors.append(last_error)

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
