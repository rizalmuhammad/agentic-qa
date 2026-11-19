# Phase 3 - team flow report

Five cases, one seeded bug each. Planner and Generator run once per case; Executor runs the test clean and three times with the bug enabled; Healer and Failure Analysis see the failure.

Model: `glm-5.3-flash`. Every case ran end to end with no manual step inside the flow.

## Seeded-bug results

| Case | Requirement | Bug | Clean run | Bug runs passed | Found | Stage |
|---|---|---|---|---|---|---|
| checkout-tax | REQ-CHK-01 | BUG-01 | passed | 0 / 3 | yes | Generator test + Executor |
| discount-cap | REQ-CHK-02 | BUG-07 | passed | 0 / 3 | yes | Generator test + Executor |
| search-case | REQ-CAT-03 | BUG-08 | passed | 0 / 3 | yes | Generator test + Executor |
| checkout-empty | REQ-CHK-03 | BUG-13 | passed | 0 / 3 | yes | Generator test + Executor |
| cart-negqty | REQ-CART-04 | BUG-03 | **failed** | 0 / 3 | **no** | Generator, at the test |

**4 of 5 found. 1 missed. 0 misclassified.**

## The miss, and why it counts

`cart-negqty` produced a test that failed with no bug enabled. The failure was a precondition the test asserted about its own fixture data, not the behaviour in the requirement. A test that cannot pass clean cannot detect anything, so the case is recorded as missed rather than fixed after the fact.

This is the useful result of the phase: the browser rejects a confident, well-written, wrong test.

## Healer

The five detected failures were all product bugs. The Healer correctly refused to propose a code change for them: its job is a broken test, not a broken app.

To exercise the locator path, one case was run outside the seeded set with a stale accessible name (`Shopping cart` where the link is `Cart`):

- diagnosis: `locator`
- proposal: replace the stale name, same element, no waits or retries
- evidence: the timeout line plus the observation that the element still exists
- `apply: false` - as designed

That proposal is in `runs/phase3/locator-heal.jsonl`.

## Failure Analysis

All four detections returned `product-bug`, confidence `high`, backed by three identical failures under the same code and a clean pass with the bug off. No failure was called flaky, which is the mistake that matters: a reproducible failure mislabelled as flaky is how real bugs get closed.

## Gate

- Full flow completes end to end in CI-style runs without manual steps: yes, five cases.
- Every Healer proposal carries a diff and the evidence behind it: yes for the one case where a diff is the right answer; the product-bug cases correctly carry none.
- Failure Analysis calls backed by reproducible evidence: yes, three runs each.
- Seeded-bug report shows misses honestly with a reason: yes, one miss, reason stated.

## Limits

- Five cases is the floor the plan asks for, not a sample size.
- The five bugs are all reachable by an API-level or simple UI test. None required multi-page reasoning.
- The flow runs locally, not in GitHub Actions: the model key is not in the repo, and adding it as a CI secret is a manual step for the owner.
- The planner's risk label was `high` on the tax case, which is correct, but it was not exercised as a routing decision because no auto-approval exists until Phase 4.
