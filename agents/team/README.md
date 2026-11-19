# Team flow (Phase 3)

Five roles run in order on one requirement, with the seeded bug enabled for the detection runs. The point is not that the agents agree; it is that the browser decides.

## Flow

1. **Planner** - reads the requirement and the contract, returns areas, one planned test per requirement, and a risk level.
2. **Generator** - writes one Playwright test into `tests/generated/`, validated by the same rules as Phase 2.
3. **Executor** - runs the test twice over: once clean, once with the seeded bug enabled, three times for repeat evidence.
4. **Healer** - on a failure, returns a diagnosis and the smallest diff. It never applies or approves it.
5. **Failure Analysis** - classifies from the repeat runs: product bug, test bug, environment, flaky, or unknown.

## What counts as a finding

Detection is decided by the browser, not by an agent:

- **detected**: the test passes clean and fails at least once with the bug enabled.
- **missed**: the test fails clean (bad test), or passes with the bug enabled (blind test).
- **misclassified**: Failure Analysis calls a reproducible failure "flaky".

## Seeded-bug state

The app reads `QA_SEEDED_BUGS` at start, so each run gets its own server and its own port. Playwright's `reuseExistingServer` is off: a reused server would keep the previous bug configuration and quietly invalidate every result.

`SEEDED_BUGS` still gates the seeded-bug spec file and is passed to the app only when `QA_SEEDED_BUGS` is unset, so the two mechanisms cannot cross.

## Run

```bash
QA_LLM_KEY_FILE=/path/to/key node agents/team/run-flow.js --all --port 3300
```

Each case writes a JSONL line to `runs/phase3/`, including per-stage output, the generated file, and the executor's pass counts. Misses are recorded, not retried.
