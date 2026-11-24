#!/usr/bin/env bash
# Preflight check. Prints status only - never prints key values.
cd "$(dirname "$0")/.." || exit 1
echo "=== ForgeAI doctor ==="
echo "repo:        $(pwd)"

if [ -x .venv/bin/python ]; then
  .venv/bin/python -c "
from forgeai.config import settings
n = len(settings.api_keys)
if n:
    print(f'key pool:    {n} key(s) -> ~{n * 3 * 200:,}k tokens/day across 3 models')
else:
    print('key pool:    NO KEYS. Set FORGEAI_API_KEYS in .env')
" 2>/dev/null || echo "key pool:    could not read config"
else
  echo "key pool:    venv missing"
fi

if [ -x .venv/bin/python ]; then
  .venv/bin/python -c "
from forgeai.config import settings
n = len(settings.api_keys)
print(f'key pool:    {n} key(s) -> ~{n * 3 * 200:,}k tokens/day across 3 models')
" 2>/dev/null
fi

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    echo "github:      logged in as $(gh api user --jq .login 2>/dev/null || echo '?')"
  else
    echo "github:      gh installed but NOT logged in"
  fi
else
  echo "github:      gh NOT installed"
fi

echo "git remote:  $(git remote get-url origin 2>/dev/null || echo 'none')"
echo "commits:     $(git rev-list --count HEAD 2>/dev/null || echo 0)"
echo "venv:        $([ -x .venv/bin/python ] && .venv/bin/python --version || echo 'missing')"

if [ -x .venv/bin/python ]; then
  .venv/bin/python - <<'PY' 2>/dev/null
from forgeai.config import settings
from forgeai.llm.client import LLMClient
try:
    c = LLMClient()
    c.complete([{"role":"user","content":"reply with the single word: ok"}], max_tokens=5)
    print(f"api call:    SUCCESS ({settings.gen_model})")
except Exception as e:
    print(f"api call:    FAILED - {type(e).__name__}: {str(e)[:120]}")
PY
fi
echo "======================"
