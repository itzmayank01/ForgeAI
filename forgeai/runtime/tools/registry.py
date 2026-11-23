"""Tool registry (F3).

The factory picks from here. The brief's test is restraint: "an HR agent with a
weather tool is a factory defect". Selection is model-proposed but
deterministically audited - every binding must quote a real requirement.
"""
from __future__ import annotations

import ast
import operator as op
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Callable

import httpx
import pandas as pd


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    when_to_use: str
    fn: Callable[..., Any]


# --- calculator -------------------------------------------------------------
_OPS = {
    ast.Add: op.add, ast.Sub: op.sub, ast.Mult: op.mul, ast.Div: op.truediv,
    ast.Pow: op.pow, ast.USub: op.neg, ast.Mod: op.mod, ast.FloorDiv: op.floordiv,
}


def _eval(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval(node.left), _eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval(node.operand))
    raise ValueError("unsupported expression")


def calculator(expression: str) -> str:
    """AST-walked, not eval() - the agent definition is model-written and must
    never be able to execute arbitrary code."""
    try:
        return str(_eval(ast.parse(expression, mode="eval").body))
    except Exception as exc:  # noqa: BLE001
        return f"error: {exc}"


# --- csv lookup -------------------------------------------------------------
def csv_lookup(file: str, column: str = "", value: str = "", limit: int = 5,
               _root: Path | None = None) -> str:
    try:
        path = (_root / file) if _root else Path(file)
        df = pd.read_csv(path)
        if column and value:
            df = df[df[column].astype(str).str.contains(value, case=False, na=False)]
        if df.empty:
            return "no matching rows"
        return df.head(limit).to_string(index=False)
    except Exception as exc:  # noqa: BLE001
        return f"error: {exc}"


def current_date() -> str:
    return date.today().isoformat()


def weather(latitude: float, longitude: float) -> str:
    """Keyless public API - no secret to leak in a committed agent definition."""
    try:
        r = httpx.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": latitude, "longitude": longitude, "current": "temperature_2m"},
            timeout=10,
        )
        r.raise_for_status()
        cur = r.json().get("current", {})
        return f"{cur.get('temperature_2m')}C at {cur.get('time')}"
    except Exception as exc:  # noqa: BLE001
        return f"error: {exc}"


REGISTRY: dict[str, Tool] = {
    t.name: t for t in [
        Tool("calculator", "Evaluate an arithmetic expression.",
             "Totals, unit conversions, percentages over values found in documents.",
             calculator),
        Tool("csv_lookup", "Query rows from a CSV in the document folder.",
             "Only when the corpus contains tabular data the user queries by field.",
             csv_lookup),
        Tool("current_date", "Today's date, ISO format.",
             "Only when answers depend on what 'today' is - validity windows, expiry.",
             current_date),
        Tool("weather", "Current temperature for a latitude/longitude.",
             "Only when the assistant is genuinely about weather or sailing conditions.",
             weather),
    ]
}


def describe_registry() -> str:
    return "\n".join(
        f"- {t.name}: {t.description}\n    Use when: {t.when_to_use}"
        for t in REGISTRY.values()
    )
