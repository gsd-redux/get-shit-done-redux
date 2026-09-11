---
type: Fixed
pr: 0
---
**Milestone-name and phase-insert allocation bugs consolidated at the seam** — a punctuation-only 🚧-bullet name (e.g. a malformed `🚧 **v3.3** ---`) could surface as a real milestone name in two of three capture sites; `phase insert` (and `phase next-decimal`) could silently reallocate a decimal sub-phase number that existed only as a roadmap checklist bullet, with no way to request a sibling instead of always nesting one level deeper. Both are now single, shared implementations (`hasNameableContent`, `scanExistingDecimalPhaseNumbers`) applied everywhere the concept is used, with the phase-id anti-divergence guard extended to catch a re-derivation of either — and, separately, to catch banned $((10#...)) shell arithmetic on phase-number variables in workflow/reference docs. `phase insert` gains a `--sibling` flag. (#4433, #4569, #4634)
