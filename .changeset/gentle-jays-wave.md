---
type: Fixed
pr: 0
---
**`state update` no longer reports a same-value write as a missing field** — updating `Last Activity` (or any other body-sourced frontmatter key) to the value it already holds reported `updated: false` with a "not found in STATE.md" message telling the caller to add a line that was already there at the correct value. Any day `gsd-ship` runs before `gsd-extract-learnings`, both write today's date to the same field, so the second call always hit this. (#4488)
