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
