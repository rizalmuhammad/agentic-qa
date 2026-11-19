# Blind label set

22 cases, exported without labels.

1. Copy `labels.template.json` to `labels.json`.
2. For each case file, read the requirement and the candidate change, and write one verdict: `approve`, `reject`, `escalate`.
3. Run `node agents/reviewer/score-blind.js`.

Do not open `run-review.js` before labelling; it contains the planted change and the label.
