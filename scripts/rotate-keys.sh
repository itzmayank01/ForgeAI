#!/usr/bin/env bash
#
# Rotate the API key pool without a key value ever passing through a chat
# transcript, a commit, or this script's output.
#
# Every key this project uses was pasted into an assistant conversation at some
# point, which is how they end up needing rotation in the first place. So the
# rule here is that the new keys are read from a file you write yourself, are
# never echoed, and are matched only by a masked fingerprint (first 8 and last
# 4 characters) when something has to be reported.
#
# Usage:
#   1. Create the new keys in the provider console and revoke the old ones.
#   2. Put the new keys in a file, one per line:
#        $EDITOR new-keys.txt
#   3. ./scripts/rotate-keys.sh new-keys.txt            # local .env only
#      ./scripts/rotate-keys.sh new-keys.txt --vercel   # and the deployment
#
# The file is gitignored, and the script offers to shred it when it finishes.

set -euo pipefail
cd "$(dirname "$0")/.."

KEYFILE="${1:-}"
PUSH_VERCEL=false
[[ "${2:-}" == "--vercel" ]] && PUSH_VERCEL=true

if [[ -z "$KEYFILE" || ! -f "$KEYFILE" ]]; then
  echo "usage: $0 <file-of-new-keys> [--vercel]" >&2
  echo "       one key per line; blank lines and # comments ignored" >&2
  exit 2
fi

BASE_URL="${FORGEAI_BASE_URL:-https://api.groq.com/openai/v1}"
MODEL="${FORGEAI_GEN_MODEL:-openai/gpt-oss-20b}"

mask() { printf '%s…%s' "${1:0:8}" "${1: -4}"; }

# ── read and shape-check ────────────────────────────────────────────────────
# Written for bash 3.2, which is what macOS ships: no mapfile, and an empty
# array expanded under `set -u` is an error rather than nothing.
KEYS=()
while IFS= read -r line; do
  k=$(printf '%s' "$line" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [[ -z "$k" || "$k" == \#* ]] && continue
  body="${k#gsk_}"
  if ! printf '%s' "$body" | grep -qE '^[A-Za-z0-9-]{20,}$'; then
    echo "  REJECT $(mask "$k")  does not look like a key (placeholder or truncated)" >&2
    continue
  fi
  # De-duplicate: a repeated key halves the pool without looking like it has.
  dup=false
  if [[ ${#KEYS[@]} -gt 0 ]]; then
    for seen in "${KEYS[@]}"; do [[ "$seen" == "$k" ]] && dup=true && break; done
  fi
  if [[ "$dup" == true ]]; then
    echo "  SKIP   $(mask "$k")  listed twice"
    continue
  fi
  KEYS+=("$k")
done < "$KEYFILE"

echo "  ${#KEYS[@]} key(s) passed the shape check"
[[ ${#KEYS[@]} -eq 0 ]] && exit 1

# ── live check: a key that cannot answer must not reach the pool ────────────
echo
echo "  verifying against $BASE_URL"
LIVE=()
for k in "${KEYS[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/chat/completions" \
    -H "Authorization: Bearer $k" -H 'Content-Type: application/json' \
    --data-binary '{"model":"'"$MODEL"'","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}')
  if [[ "$code" == "200" || "$code" == "429" ]]; then
    # 429 is a live key that is merely busy; it belongs in the pool.
    echo "    OK   $(mask "$k")  ($code)"
    LIVE+=("$k")
  else
    echo "    DEAD $(mask "$k")  ($code) — left out"
  fi
done

echo
echo "  ${#LIVE[@]} of ${#KEYS[@]} key(s) are live"
if [[ ${#LIVE[@]} -eq 0 ]]; then
  echo "  nothing to install; .env untouched" >&2
  exit 1
fi

# ── rewrite .env ────────────────────────────────────────────────────────────
STAMP=$(date +%Y%m%d-%H%M%S)
cp .env ".env.backup-$STAMP"
echo "  backed up .env -> .env.backup-$STAMP"

# Drop every existing key line, keep everything else exactly as it was.
grep -vE '^[[:space:]]*(FORGEAI_API_KEYS?|FORGEAI_API_KEY_[0-9]+|GROQ_API_KEY(_[0-9]+)?|OPENAI_API_KEY(_[0-9]+)?)=' \
  ".env.backup-$STAMP" > .env

{
  echo ""
  echo "# key pool, rotated $STAMP"
  i=0
  for k in "${LIVE[@]}"; do
    i=$((i + 1))
    if [[ $i -eq 1 ]]; then echo "GROQ_API_KEY=$k"; else echo "GROQ_API_KEY_$i=$k"; fi
  done
} >> .env

echo "  wrote ${#LIVE[@]} key(s) to .env"

# ── optionally push to the deployment ───────────────────────────────────────
if [[ "$PUSH_VERCEL" == true ]]; then
  echo
  echo "  syncing to Vercel production"
  if ! command -v vercel >/dev/null 2>&1; then
    echo "  vercel CLI not installed; skipping" >&2
  else
    # Remove whatever key variables are there now, whatever they are named.
    while read -r name; do
      [[ -z "$name" ]] && continue
      vercel env rm "$name" production --yes >/dev/null 2>&1 \
        && echo "    removed $name" || echo "    could not remove $name"
    done < <(vercel env ls production 2>/dev/null \
             | awk '/API_KEY/ {print $1}')

    i=0
    for k in "${LIVE[@]}"; do
      i=$((i + 1))
      name="FORGEAI_API_KEY"; [[ $i -gt 1 ]] && name="FORGEAI_API_KEY_$i"
      if printf '%s' "$k" | vercel env add "$name" production --yes >/dev/null 2>&1; then
        echo "    added $name"
      else
        echo "    FAILED to add $name" >&2
      fi
    done
    echo "  redeploy for the new values to take effect:  vercel --prod"
  fi
fi

# ── verify the pool the app will actually build ─────────────────────────────
echo
echo "  pool as the CLI now sees it:"
if [[ -x .venv/bin/python ]]; then
  .venv/bin/python -c "
from forgeai.config import _all_keys
print('    %d key(s)' % len(_all_keys()))
"
fi

echo
read -r -p "  shred $KEYFILE now? [y/N] " answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
  if command -v shred >/dev/null 2>&1; then shred -u "$KEYFILE"; else rm -P "$KEYFILE" 2>/dev/null || rm -f "$KEYFILE"; fi
  echo "  removed $KEYFILE"
else
  echo "  left $KEYFILE in place — it is gitignored, but delete it when done"
fi
