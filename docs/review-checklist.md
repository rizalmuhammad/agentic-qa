# Review Checklist

Every AI-assisted change passes these three checks before it is committed. The order matters: a diff problem makes the rest irrelevant.

## 1. Diff

- [ ] The diff touches only the files the change claims to touch.
- [ ] No application code changed to make a test pass.
- [ ] No test deleted, no assertion removed or softened, no `.skip` added.
- [ ] No `waitForTimeout`, no `force: true`, no retry added.
- [ ] The test title carries the requirement id.
- [ ] Setup uses the API; the UI is used only for the behaviour under test.

**Reject if:** the diff is larger than the behaviour it proves, or anything in the list above is missing.

## 2. Trace

- [ ] A trace exists for the run that proved the change.
- [ ] The failing call in the trace is the behaviour the test claims to cover.
- [ ] No network 500, console error, or timeout is being swallowed by a passing assertion.
- [ ] The passing run after the change exercised the same path, not a shortcut.

**Reject if:** there is no trace, or the trace shows a different path than the test describes.

## 3. Assertion

- [ ] Exactly one requirement per test.
- [ ] The expected value is computed from the requirement, not copied from the app's output.
- [ ] The assertion is exact (`$192.24`), not truthy or structural.
- [ ] The assertion waits on the app through a web-first assertion.
- [ ] A failure message would name the requirement.
- [ ] Nothing is asserted that the requirement never asked for. If something is, that is a scope question for a human: escalate it, do not reject it.

**Reject if:** the assertion would still pass with the behaviour broken. Say which break it misses.

## Recording the outcome

Each reviewed change gets one line in `docs/review-log.md`: what was proposed, what changed, and why. A rejection is recorded with the same care as an acceptance, because the rejections are the evidence that review was real.
