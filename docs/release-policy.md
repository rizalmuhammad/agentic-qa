# Release policy

Version 1.0.0 - 2026-11-19. Enforced by the orchestrator and the Reviewer; this file is the document the plan asks to be merged, not described in chat.

## What counts as low risk

All of the following must be true:

- The change touches only `tests/` and `docs/`.
- The diff adds no sleep, skip, retry or force click.
- Every assertion still maps to a requirement.
- The impacted-area selection covers the files the suite proves.
- The full suite passed within the last 24 hours on the same commit.

Low-risk changes may be approved by the Reviewer alone once its streak condition is met. A human samples the evidence pack afterwards.

## Medium risk

- Application code changes in `app/` that do not touch auth, checkout totals, or data deletion.
- A new test for a changed feature.
- A quarantined flaky test.

The Reviewer prepares the evidence pack; **a human approves**. No auto-merge.

## High risk - human only, always

- `app/server.js` login, tokens, or session handling.
- Checkout totals, tax, discount, rounding.
- Anything that deletes data, or any migration.
- Any release decision itself.
- Changes to `.github/workflows/`, `mcp/`, or this policy.

The orchestrator refuses to auto-approve these even when every check is green, and records the refusal.

## Gates before release

1. Selected impacted tests green.
2. Full regression green at the checkpoint (nightly or pre-release).
3. No seeded defect missed in the impacted-area run that the full run would have caught.
4. Cost per run within the cap set in the PR that introduced the run.

## Who authorised auto-approval

The project owner, in this file, by merging it. Any change to this list is a high-risk change to the policy itself.

## Cost cap

LLM-as-judge is allowed only where a deterministic check cannot decide, capped at 3,000 completion tokens per review. Beyond the cap the case escalates instead of spending more.

## Kill switch

If the selected run misses a seeded defect that the full regression catches, selection is disabled for that area until the mapping is fixed. The batch simulation exists to prove this has not happened.
