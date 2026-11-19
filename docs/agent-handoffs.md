# Agent handoffs

How work moves between the six agents, what each one must receive, and where it stops. Written after a design review of the live agent profiles; the gaps at the end are open on purpose and are assigned to a phase.

## Handoff contract

| From | To | Must include | Must not include |
|---|---|---|---|
| Orchestrator | Planner | story, acceptance criteria, diff, past defects | the expected answer |
| Planner | Generator | impacted areas, tests to write and skip, requirement id per test, risk level and reason | test code |
| Generator | Executor | branch name, files changed, the command to run | a claim that it passed |
| Executor | Failure Analysis | failing test, error, artefact paths, run id | a diagnosis |
| Failure Analysis | Healer | classification, confidence, evidence, the failing step | proposed code |
| Healer | Reviewer | diff, trace that justifies it, before and after | its own reasoning or approval |
| Reviewer | Orchestrator | approve, reject or escalate, with the full evidence pack | code |

## Rules that the profiles enforce

- No agent approves its own work. The Healer proposes, the Reviewer decides, the orchestrator merges.
- Only the Executor's runs count as evidence. A Generator's local run is a sanity check, and a Reviewer never runs the suite itself.
- Repeat runs are requested from the Executor and labelled as re-runs, so they cannot be mistaken for a hidden retry.
- The Planner never lowers a risk level to keep work moving. Thin evidence raises the risk, it never lowers it.
- The Reviewer audits a Failure Analysis classification instead of re-deriving it, unless the evidence is missing.
- High risk (auth, data deletion, any release) is human-only at every phase.

## Open gaps

Assigned so they do not get lost:

1. **Nobody applies an approved fix.** Healer proposes, Reviewer approves, Generator never merges, Reviewer never merges. The apply-and-merge step for a low-risk approval has no owner. Assign it to the orchestrator or a CI bot when the Phase 4 wiring is built.
2. **The risk label is a single point of failure.** The Planner's label alone routes auto versus human approval. The conservative rule is in its profile; a useful cross-check is a Reviewer flag when the diff scope looks above the labelled risk. Decide in Phase 4.
3. **Exploratory testing has no owner.** The plan's exploratory branch (draft tests only, uncertain findings to the Reviewer) maps to none of the six profiles. Either assign it in Phase 3 or write down that it stays manual.
4. **Failure Analysis and Reviewer both do flaky-versus-bug.** Resolved for now: the Reviewer audits the evidence. Re-deriving it would make Failure Analysis redundant from Phase 4.
5. **Two runners, briefly.** Resolved: only Executor runs are evidence; anything else is a sanity check.
