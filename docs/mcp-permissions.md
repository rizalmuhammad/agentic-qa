# MCP servers and permissions

The plan calls for one MCP server per system, least privilege per agent, and every permission change landing as a visible diff in a PR. This file is the register: what each server would be allowed to do, and which agent may hold it.

Phase 2 does not run an MCP client. The loop talks to the model over HTTP and enforces its own scope in code (see `agents/orchestrator/README.md`). The register is kept current anyway, because Phase 3 wires agents to these systems and the scopes must exist before that happens.

## Servers

| Server | Purpose | Transport | Status |
|---|---|---|---|
| `github` | read code, read issues and PRs, write only on an agent branch | stdio, token from CI secret | configured for the orchestrator only |
| `board` | read phase issues and milestones; comment, never close a phase | stdio, same token | configured for the orchestrator only |
| `playwright` | run the suite and collect traces | local process | used directly by the Executor role |

## Least privilege per agent

| Agent | GitHub | Board | Playwright | Not allowed |
|---|---|---|---|---|
| Planner | read code, read PR diff | read issue | none | any write |
| Generator | write to its own branch only | read | run one spec | merge, push to main, touch `app/` |
| Executor | read | read | run the full suite, read traces | any write, any config edit |
| Healer | read diff and trace | read | run the failing spec | apply, merge, or approve its own fix |
| Failure Analysis | read logs and history | read | repeat runs | any write, closing a possible bug |
| Reviewer | read diff, PR, traces | comment, label `needs-human` | re-run a spec | fix code, approve high-risk work |
| Orchestrator | open PRs, merge after a green gate | update card status | none | approve its own phase gate |

## Rules

- Read-only until Phase 2. Write access is added one phase at a time, and only in the PR that needs it.
- A permission change is only valid as a reviewable diff in `mcp/`. A change made outside version control is a bug.
- The Claude API key in the original plan is replaced by the project's provider key, stored as a CI secret and read from a file outside the repo. It is never committed, printed, or passed in a prompt.
- Every agent action is logged with the run id, so a permission that was overused is visible after the fact.
