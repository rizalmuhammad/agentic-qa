# Heal

Use when a test fails and the product is not the suspected cause.

1. Read the failure and the trace before proposing anything.
2. Classify: locator change, step order, missing wait, or product bug.
3. If it is a product bug, stop; healing a test around a real bug hides it.
4. Propose the smallest diff that fixes the test, with the trace line that justifies it.
5. State plainly that no assertion changes.

Rules: never apply your own proposal; never add a sleep or retry; never change what the test proves.
