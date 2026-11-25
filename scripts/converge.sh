#!/usr/bin/env bash
# Drive both demos to a scored report, patiently.
#
# The free tier's daily token budget does not reset at midnight; it drips as old
# usage ages out of a rolling window, at roughly 140 tokens/minute per account.
# So a pass that cannot finish now may finish in twenty minutes, and a 429 costs
# nothing - the request is refused before it is billed. Retrying patiently is
# therefore strictly better than failing, and every pass banks the answers it
# completes, so attempts converge rather than restart.
#
# Commits and pushes on each green step, which is the point: a scored report
# nobody can see is not a deliverable.
cd "$(dirname "$0")/.." || exit 1
PASSES=${PASSES:-48}
GAP=${GAP:-900}

scored() {
  .venv/bin/python -c "
import json,sys
try: sys.exit(0 if json.load(open('runs/$1_live/06_report.json')).get('evaluated') else 1)
except Exception: sys.exit(1)" 2>/dev/null
}

for i in $(seq 1 "$PASSES"); do
  for demo in hr_policy ship_spares; do
    # Skip a demo that already has a scored report. Without this the loop
    # re-ran a finished run every pass, spending the daily budget the UNscored
    # demo needed - and overwriting the finished run's artifacts while doing it.
    if scored "$demo"; then
      echo "[pass $i] $demo already scored; skipping"
      continue
    fi
    before=no
    PYTHONUNBUFFERED=1 .venv/bin/python -u -m forgeai.cli build \
      --brief "demos/$demo/brief.txt" --docs "demos/$demo/docs" \
      --out "runs/${demo}_live" --resume --max-iterations 2 \
      >> "/tmp/converge_$demo.log" 2>&1
    after=$(scored "$demo" && echo yes || echo no)
    if [ "$before" = no ] && [ "$after" = yes ]; then
      echo "[pass $i] $demo became scored; committing"
      git add runs gold && git commit -q -m "Run: ${demo}_live scored

Produced by scripts/converge.sh, which resumes until the free-tier daily budget
allows a pass to finish. Answers, verdicts and scorecard are the run's own
artifacts; the signature on each cache records the runtime and model that
produced them.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" && git push -q origin main \
        && echo "[pass $i] pushed"
    fi
  done
  if scored hr_policy && scored ship_spares; then
    echo "[pass $i] both scored; done"; exit 0
  fi
  echo "[pass $i] hr=$(scored hr_policy && echo yes || echo no) spares=$(scored ship_spares && echo yes || echo no); waiting ${GAP}s"
  sleep "$GAP"
done
echo "stopped after $PASSES passes"
