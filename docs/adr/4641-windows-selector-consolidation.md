# ADR-4641: One Windows test selector, and a proportional ceiling on the conformance tier

- **Status:** Accepted
- **Date:** 2026-09-11
- **Issue:** [#4641](https://github.com/open-gsd/gsd-core/issues/4641)
- **Twin of:** [ADR-4593](./4593-macos-conformance-tier-architecture.md) (macOS conformance tier) — that ADR
  applied evidence-first sizing to the macOS signal set; this one applies the same discipline to the
  Windows signal set and to the *number of selectors*, which ADR-4593 did not cover.
- **Closes a gap in:** epic [#4589](https://github.com/open-gsd/gsd-core/issues/4589), whose goal —
  "the OS-agnostic majority of the suite runs once, on Linux, while a small and explicitly-scoped
  platform-conformance tier covers genuinely OS-specific behavior" — was not achieved by its five
  merged phases.

## Context

Epic #4589 closed 2026-09-10 with every acceptance box checked. Measured on PR #4640
([run 34618834118](https://github.com/open-gsd/gsd-core/actions/runs/34618834118)), a routine
`tests/**`-touching PR, two things were true that the goal text forbids.

### Two independent Windows selectors

| selector | gate | what it runs |
|---|---|---|
| `test` job, three `scope: windows` rows | `product_changed` | `windows_tests` = **every** changed `tests/*.test.cjs`, unconditionally |
| `test-conformance`, three windows shards | `code_changed && full_matrix` | the generated conformance tier |

The epic replaced `test-full` with `test-conformance` and never touched the first selector, which
predates it (#494, sharded in #3057). On PR #4640, **5 of 7 changed test files ran on a real Windows
runner twice.** Non-Linux job count was **7**, not the 4 the epic's closeout reported — that figure
compared `test-full` (6) against `test-conformance` (4) and omitted the three always-on `scope:
windows` shards from both sides. Counting every non-Linux job, the epic moved 9 → 7, not 6 → 4.

### The tier was 59% of the suite

`node scripts/gen-platform-conformance-tier.cjs` reported **546 of 930** eligible unit-suite files
(58.7%) when this was diagnosed. Measured on this PR's own rebased tree (931 eligible, after #4253
added a test file) the same comparison is **547 → 255**: the committed list loses exactly 292
entries and gains none. Measured per-category contribution, where `UNIQUE` is the count of files for which that
category is the **sole** signal — i.e. the marginal cost of keeping it:

| category | total | UNIQUE |
|---|---:|---:|
| `process-seam-subprocess` | 335 | **118** |
| `hardcoded-path-vs-path-call` | 328 | **108** |
| `raw-child-process` | 96 | 19 |
| `symlink-keyword` | 86 | 6 |
| `win32-darwin-literal` | 77 | 1 |
| `process-platform` | 73 | 1 |
| `chmod-mode-bit` | 73 | 4 |
| `windows-env-var` | 69 | 6 |
| `windows-shell-token` | 23 | 4 |
| `os-platform` | 2 | 0 |

Two categories carried 226 of the tier's sole-signal membership; the other eight carried 41 combined.

- **`process-seam-subprocess`** matches `runNode(` / `runGit(` / `runHook(` / `runGsdTools(` /
  `gitOrThrow(` — the repo's own `tests/helpers.cjs` entry points. Going *through* the seam is the
  opposite of a platform signal: `src/shell-command-projection.cts` takes `platform` as an injected
  parameter, and `tests/shell-command-projection-dispatch.test.cjs` already exercises
  PowerShell/cmd.exe/PATHEXT in-process on Linux by passing `platform: 'win32'` as data. That is
  epic #4589's own argument for why the cutover was safe, applied against itself.
- **`hardcoded-path-vs-path-call`** requires a `path.join|resolve|…(` call *anywhere* in the file AND
  a quoted `'/…'` literal *anywhere* in the file, with no proximity. In a Node test suite both are
  universal. The defect class it gestures at is already enforced by Linux-runnable ESLint rules
  under ADR-1703 (`no-hardcoded-tmp`, `no-path-literal-in-assert`).

**The repo had already reached this conclusion for one consumer and not the other.**
`gen-platform-conformance-tier.cjs` carried:

```js
// Two CATEGORIES entries precise enough for TEST-file classification (this
// module's own purpose) but far too broad for SOURCE-file reachability
const NOISY_FOR_SOURCE_REACHABILITY = new Set(['hardcoded-path-vs-path-call', 'symlink-keyword']);
```

Measured there: `classifyContent` over `src/` flagged 100 of 235 files; excluding these two narrowed
it to 28, "all verified to carry a genuine platform-conditional branch." The same over-breadth
verdict was reached, recorded, and then not applied to the tier itself.

### Why no gate caught it

Phase 2's acceptance criterion was *"conformance-tier file list exists as a single source of truth."*
It checked that the list **exists**. No phase asserted it was **small**, and no test would have
failed if the classifier had put all 930 files in. The #4591 per-file parity-baseline diff that
would have caught it was explicitly never performed — disclosed in the generator's own header as a
KNOWN LIMIT — and Phase 5 then retired `test-full`, the safety net that disclosure named as its
compensating control.

## Decision

### 1. Delete the `scope: windows` lane; port its residue to reachability

The alternative — *gating* `windows.add(file)` on `reachesConformanceTierOrSeam` — was evaluated and
**rejected as provably redundant**. For a test file that predicate is literally:

```js
if (file.startsWith('tests/') && file.endsWith('.test.cjs')) {
  const { CONFORMANCE_TIER_FILES } = loadConformanceTier();
  return CONFORMANCE_TIER_FILES.includes(file);
}
```

and the same predicate is what sets `full_matrix`, which is what turns `test-conformance` on. So
every file a gated lane would run is (a) already in the tier and (b) has already caused the
conformance lane to run the whole tier in the same workflow run. Gating does not reduce the
duplication; it makes it total.

The lane's one non-redundant contribution is the `isWindowsHint` arm — tests pulled in by a path
RULE whose *filename* contains `windows`/`win32`/`shell`/`path`. That is a filename substring
heuristic, precisely the kind of unproven heuristic #4592 replaced with reachability. It is
therefore **ported into `reachesConformanceTierOrSeam`**: such a RULE-pulled test now sets
`full_matrix = true`, and the conformance lane covers it. The signal is preserved; the parallel lane
is not.

**The escalation is tier-backed, and that condition is load-bearing.** Three variants were measured
over the 16 entries of `RULES`:

| variant | predicate | rules firing | verdict |
|---|---|---:|---|
| A | `isWindowsHint(t)` | 6/16 | Can fire on a test that is **not** in the tier — `full_matrix` goes true, the conformance lane runs, and the hinted test still never runs on Windows. Cost without coverage. |
| **B (shipped)** | `isWindowsHint(t) && reachesConformanceTierOrSeam(t)` | 6/16 | Identical firing set to A *today*, so no behavior change — but correct by construction: it can only escalate when the conformance lane will actually run the file. |
| C | `reachesConformanceTierOrSeam(t)` alone | **14/16** | Rejected as over-broad. Would newly escalate most ordinary product-code PRs (`src/`, `agents/`, `commands/`, `hooks/`, `skills/`, config paths) — tier membership alone is too weak a trigger. |

A and B coincide only because every windows-hint test currently pulled in by a rule happens to be in
the tier except one (`tests/normalize-path-in-content.rule.test.cjs`, which has zero signals). B is
shipped because that coincidence is not an invariant.

Live effect is deliberately small: of the six rules that fire, four already set `fullMatrix: true`
(no-op), `inert CI`'s escalation is overridden downstream by the inert-CI reset, and exactly one —
`portability lint rules (ADR-1703)` — genuinely changes behavior.

`test-conformance` becomes the **sole** Windows selector, matching how it already is the sole macOS
selector.

### 2. Remove the two house-idiom detectors

`process-seam-subprocess` and `hardcoded-path-vs-path-call` are deleted from `CATEGORIES`.
`hardcoded-path-vs-path-call` leaves `NOISY_FOR_SOURCE_REACHABILITY` with it (the set now holds
`symlink-keyword` alone). Tier, measured on one tree: **547 → 255 of 931 (58.8% → 27.4%)** — 292 files removed, none added.

Measured, the change is surgical: `src/` reachability is **28 → 28, zero files change status**,
because `hardcoded-path-vs-path-call` was already excluded there and no `src/` file matches the
test-helper regexes. Phase 3's classifier behavior for `src/` diffs is provably unchanged.

### 3. A proportional ceiling, asserted failing-first

The missing Phase 2 gate is added as a test, and it is expressed as a **ratio against a live
denominator**, not a count:

| tier | measured | ceiling |
|---|---:|---:|
| Windows (`CONFORMANCE_TIER_FILES`) | 27.4% | **33%** |
| macOS (`MACOS_CONFORMANCE_TIER_FILES`) | 21.2% | **25%** |

An absolute count goes stale as the suite grows and silently stops binding; the property that
matters — "a tier, not the suite" — is inherently proportional. The ceiling is deliberately *not*
today's emitted value, which #4641 rules out explicitly as a non-bound.

## Consequences

- Non-Linux jobs on a `full_matrix` PR: **7 → 4**. Against the true pre-epic baseline of 9, epic
  #4589 plus this ADR deliver **9 → 4 (-56%)**, versus the -33% its closeout claimed against a
  denominator that excluded this lane.
- **292 test files leave real-OS Windows execution.** This is a real coverage change, not a
  refactor. It is defensible because every file leaving does so by losing a signal that was never a
  platform signal — each remains covered by the Linux run, and files that genuinely spawn outside
  the seam (`raw-child-process`, 96 files) are untouched.

  The drop-out set was audited rather than assumed. Of the 292, **14** have a filename suggesting
  platform relevance (`/windows|win32|shell|path|platform|posix|crlf|symlink|exec|spawn|subprocess/i`).
  All 14 were inspected: every one is a static/source-text analysis or a seam-mediated CLI test, not
  a real platform-behavior test. Six carry an explicit `allow-test-rule: source-text-is-the-product`
  or `structural-regression-guard` marker; the rest were read individually.

  The worked example is `tests/windows-robustness.test.cjs`, which was on this ADR's own first-draft
  "must remain in the tier" list **because of its filename**. It does not spawn anything: it reads
  other files' source text and asserts on it (`assert.match(region, /windowsHide:\s*true/)`), and its
  apparent `spawnSync(` / `execFileSync(` occurrences are string literals used as *search anchors*
  into those other files. It is fully Linux-runnable and correctly drops out. Selecting it by name
  would have been the same error the classifier makes — and a test now pins that it drops out, with
  the reason, so nobody "fixes" it back in.

  The clearest statement of this ADR's thesis is one the repo already wrote. `tests/hardcoded-paths.test.cjs`,
  itself a drop-out, opens: *"Statically scans source files to catch hardcoded platform-specific
  paths… Catches issues that previously required a real Windows runner to detect."*
- `classify()` no longer returns a `windows_tests` key; `ci-prepare-test-scope.cjs` no longer
  accepts a `windows` scope. Both are removed rather than left inert, so a future reader cannot
  mistake a dead output for a live one.
- ADR-4593's **decision is unaffected**: `MACOS_CATEGORIES` is a separate array, `chmod-mode-bit`
  and `symlink-keyword` keep their recorded rationale and their definitions, and the macOS tier
  is unchanged — the regenerated `macos-conformance-tier.generated.cjs` is byte-identical to the one
  on `next` (`git diff` reports zero changed lines).
  Its five prose citations of the 546 figure are **left as written**: they were accurate on
  2026-09-10 and an ADR is a dated record, not a live reference page. ADR-4593 instead carries a
  short amendment note pointing here, so a reader who arrives at the 546 figure learns it has since
  moved without the original reasoning being rewritten underneath them.

  Neither tier's size is asserted as a literal count anywhere in the test suite: the ceilings are
  ratios against a live denominator, and the macOS list is pinned by comparing the committed file to
  a fresh classification of the live tree. A count hardcoded in a test is a failure scheduled for
  whenever the suite next grows — which is exactly how the first draft of this work broke.

### Risk accepted, and why it is not a rerun of #962

#962 narrowed Windows coverage and was rescinded (#4421) after a macOS-only failure merged green.
That failure was root-caused to a rendered-text-length assertion sensitive to tmpdir path length —
a violation of ADR-456's typed-surface mandate that nothing enforced. Epic #4589 **Phase 1 shipped
that enforcement** (`local/no-rendered-text-length-assert`, error from the moment it landed). The
specific defect class that made the last narrowing unsafe is now statically prevented, which is the
condition #4589 itself named as the precondition for narrowing. That is the difference, and it is
why this narrowing rests on an enforced invariant rather than on optimism.

## Rejected alternatives

- **Gate the lane instead of deleting it.** Rejected: provably redundant, shown above. Gating would
  have produced a lane whose main arm duplicates the conformance lane exactly and whose residual arm
  is a filename heuristic.
- **Keep the lane ungated as deliberate belt-and-braces.** Rejected: it does not function as a
  safety net for the files it duplicates, and for the files it does not duplicate it selects them by
  filename substring. Paying three Windows runners per PR for that is not a trade-off, it is an
  accident preserved.
- **Narrow `hardcoded-path-vs-path-call` to same-line proximity rather than deleting it.** Rejected:
  ADR-1703's Linux-runnable rules already enforce the class, so real-OS execution buys nothing.
- **Also drop `symlink-keyword`** (would give 228 rather than 254). Rejected: worth 6 unique files,
  and ADR-4593 reuses it in `MACOS_CATEGORIES` with recorded rationale.
- **Narrow `chmod-mode-bit`'s bare-octal arm.** #4641's text named this as a co-driver. Measurement
  says otherwise: 51 files match only via the bare-octal arm, but for **4** is `chmod-mode-bit` the
  sole signal. Changing it would invalidate ADR-4593's measured macOS table for a 4-file benefit.
  Rejected on evidence; the issue's claim is corrected here.
- **An absolute file-count ceiling.** Rejected: goes stale under suite growth and stops binding
  without anyone noticing — the same failure shape as Phase 2's "the list exists" criterion.
- **Relaxing `raw-child-process` to drop its `content.includes('child_process')` precondition.**
  Investigated and rejected on measurement. The narrowing appeared to unmask a false negative:
  `tests/windows-robustness.test.cjs` contains `spawnSync(` and `execFileSync(` yet does not match
  `raw-child-process`, which looked like the precondition being over-tight (its stated rationale —
  stopping a local identifier such as `spawnResult` from matching — is already served by the
  trailing paren in `\bspawnSync\(`). Relaxing it was measured to add **13** files, and reading the
  matching line in each showed **all 13 are false positives**: comment text, jsdoc prose describing
  a return shape, template-literal code fixtures fed to an ESLint rule under test, and the
  search-anchor string literals described above. There is no false negative. The precondition stays
  exactly as written, and this paragraph exists so the same apparent bug is not "fixed" next time.
