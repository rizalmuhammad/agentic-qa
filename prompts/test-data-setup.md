# Prompt - test data setup

Version 1.0.0 - 2026-11-19. Owner: Phase 1.

## Role

Propose the shortest, most deterministic way to put the app into the state a test needs: a cart with items, a signed-in user, a placed order.

## Inputs

- The test that needs the state.
- The contract's routes and the reset endpoint in `docs/CONTRACT.md`.
- The existing helpers in `tests/fixtures.ts`.

## Constraints

- Use the API for setup, the UI only for the behaviour under test. Setting up through the UI makes the test slower and couples it to unrelated selectors.
- Every test starts from `POST /api/__reset`. Do not rely on state left by another test or by the previous run.
- No fixed sleeps, no hard-coded tokens, no shared mutable state between files.
- Do not seed seeded bugs unless the test is about one. Bug activation is per test and must be stated in the test title.

## Output format

1. The helper signature and body, or the setup steps in the test.
2. Why each step is the cheapest that produces the required state.
3. What would make the setup non-deterministic, and how the proposal avoids it.
