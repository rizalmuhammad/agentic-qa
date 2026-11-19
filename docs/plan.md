# Phase Plan

Compact summary of the six phases. The contract in `docs/CONTRACT.md` is the source of truth for the app and the suite; this file is the source of truth for scope and exit gates.

Shared rules for every phase:

- `npm test` must be green with no seeded bugs active before a phase can close.
- Agents never edit `app/` to make a test pass, and never widen their own permissions.
- High-risk work (auth, data deletion, release decisions) is human-only, per `docs/risk-policy.md`.

## Phase 0 - Foundation

**Objective:** a working demo app and a Playwright suite that is green with no bugs enabled.

**In scope**
- Express demo Shop app with the routes, test ids, and money rules in the contract.
- Playwright + TypeScript suite covering login, products, cart, checkout, and orders.
- CI on push and pull request that runs the suite and keeps failure artifacts.

**Exit gate:** `npm test` passes against the app with no bugs enabled, and CI is green on the default branch.
**Branch:** `phase/0-foundation`

## Phase 1 - AI-assisted

**Objective:** use an AI assistant to draft tests, with a human owning every merge.

**In scope**
- A context pack built from the contract, so the assistant sees the same rules as the team.
- Assistant-drafted specs for two or three flows, reviewed and corrected by hand.
- A short review checklist for AI output: selectors, assertions, data isolation, flake risk.

**Exit gate:** drafted specs meet the Phase 0 green bar and pass human review; a written note records what the assistant got wrong.
**Branch:** `phase/1-ai-assisted`

## Phase 2 - Single agent

**Objective:** one agent takes a requirement to a passing test end to end inside a sandbox.

**In scope**
- A requirement intake format: one requirement becomes one task with a named spec title.
- The agent loop: read the contract, write the spec, run it, read the failure, iterate.
- Guardrails: no edits to `app/`, CI, or the risk policy; no network access beyond the local app.

**Exit gate:** the agent produces a passing spec for a new requirement with no human edits to the spec body, and attaches a run and trace.
**Branch:** `phase/2-single-agent`

## Phase 3 - Agent team

**Objective:** split the work across roles and make the handoffs visible.

**In scope**
- A small team: planner, author, runner, locator healer, each with least-privilege scope.
- Shared artifacts: task board entries, spec diffs, run output, and a handoff log.
- Locator healing limited to selectors, with assertions and expected values frozen.

**Exit gate:** the team completes a small batch of requirements, all green, with a handoff log and no permission creep.
**Branch:** `phase/3-agent-team`

## Phase 4 - Trust reviewer

**Objective:** make the reviewer agent the gate for low and medium risk changes.

**In scope**
- An evidence pack format: diff, run result, trace, risk class, and the reason for the class.
- Reviewer behaviour: approve low-risk work, flag medium-risk work, refuse high-risk work.
- A human sample audit of low-risk approvals, recorded in `docs/progress.md`.

**Exit gate:** the reviewer flags a planted regression without being told where it is, and the first human sample audit is recorded.
**Branch:** `phase/4-trust-reviewer`

## Phase 5 - Scale and release

**Objective:** grow coverage and show a release decision that stays with a human.

**In scope**
- Suite growth against a runtime budget, with the budget tracked per week.
- Flaky quarantine with an owner and an expiry date for every quarantined test.
- A release checklist and evidence pack prepared by the reporter agent.

**Exit gate:** the full suite runs within budget, no quarantine item is unowned or expired, and a human makes the release call from the evidence pack.
**Branch:** `phase/5-scale-release`
