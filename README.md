# Agentic QA

A learning and portfolio project about using AI agents to write, run, and review end-to-end tests. It is not production experience, and it does not describe a real product, a real team, or real traffic. The app under test is a small demo Shop app built for this project, and it contains deliberately seeded bugs so that failure detection and triage can be practised honestly.

**Status: all six phases complete.** Each phase merged with its own PR and exit gate.

| Phase | Result |
|---|---|
| 0 - Foundation | 18 active tests + 15 seeded-bug checks, CI green on 4 consecutive runs |
| 1 - AI-assisted | 5 reviewed AI cases, 2 rejected; assertion standard and prompt library |
| 2 - Single agent | 17/20 runs correct, 13-run streak |
| 3 - Agent team | 4 of 5 seeded bugs found, 1 honest miss, 0 misclassifications |
| 4 - Reviewer | 21/22 shadow cases agree; 6/6 weakened and 2/2 deleted tests caught |
| 5 - Scale and release | 30/30 selection coverage; high-risk refused; 25s full vs 16s sharded |

This is a portfolio project on a demo app with seeded bugs. It is not production experience.

## What is in the project

- A Node 22 + Express demo Shop app with hash-route UI: login, products, cart, checkout, orders.
- A Playwright + TypeScript suite that must pass with no seeded bugs active.
- A phase plan that moves from a hand-written suite to a small team of agents with a reviewer gate.
- A risk policy that keeps auth, data deletion, and release decisions with a human.

## Agents

| Agent | Responsibility | Must never |
|---|---|---|
| Planner | Reads the story and the diff, picks what to test, returns a test plan and risk level. | Write or run tests |
| Generator | Writes the tests and Playwright code on its own branch. | Merge its own tests |
| Executor | Runs the suite in CI, collects traces, screenshots, and logs. | Change test code to make a run pass |
| Healer | Proposes a fix as a diff, with the trace that justifies it. | Review or approve its own fix |
| Failure Analysis | Calls flaky, bug, or environment from logs, network, and history. | Close a possible production bug alone |
| Reviewer | Checks the fix against deterministic rules and the requirement, then approves or escalates with an evidence pack. From Phase 4. | Fix code; approve high-risk work |

Independence rule: the Reviewer is a separate agent with a separate prompt and context. It sees the artefacts, never the Healer's reasoning.

## Phases

| Phase | Focus | Branch |
|---|---|---|
| 0 - Foundation | Demo app, Playwright suite, CI | `phase/0-foundation` |
| 1 - AI-assisted | Assistant drafts specs, a human owns the merge | `phase/1-ai-assisted` |
| 2 - Single agent | One agent takes a requirement to a passing test | `phase/2-single-agent` |
| 3 - Agent team | Planner, Generator, Executor, Healer, Failure Analysis with visible handoffs | `phase/3-agent-team` |
| 4 - Trust reviewer | Reviewer gate and human sample audits | `phase/4-trust-reviewer` |
| 5 - Scale and release | Coverage growth, quarantine, human release call | `phase/5-scale-release` |

Details and exit gates are in `docs/plan.md`.

## Install, run, test

Requires Node 22.

```bash
npm ci
npx playwright install --with-deps chromium
npm start                 # http://localhost:3100
npm test                  # Playwright suite
```

Playwright starts the app through its `webServer` config, so `npm start` is only needed when you want to browse the app yourself. Set `PORT` to use another port. The app has no build step.

## Seeded-bug mode

Bugs are off by default. Turn them on per browser session by adding a query string to any page:

```
http://localhost:3100/?bugs=BUG-01,BUG-03#/products
```

This sets a `seeded_bugs` cookie. To enable every bug on the server instead:

```bash
SEEDED_BUGS=all node app/server.js
```

Active ids are reported at `GET /api/__bugs`. `package.json` also defines `npm run test:bugs`, which runs the seeded-bug spec with `SEEDED_BUGS=all`. The authoritative list, with symptoms and expected detection, is `docs/seeded-bugs.private.json`. That file is private: it is not given to an agent at run time, because an agent that knows the exact bug cannot be trusted to find it.

## Repo layout

```
app/server.js              Express server and seeded-bug hooks
app/public/index.html      UI in one page, inline CSS and JS
tests/*.spec.ts            Playwright specs
tests/fixtures.ts          shared helpers
playwright.config.ts
tsconfig.json
package.json
package-lock.json
.github/workflows/ci.yml   CI: install, Chromium, npm test, artifacts
docs/
  CONTRACT.md              app, routes, test ids, seeded-bug mechanism
  plan.md                  phases, scope, exit gates
  risk-policy.md           risk gate and least privilege
  progress.md              weekly snapshot log
  failure-guide.md         how to read a trace and triage a failure
  seeded-bugs.private.json private bug list
```

## Definition of green

`npm test` passes against the app with no bugs enabled, and each spec title names the requirement it covers. See `docs/CONTRACT.md` for the full contract.

## Licence and use

This is a personal learning project. The demo app is not hardened, the data is in memory, and nothing here should be used as a template for a production system without a security review.
