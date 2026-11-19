# Progress Log

One row per week. A snapshot is written after the weekly run, not during it. Empty cells stay empty rather than being estimated.

| Date | Phase | Gate | Metric | What went wrong |
|---|---|---|---|---|
| 2026-11-19 | Phase 0 - Foundation | passed: 18 tests green, 4 consecutive green CI runs, 15 seeded-bug checks green | 33 tests, 0 retries | First CI run failed: workers raced on the in-memory reset, and the login helper did not wait for the token. Both fixed. |
| 2026-11-19 | Phase 1 - AI-assisted | passed: 5 reviewed cases, 2 rejected | review time 37 min for 5 cases | A locator fix was proposed for a test that did not exist. |
| 2026-11-19 | Phase 2 - Single agent | passed: 13 correct runs in a row | 17/20 correct, 60-90% across three iterations | First batch died with its shell; checkout stayed at 2/5. |
| 2026-11-19 | Phase 3 - Agent team | passed: 4/5 bugs found, 0 misclassified | 1 miss recorded, not repaired | A generated test asserted a precondition about its own data. |
| 2026-11-19 | Phase 4 - Reviewer | passed: 21/22 shadow cases agree | 6/6 weakened, 2/2 deleted caught | One comment-only diff was rejected: the suite over-specifies its requirements. |
| 2026-11-19 | Phase 5 - Scale and release | passed: 30/30 selection coverage, high-risk refused | 25s full vs 16s sharded | Only 2 of 30 change sets were executed for real. |

## How to read this

- **Gate**: the exit gate for the phase, as defined in `docs/plan.md`. "not yet run" means the gate has not been evaluated this week.
- **Metric**: the single number the phase tracks. Use a placeholder until a real run produces a value. Do not backfill or estimate.
- **What went wrong**: one honest line. "none yet" is acceptable only before the first run.
