# Phase 2 measurement - 20 runs

Date: 2026-11-19. Model: `glm-5.3-flash` via `https://ai.sumopod.com/v1`. Config: one repair attempt, `max_tokens` 6000, single worker per case.

## Result

| Case | Correct | Runs |
|---|---|---|
| search-filter (REQ-CAT-02) | 5 | 5 |
| cart-remove (REQ-CART-03) | 3 | 5 |
| auth-wrong-password (REQ-AUTH-02) | 3 | 5 |
| checkout-discount (REQ-CHK-02) | 1 | 5 |
| **Total** | **12** | **20** |

- Correct rate: 60%.
- Longest correct streak: 6.
- Tokens: 187,635 total.
- Mean model latency: 106 s per run.

## Gate

**Not met.** The exit gate asks for 10-20 correct runs in a row on known cases. The longest run of correct results here is 6, so the phase does not merge. The PR stays open with this failure written in it, as the plan requires.

## What failed, and why

Two distinct causes, both recorded per run in `runs/*.jsonl`:

1. **Truncated output (5 runs).** The reply hit the 6000-token limit before writing the JSON object. Every one of these was on the two longer cases: checkout-discount (4) and cart-remove (1). The model reasons before answering, and the reasoning spends the budget. This is a harness limit, not a model failure.
2. **Generated test failed at runtime (3 runs).** One auth case and two cart cases produced a syntactically valid test that failed in the browser. Those are genuine wrong answers and should count against the loop.

## What this says about the loop

- The narrow, single-step cases are reliable: 5/5 on search, and the 8 correct runs include a clean streak of 6 before the checkout case broke it.
- The loop is honest: it scores a browser failure as incorrect and keeps the trace, rather than accepting the model's own claim.
- The repair attempt helps but is not sufficient. One checkout run passed only on the second attempt.

## Next iteration (not done in this measurement)

- Raise the token budget per call, or ask for the file body without reasoning, so long cases stop truncating.
- Add a validation rule that rejects a reply with `finish_reason: length` before spending a repair attempt on it.
- Re-run the 20 cases on the changed config and compare. The current numbers stay in `runs/` as the baseline.
