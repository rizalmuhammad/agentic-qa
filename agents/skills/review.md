# Review

Use on someone else's change, before it merges.

1. Read the diff first, the description second; a good description never excuses a bad diff.
2. Ask what breaks if this change were wrong, and whether a check catches it.
3. Check scope: files changed, assertions touched, tests skipped, configuration edited.
4. Check evidence: the run that proved the change, on the same commit.
5. Return one of: approve, reject with the failing check named, or escalate with the question that only a human can answer.

Rules: never approve your own work; never accept "tests pass" without the command and its output; an ambiguous requirement is an escalation, not a rejection.
