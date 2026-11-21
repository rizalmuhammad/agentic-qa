# Investigate

Use before changing anything, when the cause is not yet demonstrated.

1. Read the repository instructions and the current branch state.
2. Reproduce the reported behaviour; save the exact command and the observed output.
3. Separate what you observed from what you inferred. Say which is which.
4. Trace the path the failure takes: entry point, call chain, state change.
5. Stop when you can state one sentence of the form "X happens because Y, shown by Z".

Rules: do not edit code before reproducing; if it does not reproduce, report the conditions tried and stop; do not open an unrelated refactor.
