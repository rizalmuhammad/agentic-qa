# AI Review Log

One entry per AI-assisted change. Phase 1 target: five entries. Each records what the AI proposed, what changed, and why. Rejections stay in the log; they are the evidence that the review was real.

Method note: the times below are wall-clock from this project's own runs, not a controlled study. "Draft" is prompt to proposal; "review" is proposal to merged commit, including the test run and the mutation check. The manual baseline is an estimate from writing the Phase 0 suite, not a measurement, so the saving is indicative only.

| # | Date | Case | Proposed | Outcome | Changed | Why | Time |
|---|---|---|---|---|---|---|---|
| 1 | 2026-11-19 | New test, REQ-ORD-01 | `tests/orders.spec.ts` asserting row order by captured order id | Accepted with change | Removed `waitForTimeout(1_000)`; seeded the first cart with `seedCart`; wrote the API token to `localStorage` through `addInitScript` instead of re-logging in | The standard forbids sleeping. The gap was not needed: order ids are sequential, so placement order already proves "newest first". The proposal also assumed `uiToken(page)` after a UI login, which mixed two sessions; one token for setup and UI is simpler and more deterministic | draft ~8 min, review ~15 min |
| 2 | 2026-11-19 | New test, REQ-CAT-05 | Added empty-search test to `tests/catalog.spec.ts` | Accepted as proposed | Nothing | Assertions are exact (0 cards, empty-state text, no error banner), one requirement, web-first. The empty-state locator uses visible copy because the contract has no test id for it, and `CONTRACT.md` allows text; noted as the weakest point | draft included in #1, review ~6 min |
| 3 | 2026-11-19 | Locator fix, BUG-06 | Change `getByRole('button', { name: 'Checkout' })` to `getByTestId('checkout-button')` in `tests/cart.spec.ts` | **Rejected** | Nothing | The call site does not exist anywhere in `tests/`. The proposal was written against an assumed test, not the repository, and the AI said so itself. A locator fix needs a real failing run and a trace; this had neither. The underlying advice is still correct and is already the rule in the contract | review ~4 min |
| 4 | 2026-11-19 | Test data, `seedCart` | New helper in `tests/fixtures.ts` that logs in through the API, adds items, returns the token | Accepted with change | Dropped the "empty items" usage; the helper is used by REQ-ORD-01 with a real cart | The helper is deterministic only if it runs after the reset fixture; the proposal stated that correctly. It is now exercised by a real test instead of being dead code | draft included in #1, review ~5 min |
| 5 | 2026-11-19 | Failure explanation | "Test bug, high confidence" for the `uiToken` failure in Phase 0 CI | Accepted | Nothing | The diagnosis matched the actual fix: `login()` returned before the token was stored, and `uiToken` now polls. It correctly refused to call a single failure "flaky" and listed what the evidence did not prove | review ~7 min |

## Rejection record

**Case 3** is the weak suggestion the exit gate asks about: a plausible-looking one-line fix with no failing test behind it. It is recorded here rather than quietly dropped, because a log with only acceptances is not evidence of review.

Case 1's `waitForTimeout(1_000)` is the second weak suggestion: the reasoning sounded sound ("the orders need different timestamps") but the requirement never mentions time, and the test passed without it.

## Time, honestly

- Drafting five proposals: about 8 minutes of agent time.
- Review, edits, two real runs, two mutation checks, and this log: about 37 minutes.
- Manual baseline: Phase 0's two comparable tests took about 45 minutes to write and verify without AI, so the saving here is roughly 10-15 minutes, not hours. Most of the cost is review, which is the point.
