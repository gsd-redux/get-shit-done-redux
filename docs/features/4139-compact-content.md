---
id: 4139
title: Compact Content Mode
group: Context Engineering Features
---

**Config:** `workflow.compact_content: false`

**Purpose:** Per-project opt-in to token-minimized variants of GSD's own shipped prompt
content — workflow instructions, planning-artifact templates, and non-Claude agent-persona
payloads — so the always-loaded instruction window leaves more of the model's attention on
the developer's own code (ADR-4139 Decision 2: finite attention, not per-invocation price,
since prompt caching already discounts the latter).

Nothing is compressed at runtime. Compact variants are hand-authored, reviewed files sitting
beside their canonical siblings; the config key only chooses which one gets read. With the
key off (the default), every covered workflow, template, and agent persona behaves exactly as
it did before this feature existed.

**Requirements:**
- REQ-COMPACT-01: System MUST default `workflow.compact_content` to `false` — off costs
  nothing and changes no existing behavior
- REQ-COMPACT-02: Eagerly `@`-included workflow files MUST keep their host-guaranteed load;
  compactness on this stream comes from a spine + deferred `detail/*.md` elaboration, never
  from converting the `@`-include itself
- REQ-COMPACT-03: A missed runtime `Read` of a deferred elaboration or compact variant MUST
  degrade to a complete, correct, terser state — never to a state with no instructions
- REQ-COMPACT-04: No compact variant MAY weaken or remove protected content (guardrails,
  output-format contracts, few-shot examples, security language, structural headings)
- REQ-COMPACT-05: An agent with no compact persona variant registered MUST fall back to its
  canonical persona and disclose the fallback inside the served payload, never fail or serve
  nothing
- REQ-COMPACT-06: `/gsd-new-project` MUST ask the question and persist the answer;
  `/gsd-settings` and `/gsd-config` MUST toggle it on an already-initialized project

**Config:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `workflow.compact_content` | boolean | `false` | When `true`, loads token-minimized instruction/template/agent-persona variants wherever one is registered; falls back to canonical content everywhere else |

**See also:** [ADR-4139](../adr/4139-compact-content-seam.md), [CONFIGURATION.md](../CONFIGURATION.md#workflow-toggles), [USER-GUIDE.md](../USER-GUIDE.md)
