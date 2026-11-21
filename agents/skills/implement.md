# Implement

Use when the cause is known and the change is agreed.

1. Work in your own worktree and branch; never edit on main.
2. Make one logically cohesive change per commit.
3. Keep unrelated files untouched; if the fix needs them, say so before editing.
4. Run the checks the change touches, not the whole suite blindly.
5. Write a commit message that says what breaks without the change.

Rules: no sleeps, retries or force options to make a check pass; no weakening an assertion; if the change expands into a redesign, stop and report.
