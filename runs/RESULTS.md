# Phase 2 measurement

Model: `glm-5.3-flash` via `https://ai.sumopod.com/v1`. One repair attempt, `max_tokens` 8000, four cases run in parallel on separate ports.

## Iterations

| Iteration | Runs | Correct | Longest streak | Change |
|---|---|---|---|---|
| 1 | 20 | 12 (60%) | 6 | baseline: `max_tokens` 6000 |
| 2 | 20 | 18 (90%) | 9 | 8000 tokens; reject `finish_reason: length` before repair; shorter replies |
| 3 | 20 | **17 (85%)** | **13** | validator rejects `from './fixtures'` in generated files |

Iteration 3 passes the gate: **13 correct runs in a row**, against a requirement of 10-20. Iterations 1 and 2 are kept in `runs/` because a baseline that is quietly removed is not a baseline.

## Iteration 3 detail

| Case | Correct / runs |
|---|---|
| search-filter (REQ-CAT-02) | 5 / 5 |
| cart-remove (REQ-CART-03) | 5 / 5 |
| auth-wrong-password (REQ-AUTH-02) | 5 / 5 |
| checkout-discount (REQ-CHK-02) | 2 / 5 |

Failures, all on one case:

- Two runs hit the 8000-token cap before writing JSON. The checkout case asks for a multi-step test and the model reasons first.
- One run was rejected for importing `./fixtures` instead of `../fixtures`.

## What the gate covers, and what it does not

The gate asks for a streak, evidence per run, no writes outside scope, cost recorded, and replayability.

- Streak: 13. ✓
- Evidence: every run is a JSONL line with the generated file, tokens, latency and result; failures keep their traces. ✓
- Scope: the validator rejects any path outside `tests/generated/` and any import of application code. ✓
- Cost: tokens, not currency, because the provider publishes no price. Partial, and labelled.
- Replay: rerun any case from its log line. ✓

The weakness the gate does not catch: **checkout is 2/5**, and the same case produced the only three failures. A streak across four interleaved cases can look healthy while one case is unreliable, so the streak is necessary but not sufficient. This is recorded rather than smoothed: Phase 3 should revisit the long-case prompt before the loop is trusted with harder work.

## Environment note

The first measurement batch died at 10:50 because the runner was tied to the tool shell and was killed when the turn ended. The run log stopped mid-case with no exit line. Later batches are started detached, and progress is only reported after checking the process id and the output file's age.
