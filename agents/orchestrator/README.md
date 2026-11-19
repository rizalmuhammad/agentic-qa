# Orchestrator (Phase 2)

The smallest possible agent loop: read one known case, generate one Playwright test, run it, score it. Nothing else is automated yet.

## What it does

1. Loads a case from the table in `run.js` (requirement id, text, hint).
2. Sends the Generator prompt with the contract, the assertion standard, and a passing spec as style reference.
3. Requires JSON back: `{"path": "tests/generated/<slug>.spec.ts", "content": "..."}`.
4. Enforces the rules in code: the path must be under `tests/generated/`, the requirement id must be in the title, there must be an assertion, and the file may not use `waitForTimeout`, `skip`, `only`, or `force: true`.
5. Writes the file, runs it with Playwright, and records the result.
6. Deletes nothing: generated files stay in `tests/generated/`, which is gitignored, so a human can read exactly what ran.

## Stop rule

- One repair attempt per case if the output is unparseable or breaks a rule.
- After the second failure the run is scored **incorrect** and the loop moves on.
- No retry of a failing test to make it green, no assertion edits, no guessing.
- If the model blocks on an ambiguous requirement, that is recorded as `blocked`, not retried.

## Scope and permissions

The loop can:

- read the repo (`docs/`, `tests/`, `app/`)
- write **only** inside `tests/generated/`
- run Playwright against the local app on port 3100

It cannot: push, open a PR, merge, touch `app/`, `tests/*.spec.ts` outside `generated/`, `.github/`, or read the LLM key from inside the repo. The key comes from `QA_LLM_KEY_FILE`, a path outside the workspace.

## Report format

Each run appends one JSON line to `runs/<stamp>.jsonl`:

```json
{
  "runId": "search-filter-1",
  "case": "search-filter",
  "requirement": "REQ-CAT-02",
  "model": "glm-5.3-flash",
  "attempts": 1,
  "valid": true,
  "passed": true,
  "correct": true,
  "tokens": 3893,
  "latencyMs": 13192,
  "failure": null,
  "file": "tests/generated/search-filter.spec.ts"
}
```

A summary is written next to it: runs, correct count, rate, longest correct streak, total tokens, mean latency. That summary is what the Phase 2 exit gate reads.

## Known deviations from the plan

- The plan says Claude via MCP. This project uses a custom OpenAI-compatible provider (`https://ai.sumopod.com/v1`, model `glm-5.3-flash`), so there is no MCP client in this loop. The permission model above is enforced by the harness instead of by MCP scopes.
- `escalate` has nothing to escalate to yet: the loop stops and records the failure. The Reviewer owns escalations from Phase 4.
- Cost per run is recorded in tokens, not currency, because the provider does not publish a per-token price. The gate asks for cost; this is the honest substitute, and it is labelled as such.

## Replay

Any run can be replayed from its JSONL line: rerun `node agents/orchestrator/run.js --case <case> --runs 1`, and compare the generated file with the one recorded. The file path is in the record.
