#!/usr/bin/env bash
# Resume both demos until each produces a scored report. Each pass banks the
# answers it completes, so attempts converge rather than restarting.
cd "$(dirname "$0")/.." || exit 1
scored() {
  python3 -c "
import json,sys
try: sys.exit(0 if json.load(open('runs/$1_live/06_report.json')).get('evaluated') else 1)
except Exception: sys.exit(1)" 2>/dev/null
}
for i in $(seq 1 10); do
  for demo in hr_policy ship_spares; do
    scored "$demo" && continue
    PYTHONUNBUFFERED=1 .venv/bin/python -u -m forgeai.cli build \
      --brief "demos/$demo/brief.txt" --docs "demos/$demo/docs" \
      --out "runs/${demo}_live" --resume --max-iterations 2 \
      >> "/tmp/finish_$demo.log" 2>&1
  done
  hr=$(scored hr_policy && echo yes || echo no)
  sp=$(scored ship_spares && echo yes || echo no)
  echo "pass $i: hr=$hr spares=$sp"
  [ "$hr" = yes ] && [ "$sp" = yes ] && { echo "both scored"; exit 0; }
  sleep 20
done
echo "stopped after 10 passes"
