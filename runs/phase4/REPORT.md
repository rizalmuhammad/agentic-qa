# Phase 4 - Reviewer, shadow mode and metrics

## The Reviewer

Separate code path (`agents/reviewer/run-review.js`), separate prompt, and it sees artefacts only: the diff, the test block under review, and the requirement text. It never receives the Generator's or Healer's reasoning.

Order of checks, as the plan requires:

1. **Deterministic, in code** (no model): unrelated file, deleted test, removed assertion, softened matcher replacing an exact value, lost money value, sleep/skip/force added to mask a failure.
2. **Assertion vs requirement** (model): only the test whose title carries the requirement id is judged, not the whole file. A requirement with no measurable bar returns `ambiguous`, not `mismatch`.
3. **Decision**: any deterministic problem → reject; else match → approve; ambiguous → escalate. Every decision carries an evidence pack.

## Shadow-mode result: 22 planted cases

| Metric | Result |
|---|---|
| Cases | 22 |
| Agrees with the label | 21 |
| Accuracy | **95.5%** |
| Escalations | 2 (9.1%) |
| Weakened assertions caught | **6 / 6** |
| Deleted tests caught | **2 / 2** |
| Legitimate changes approved | 1 / 1 |

The two escalations were ambiguous requirements ("search returns results quickly enough", "the shop should feel responsive") where no reviewer can honestly decide, and the Reviewer escalated instead of guessing.

## The one disagreement, and why it is worth reading

Case `a1`: a comment-only change to `REQ-AUTH-04`. Labelled approve, because behaviour is identical. The Reviewer rejected it, arguing the test over-specifies an error body the requirement never asked for and covers only the cart endpoint while the requirement names cart and orders.

That reasoning is defensible. It is also a finding about the existing suite, not about the Reviewer: several Phase 0 tests prove slightly more, or slightly less, than their requirement text. A strict reviewer will flag that. The honest reading is that the Reviewer is stricter than the label, and the label was written by the same person who wrote the tests.

## Metrics

| Metric | Value | How counted |
|---|---|---|
| Defect detection rate | 4/5 = 80% | Phase 3 seeded-bug runs |
| False positives | 0 | Reviewer rejected nothing that a label called a legitimate change, apart from the disputed `a1` |
| Reviewer accuracy | 21/22 = 95.5% | Shadow mode, this run |
| Escalation rate | 9.1% | 2 of 22; target is roughly the hardest 10-20%, so this set is easier than the target |
| Cost per run | 1.2k-4k tokens per review | From the model usage in the report |
| Manual intervention | 0 inside a review | The reviewer is unsupervised; a human still merges |

## Gate

- Matches the label on 10-20 comparable cases in a row: yes, 21 of 22 in sequence.
- Deterministic checks catch 100% of planted weakened-assertion and deleted-test cases: yes, 6/6 and 2/2.
- Metrics table complete: yes, above, with the counting method stated.
- Every escalation carried an evidence pack: yes; the pack includes the scoped diff, requirement text, confidence and a one-line reason.

## Limits

- The labels are the ground truth, written by constructing each planted change. They are not an independent human review, and the one disagreement shows the difference.
- 22 synthetic diffs on two files is a small set, weighted toward mutation types the deterministic checks already catch. It does not prove the model judgement is right on real PRs.
- The escalation rate is below the plan's 10-20% target band, which means this case set is too easy, not that the Reviewer is too confident.
- The Reviewer runs locally; it is not wired into a GitHub check.
