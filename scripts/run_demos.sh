#!/usr/bin/env bash
# Run both demonstrations end to end. Resumable: re-running picks up any
# completed stage and any eval answer already banked.
cd "$(dirname "$0")/.." || exit 1
set -o pipefail
for demo in hr_policy ship_spares; do
  echo "═══ $demo ═══"
  PYTHONUNBUFFERED=1 .venv/bin/python -u -m forgeai.cli build \
    --brief "demos/$demo/brief.txt" \
    --docs "demos/$demo/docs" \
    --out "runs/${demo}_live" \
    --resume --max-iterations 2 2>&1 | grep -vE "Loading weights|redirects.py|HF Hub"
done
