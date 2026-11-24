#!/usr/bin/env bash
# Chip away at a run on a dripping quota. Each attempt banks whatever cases it
# completes, so progress is monotonic; sleeping between attempts lets the daily
# window refill rather than burning retries against a wall.
cd "$(dirname "$0")/.." || exit 1
RUN="${1:-runs/hr_policy_live}"
BRIEF="${2:-demos/hr_policy/brief.txt}"
DOCS="${3:-demos/hr_policy/docs}"
MAX="${4:-14}"

for i in $(seq 1 "$MAX"); do
  before=$(python3 -c "
import json,glob
n=0
for f in glob.glob('$RUN/05_iterations/*/responses.json'):
    n+=len(json.load(open(f)))
print(n)" 2>/dev/null || echo 0)

  PYTHONUNBUFFERED=1 .venv/bin/python -u -m forgeai.cli build \
    --brief "$BRIEF" --docs "$DOCS" --out "$RUN" --resume --max-iterations 2 \
    >> /tmp/grind_$(basename "$RUN").log 2>&1

  after=$(python3 -c "
import json,glob
n=0
for f in glob.glob('$RUN/05_iterations/*/responses.json'):
    n+=len(json.load(open(f)))
print(n)" 2>/dev/null || echo 0)

  echo "attempt $i: $before -> $after answers"

  if [ -f "$RUN/06_report.json" ] && python3 -c "
import json,sys
sys.exit(0 if json.load(open('$RUN/06_report.json')).get('evaluated') else 1)" 2>/dev/null; then
    echo "run scored — done"; exit 0
  fi
  [ "$after" = "$before" ] && sleep 180 || sleep 45
done
echo "stopped after $MAX attempts"
