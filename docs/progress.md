# Progress Log

One row per week. A snapshot is written after the weekly run, not during it. Empty cells stay empty rather than being estimated.

| Date | Phase | Gate | Metric | What went wrong |
|---|---|---|---|---|
| 2026-11-19 | Phase 0 - Foundation | passed: 18 tests green, 4 consecutive green CI runs on the same commit, 15 seeded-bug checks green under SEEDED_BUGS=all | 33 tests, 18 active + 15 seeded-bug checks, 0 skipped without a reason, 0 retries | First CI run failed for two real reasons: parallel workers raced on the shared in-memory reset, and the login helper did not wait for the token. Both were fixed, not retried. |

## How to read this

- **Gate**: the exit gate for the phase, as defined in `docs/plan.md`. "not yet run" means the gate has not been evaluated this week.
- **Metric**: the single number the phase tracks. Use a placeholder until a real run produces a value. Do not backfill or estimate.
- **What went wrong**: one honest line. "none yet" is acceptable only before the first run.
