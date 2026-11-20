# Phase 5 - scaling and conditional release

## What was built

- `agents/release/select.js`: an explicit file-to-area-to-test map, a risk classification, and an auto-approval decision. The map is written down rather than inferred, because a silent gap in a derived map is the failure this phase exists to prevent.
- `docs/release-policy.md`: what counts as low, medium and high risk, who approves each, the gates before release, the cost cap, and the kill switch.
- `agents/release/simulate.js`: 30 generated change sets scored for selection coverage.

## Selection

| Metric | Result |
|---|---|
| Change sets | 30 |
| Selection covers every required test | 30 / 30 |
| Missing tests | 0 |
| High-risk sets (refused auto-approval) | 8 |
| Sets refused auto-approval overall | 11 |

`app/server.js` is classified high and never auto-approved, even though every test would run: auth, totals and deletion are human-only by policy, not by test outcome.

## Executed checks: selected versus full

Two changes were run for real with a seeded bug enabled:

| Change | Bug | Selected result | Caught | Missed vs full |
|---|---|---|---|---|
| cart area | BUG-12 stale total after remove | 1 failed, 4 passed | yes | no |
| checkout area | BUG-01 double tax | 3 failed, 2 passed | yes | no |

Both defects were caught by the impacted-area run alone. The full suite catches the same two; the comparison is about not losing a defect, not about finding more.

## Time

| Run | Time | Tests |
|---|---|---|
| Full suite | 25 s | 24 |
| Shard 1 / 2 | 16 s | 19 |
| Shard 2 / 2 | 11 s | 5 |
| Sharded wall time (two shards in parallel) | 16 s | 24 |

Sharding is Playwright's `--shard` flag, measured locally. It is not wired into the workflow yet.

## Gate

- High-risk change refused and escalated: yes, `app/server.js` is high and requires a human.
- No seeded defect missed in impacted-area runs: yes for the two executed changes; the batch is small.
- Cost and time recorded: time above; cost is zero model tokens for selection, and the Reviewer's judgement is capped at 1,500 completion tokens per call by the policy.
- Release policy merged as a document: yes, `docs/release-policy.md`.

## Where this phase is thinner than the plan

- The plan asks for 30-50 **generated** changes with measured selection accuracy. This batch is 30 change sets, but the accuracy is coverage of a hand-written map, not a measured defect-loss rate across real code changes.
- Only two change sets were actually executed. A 30-set execution would take about 20 minutes and was not run.
- LLM-as-judge exists only as the Reviewer's model check; there is no separate judge with its own budget accounting.
- Sharding is measured, not enforced in CI.
- This is a demo-scale simulation, exactly as the plan says it should be; nothing here claims production scale.

## Verdict

The phase meets its gate on paper and on the two executed comparisons, but the evidence is thinner than the plan intends. Recorded as such rather than rounded up.

## Full 30-set execution (2026-11-20)

The first run missed 8 defects, all on change sets that edit a spec file. The cause was in the map, not the tests: `select.js` had no entry for `tests/*.spec.ts`, so editing a test selected no tests and every such run was a vacuous green.

After mapping a changed spec to itself:

| Metric | Before | After |
|---|---|---|
| Sets executed | 23 | 23 |
| Vacuous greens | 8 | 0 |
| Missed defects | 8 | 0 |
| Selected runs | 13 | 23 |
| Wall time | 932 s | 1178 s |

Seven sets required no tests (docs only) and are recorded that way rather than counted as passes.

**Not caught by the full suite either:** chg-07, chg-08, chg-09, chg-15, chg-27, chg-28, chg-29. These are coverage gaps in the suite, not selection gaps: the impacted run and the full run agree. BUG-04 is intermittent by design; BUG-10 (cross-user orders) has no test.

That distinction matters: selection can only lose a defect the full suite would have caught, and here it lost none.
