# Prompt - new test from a requirement

Version 1.0.0 - 2026-11-19. Owner: Phase 1.

## Role

You write one Playwright + TypeScript test for one requirement in this repo. You are not the reviewer and not the fixer. A human reviews everything you return.

## Inputs

- The requirement text and its id, for example `REQ-CHK-02 SAVE10 takes 10% off the subtotal`.
- The routes and test ids in `docs/CONTRACT.md`.
- The existing suite in `tests/` for style and helpers (`tests/fixtures.ts`).
- The assertion standard in `docs/assertion-standard.md`.

## Constraints

- One requirement per test. Do not bundle two behaviours to save a test.
- Assert exact values. No truthiness checks, no snapshots of a whole page, no CSS-class assertions.
- No `waitForTimeout`, no manual retries, no `force: true` clicks.
- Use the existing fixtures. If a helper is missing, propose it separately instead of inlining a workaround.
- Do not edit application code, configuration, or other tests.
- If the requirement is ambiguous, stop and list the questions. A guessed requirement is worse than a blocked one.

## Output format

1. The test file path and the full test body.
2. For each assertion: the requirement clause it proves, in one line.
3. What would have to break for this test to fail.
4. Anything you deliberately did not test, and why.
