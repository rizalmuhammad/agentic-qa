# Risk Policy

This policy says which agent may act on a change and when a human must decide. It applies to every phase, and it is deliberately stricter than what the agents can technically do.

## Risk gate

| Risk | Examples | Who acts | Human involvement |
|---|---|---|---|
| Low | Locator heal, routine regression, test data setup | Reviewer Agent (from Phase 4) | Sample audit by a human |
| Medium | New test for a changed feature, flaky quarantine | Reviewer Agent flags the change | Human reviews the evidence pack |
| High | Auth flow, data deletion, any release decision | Nobody automated | Human only |

Notes on the gate:

- The gate is decided by the highest-risk element in the change, not by the average.
- A change that touches a High item is High even if the edit itself looks small.
- "Reviewer Agent" means the Phase 4 reviewer role. Before Phase 4 exists, every change is human-reviewed by default.
- A sample audit is a human review of a subset of low-risk changes, chosen after the fact. It is not a pre-approval.

## Least privilege per agent

| Agent | May read | May write | Must not |
|---|---|---|---|
| Planner | Requirements, contract, existing specs | Plan and task notes | Edit app code, specs, or CI |
| Author | Contract, specs, app source, plan | `tests/`, test fixtures | Edit `app/`, CI, or the risk policy |
| Runner | Specs, app, run output | Run artifacts under `test-results/` | Edit any source file |
| Locator healer | Failing spec, page markup | Selectors in existing specs | Change assertions, expected values, or app code |
| Reviewer | Diffs, specs, evidence pack | Review comments only | Merge, approve its own work, or change permissions |
| Reporter | Run artifacts, trace files, order data | Progress notes and evidence packs | Edit tests or app, or publish a release |

Additional rules:

- An agent never holds credentials beyond the demo account in the contract.
- An agent never has write access to branch protection settings or repository secrets.
- The private seeded-bug list is not available to any agent at run time.
- Destructive operations (deleting data, resetting environments) require an explicit human instruction for that run.

## Changing permissions

Permission changes only land through a reviewed pull request diff. That means:

1. The change is made in a branch and opened as a PR, like any other change.
2. The diff shows the exact permission being added or removed, and the reason.
3. A human who is not the author approves it.
4. No agent grants itself a permission, and no permission is widened as a side effect of another change.

If a task seems to need a permission that is not in the table above, the task stops and a human decides.
