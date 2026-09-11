---
name: gsd:settings
description: Configure GSD workflow toggles and model profile
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - AskUserQuestion
requires: [quick]
---

<objective>
Interactive configuration of GSD workflow agents and model profile via multi-question prompt.

Routes to the settings workflow which handles:
- Config existence ensuring
- Current settings reading and parsing
- Interactive multi-question prompt covering model profile and workflow toggles (research, plan_check, verifier, drift guard, TDD, code review, worktrees, compact content, and more — see `gsd-core/workflows/settings.md` for the current set)
- Config merging and writing
- Confirmation display with quick command references
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/settings.md
</execution_context>

<process>
Execute end-to-end.
</process>
