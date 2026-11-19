# Failure Guide

How to read a failing Playwright test without guessing.

## Open the trace

Playwright writes a trace per failed test when `trace: 'retain-on-failure'` (or `'on'`) is set in `playwright.config.ts`. The run prints the path. Open it with:

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

You can also drag the `trace.zip` into the trace viewer at https://trace.playwright.dev. The viewer runs locally in the browser, but prefer the local command for anything that touches private data.

## Look at these in order

1. **Error message.** Read the assertion and the received value first. It usually names the selector, the expected text, or the timeout.
2. **Call log.** Find the last successful action before the failure. The step after it is where the test and the app disagree.
3. **Network.** Check the request the action triggered: status code, request body, response body. A 400 or 500 here explains most failures.
4. **Snapshot.** Look at what the page actually showed at that moment. Check for a toast, an error box, a disabled button, or a loading state.
5. **Console and source.** Console errors point at client-side exceptions. The source tab shows which line of the spec ran.

## Locator failure or product bug?

Ask one question: with the same steps done by a human in a browser, does the app behave correctly?

Signs of a **locator failure**:

- The element exists but the selector no longer matches (text changed, id renamed, element moved).
- The failure is a timeout waiting for a selector, while the network response is 200 and the payload is correct.
- The snapshot shows the expected content under a different label or structure.
- Only one spec fails, and it fails at the selector line, not at the assertion.

Signs of a **product bug**:

- The request returns an unexpected status or payload (wrong total, wrong quantity, missing field).
- The assertion fails on a value that the app computed, while the element was found and interacted with normally.
- Several specs fail on the same behaviour, or the same failure appears on a different route.
- The UI shows an error, a stale value, or data that belongs to another user.

Rule of thumb: a locator failure is fixed by changing how the test finds the element, and the assertion stays the same. A product bug is fixed in `app/`, and the test stays the same. If you find yourself changing an expected value to make a test pass, stop: that is a product decision, not a test fix.

## Before you close a failure

- Re-run the single test with `npx playwright test <file> -g "<title>"` to confirm it is reproducible.
- If it only fails sometimes, record it as flaky with the run link. Do not mark it passed.
- Attach the trace path to the failure note so the next person does not repeat the investigation.
