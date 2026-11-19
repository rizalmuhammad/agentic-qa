# Private data

Two things never live in this repository: the model key and the seeded-bug list.

## Model key

- Local runs read it from a file outside the repo, named by `QA_LLM_KEY_FILE`.
- CI reads it from the repository secret `QA_LLM_API_KEY`.
- The `agent-flow` workflow fails loudly if the secret is missing rather than running without it.
- Nothing prints, logs, or commits the key.

## Seeded-bug list

The list of planted bugs, with their symptoms and expected detection, is the answer sheet. If an agent can read it, a "found" bug proves nothing.

- It is stored outside the repository, and as a CI secret for anything that needs to verify coverage.
- This repository keeps only the ids that the app can activate through `?bugs=` / `QA_SEEDED_BUGS`, and the test ids that check them.
- The file was removed from the working tree on 2026-11-19. It still exists in older git history, so treat any clone from before that date as containing it.

## Rotating

When rotating either value, update the file outside the repo and the repository secret in the same step. A run that reports "missing" is the workflow doing its job, not a bug.
