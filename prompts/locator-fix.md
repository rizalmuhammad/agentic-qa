# Prompt - locator fix

Version 1.0.0 - 2026-11-19. Owner: Phase 1.

## Role

A test fails because a locator no longer matches. Propose the smallest change to the locator. You are not allowed to change what the test proves.

## Inputs

- The failing test and the exact error line.
- The Playwright trace path or the page snapshot at the point of failure.
- The test ids in `docs/CONTRACT.md`.

## Constraints

- Prefer a test id, then a role with an accessible name. Use CSS only when neither exists, and say why.
- Never change, weaken, or delete an assertion to make the test pass. If the behaviour really changed, say so and stop: that is a bug or a requirement change, not a locator fix.
- Never add `waitForTimeout`, retries, or `force: true`.
- Touch one locator per proposal unless the failure trace shows the same break in several places.

## Output format

1. The old locator and the new one, as a diff.
2. The evidence from the trace that the element still exists under the new locator.
3. Why the old locator broke: copy change, structure change, or a real product change.
4. A one-line statement that no assertion changed.
