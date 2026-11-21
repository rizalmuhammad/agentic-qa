# Task-type routing

One short procedure per task type, instead of a long brief every time. `agents/tools/route.js` maps a type to its file so an agent gets only the part it needs.

| Type | File | Use when |
|---|---|---|
| investigate | `investigate.md` | the cause is not demonstrated yet |
| implement | `implement.md` | the cause is known and agreed |
| review | `review.md` | someone else's change is about to merge |
| heal | `heal.md` | a test fails and the product is not the suspect |

Procedures describe process only. The task's own details belong in the brief, never in the skill.
