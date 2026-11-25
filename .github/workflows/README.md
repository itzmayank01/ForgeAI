# CI

Two jobs, both offline.

`python` lints, runs the test suite, and runs `scripts/audit.py` — which checks
the repository against all nine core requirements by reading the committed run
artifacts. A core requirement with no evidence behind it fails the build, so the
claim in the README cannot drift from what is actually in `runs/`.

`web` typechecks and builds the Next.js app.

Nothing here needs an API key. Every test that matters is offline by design: a
suite that needs a paid provider is a suite nobody runs.
