---
type: Fixed
pr: 4642
---
Preserve curated milestone name and version during state sync when the roadmap heading contains a decorated placeholder. State write verbs (`state.record-session`, `state.planned-phase`) previously checked only for the bare word `'milestone'` before restoring a curated milestone name, causing decorated placeholders like `milestone (ACTIVE — <Name>)` to overwrite the curated milestone name in STATE.md.
