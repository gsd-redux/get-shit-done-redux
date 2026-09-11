---
type: Fixed
pr: 4618
---
**`validate.health` no longer flags `.planning/PATTERNS.md` as an unrecognized file.** The graduation workflow (`/gsd-extract-learnings`) writes this file on gsd-core's own instruction, but the artifact registry was never updated to recognize it -- every repo that had run the graduation scan sat permanently at `status: degraded`. (#4282)
