# Running ForgeAI at the review

The brief's condition: *"an unseen brief and document folder, run unattended in
front of us."* This is what to do, what to expect, and what to say when
something goes wrong — written before the day, so none of it has to be improvised.

## Before they arrive

```bash
./scripts/doctor.sh
```

Checks the key pool, the venv, the git remote and makes one live API call. If
`api call: SUCCESS` you are ready. If the key pool shows fewer keys than you
expect, `.env` is the only place to fix it.

```bash
forgeai budget --docs <their folder>
```

Projects the run's token cost **per model** before spending anything, and probes
live quota. Caps are per model, so what matters is whether any single bucket
overflows — not the total. Run this while they are still talking.

## The run

```bash
forgeai build --brief <their_brief.txt> --docs <their_folder>
```

Unattended by default. It asks its clarifying questions, answers them itself
from retrieved document text, and records each as an assumption with a
confidence and the chunk that justified it. Add `--interactive` only if they ask
to be interviewed.

Expect roughly **2–10 minutes** depending on corpus size and quota. The stage
line tells them where it is. On the rehearsal corpus it completed in 131 seconds.

## What to point at while it runs

| Stage | What to say |
|---|---|
| `[2/6] groundability` | "It is checking the documents can actually support the brief before building anything. Topics they cannot support get demoted to must-refuse, so the agent declines them by construction rather than inventing an answer." |
| `[3/6] generating` | "Tools are model-proposed but deterministically audited — a binding only survives if it can cite a real requirement." |
| `[4/6] eval suite` | "These tests come from the documents, not from the prompt it just wrote. That module cannot even import the agent definition." |
| `gate: kept N/M` | "The gate drops cases that would make the suite a rubber stamp — including out-of-scope questions the corpus can actually answer, which would teach the optimizer to refuse everything." |
| `[5/6] loop` | "One targeted fix per iteration, aimed at the largest failure cluster. Anything that loses ground is reverted." |

## Afterwards

```bash
forgeai chat --run runs/<their_run>
```

Talk to the agent they just watched being built. Ask it something in scope, then
something out of scope — the refusal is the more interesting half.

```bash
python scripts/audit.py
```

Checks the repository against all nine core requirements from the committed
artifacts, not from claims.

## If something goes wrong

**It stops saying "quota exhausted".** Free-tier caps are per key, per model,
per day, and the window drips rather than resetting. Say so, then
`forgeai build … --resume`: every answer already obtained is banked, so it
continues rather than restarting.

**A stage falls back.** The log says which (`intake: fell back on …`). The run
continues on deterministic defaults. This is designed behaviour — point out that
the alternative is a factory that dies on one bad model response.

**The score looks low.** That is the honest case. The report names every
residual failure and why. The brief's own line is that a factory explaining its
78% is worth more than one claiming 100%.

**It claims 100%.** Treat it as suspicious in front of them, and say so. Check
the gate report for how many cases were dropped and whether the judge was
calibrated. A clean sweep on a thin suite means the suite, not the agent.

## What to be upfront about

- **The judge is imperfect and measured.** HR calibrates at 80% agreement with
  hand labels (kappa 0.55); the spares judge once measured **kappa 0.00** — no
  better than chance. That number is in the repository because it is what
  exposed the dangling-referent bug in eval generation.
- **The hosted chat is reduced.** BM25 instead of dense retrieval, and no tool
  execution. The CLI is the reference implementation and every published score
  came from it.
- **Both demos reverted every fix they tried.** Neither beat the definition the
  generator produced first. That is a result, not a gap — the loop established
  that the baseline was already at its best.
