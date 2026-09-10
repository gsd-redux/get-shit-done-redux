'use strict';

/**
 * no-rendered-text-length-assert
 *
 * Enforces ADR-456's typed-surface mandate for one specific bug shape: a test
 * assertion whose pass/fail depends on the LENGTH (or a substring match sensitive
 * to length) of a rendered/templated string that embeds an OS-derived path
 * (os.tmpdir(), os.homedir(), path.join/resolve/…, or a project resolver from
 * PATH_RETURNING_FNS). Because macOS's default tmpdir prefix
 * (`/private/var/folders/…`) is longer than Linux's, such an assertion can pass
 * on one OS and fail on another — the exact shape behind #4421's incident
 * (`git show 4e75b836e9`, `tests/state-todos-render.test.cjs`).
 *
 * Triggers on:
 *   <rendered-text>.length <op> <numeric-literal>   (op: > < >= <= === !== == !=)
 *   <rendered-text>.includes|startsWith|endsWith(<literal>)
 *   assert.match(<rendered-text>, /regex/)
 * where <rendered-text> is (directly, or via one identifier hop) a TEMPLATE
 * LITERAL that interpolates a path-returning expression. A bare path-returning
 * call used as the receiver on its own — e.g. `path.join(a, b).length > 240`
 * or `const p = path.resolve(a, b); p.endsWith('.md')` — is NEVER flagged: the
 * hazard this rule targets only exists when the path's OS-dependent length is
 * embedded alongside OTHER rendered content, not when a path value is probed
 * directly about its own shape.
 *
 * DEFECT category: this rule is not itself a `DEFECT.WINDOWS-*` class (the
 * failure axis is tmpdir LENGTH across POSIX runners, not a Windows-vs-POSIX
 * separator/behavior difference) — it is an ADR-456 typed-surface-mandate
 * enforcement extension. See docs/adr/1703-portability-enforcement-architecture.md's
 * rule catalog for how it is cataloged alongside the `DEFECT.WINDOWS-*` rules.
 *
 * ── Taint model ─────────────────────────────────────────────────────────────
 *
 * ONE identifier hop: if the asserted-on expression is a bare Identifier,
 * resolve it to its `const`/`let` declarator initializer in the enclosing
 * scope, then check whether THAT resolved expression is a TEMPLATE LITERAL
 * with at least one interpolated expression that is directly a path-returning
 * call. A resolved expression that is itself directly a path-returning call
 * (no template literal involved) is NOT taint — only interpolation into a
 * larger rendered string counts. No further
 * inference through call arguments — a call's return value is not assumed to
 * embed its own arguments' content just because one argument happens to be a
 * path (a function receiving a path argument does not necessarily embed that
 * path in its output; distinguishing genuinely path-embedding renderers from
 * ordinary path-consuming functions like fs.readFileSync would require
 * tracing into the callee's body, which is out of scope for a single-file AST
 * rule — see Known boundaries (e) below, added after a repo-wide sweep with
 * the ORIGINAL two-hop design found this exact false-positive shape live in
 * the existing suite: `assert.match(md, /regex/)` where
 * `md = fs.readFileSync(path.join(...))` was flagged purely because
 * readFileSync's argument was a path, not because its return text embeds one.
 *
 * A template literal is checked by inspecting its interpolated expressions
 * directly (no extra hop spent) — `` `foo ${path.join(a,b)} bar` `` is 0-hop
 * taint at the point it is written.
 *
 * ── Known boundaries ────────────────────────────────────────────────────────
 *
 * (b) Function-parameter provenance is not traced. If the path-tainted value
 *     arrives as a parameter to the enclosing function/callback rather than a
 *     local `const`/`let` declaration, there is no declarator initializer to
 *     resolve to and the rule does not flag it.
 *
 * (c) Name-based matching only, inherited from portability-vocab.cjs's
 *     PATH_RETURNING_FNS: a shadowed local `path`/`os` identifier is STILL
 *     treated as the real module (matching sibling rule no-path-literal-in-assert's
 *     own documented boundary) — this can rarely over-fire on a shadowed name,
 *     an accepted precedent already shipped in this catalog.
 *
 * (d) Does not re-derive the production truncation threshold. This rule flags
 *     the test-side anti-pattern (asserting on rendered text that embeds a
 *     path), not the specific numeric boundary that made any one incident
 *     OS-specific — that would require analyzing the render function's own
 *     body, which is out of scope for a single-file test-lint rule.
 *
 * (e) Does not trace through any function call's arguments to infer that the
 *     call's return value embeds them. This means the LITERAL historical
 *     #4421/#2618 incident shape (a call to a cross-file production render
 *     function, e.g. `renderPendingTodoBullet({ filePath: tmpFile })`, whose
 *     return value happens to embed the argument) is NOT detected by this
 *     rule — that would require tracing into the callee's body (a different,
 *     heavier kind of analysis, evaluated and rejected — see
 *     .gsd/phase/chore-4590-rendered-text-length-assert/40-design.md
 *     "Rejected" #2). What IS detected is the same defect class written
 *     directly in the test file: a template literal that itself interpolates
 *     a path-returning expression, then has its length/substring probed. A
 *     repo-wide sweep with an earlier, broader version of this rule (tracing
 *     into call arguments) found this was the only way to keep the rule
 *     sound: it produced dozens of false positives on ordinary
 *     `fs.readFileSync(path.join(...))` + `assert.match` patterns, which are
 *     correct code, not instances of this defect.
 *
 * (f) Does not flag a bare path-returning call used directly as the receiver
 *     (with no surrounding template literal) — e.g. `path.join(a, b).length
 *     > 240`, `full.endsWith('.md')`, `resolved.startsWith(root)`, or
 *     `dir.length > 0`. Asserting a property of a path value itself (its own
 *     suffix, prefix, non-emptiness, or exact length) is a direct,
 *     deterministic check on that path — not an assertion about SOME OTHER
 *     rendered content that happens to share a string with a variable-length
 *     path — so it is not the target defect class. A repo-wide sweep with an
 *     earlier version of this rule that matched ANY direct path-returning
 *     call (with or without a template literal) found 45 false positives of
 *     exactly this shape across `tests/` — file-extension checks, path-
 *     confinement checks, and non-emptiness checks — none of which are
 *     instances of #4421's OS-tmpdir-length hazard.
 */

const {
  isPathReturningCall,
  isPosixNormalizerCall,
  unwrapString,
} = require('./lib/portability-vocab.cjs');

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow length/substring assertions on rendered text that embeds an OS-derived path (ADR-456 typed-surface mandate)',
      category: 'Portability',
    },
    schema: [],
    messages: {
      renderedTextLength:
        'Assertion depends on the length/content of rendered text that embeds an OS-derived path ' +
        '(ADR-456 typed-surface mandate): this can pass on one runner and fail on another because ' +
        "tmpdir/homedir path length differs by OS (e.g. macOS's /private/var/folders/… prefix). " +
        'Extract and assert on the underlying typed/structured field instead.',
    },
  },

  create(context) {
    const LENGTH_COMPARISON_OPERATORS = new Set([
      '>', '<', '>=', '<=', '===', '!==', '==', '!=',
    ]);
    const MEMBERSHIP_METHODS = new Set(['includes', 'startsWith', 'endsWith']);

    function isLengthMember(node) {
      return (
        node &&
        node.type === 'MemberExpression' &&
        !node.computed &&
        node.property.type === 'Identifier' &&
        node.property.name === 'length'
      );
    }

    function isNumericLiteral(node) {
      return node && node.type === 'Literal' && typeof node.value === 'number';
    }

    // Resolves `node` ONE hop if it is a bare Identifier bound by a simple
    // `const`/`let` declarator in an enclosing scope; otherwise returns `node`
    // unchanged (safe no-op passthrough for non-Identifier nodes).
    function resolveOneHop(node) {
      if (!node || node.type !== 'Identifier') return node;
      let scope = context.sourceCode
        ? context.sourceCode.getScope(node)
        : context.getScope();
      while (scope) {
        const variable = scope.variables.find((v) => v.name === node.name);
        if (variable) {
          const def = variable.defs.find((d) => d.type === 'Variable');
          if (
            def &&
            def.node.type === 'VariableDeclarator' &&
            def.node.init &&
            (def.node.parent.kind === 'const' || def.node.parent.kind === 'let')
          ) {
            return def.node.init;
          }
          return node; // found the binding but not a simple const/let init — stop
        }
        scope = scope.upper;
      }
      return node;
    }

    // True ONLY when `exprNode` is (after POSIX-normalizer suppression) a
    // TemplateLiteral with at least one interpolated expression that is
    // path-tainted. A bare path-returning call with no surrounding template
    // literal is NOT taint on its own — see "Known boundaries" (f) in the
    // file header: asserting on a path value itself (its own suffix/prefix/
    // non-emptiness/length) is not the target defect class.
    function isDirectPathTaint(exprNode) {
      if (!exprNode) return false;
      if (isPosixNormalizerCall(exprNode)) return false;
      if (exprNode.type === 'TemplateLiteral') {
        return exprNode.expressions.some((e) => isTaintedInterpolation(e));
      }
      return false;
    }

    // An interpolated expression inside a template literal counts as taint if
    // it is (after unwrapping a String() cast) directly a path-returning
    // call, or is itself a nested template literal with tainted
    // interpolation.
    function isTaintedInterpolation(exprNode) {
      if (!exprNode) return false;
      const unwrapped = unwrapString(exprNode);
      if (isPathReturningCall(unwrapped)) return true;
      if (exprNode.type === 'TemplateLiteral') {
        return exprNode.expressions.some((e) => isTaintedInterpolation(e));
      }
      return false;
    }

    // True when `receiverNode` — after ONE identifier hop — resolves to a
    // template literal with path-tainted interpolation. A bare path-returning
    // call on its own never qualifies (see "Known boundaries" (f)).
    function isPathTaintedReceiver(receiverNode) {
      if (!receiverNode) return false;
      const resolved = resolveOneHop(receiverNode);
      return isDirectPathTaint(resolved);
    }

    return {
      BinaryExpression(node) {
        if (!LENGTH_COMPARISON_OPERATORS.has(node.operator)) return;

        let receiver = null;
        if (isLengthMember(node.left) && isNumericLiteral(node.right)) {
          receiver = node.left.object;
        } else if (isLengthMember(node.right) && isNumericLiteral(node.left)) {
          receiver = node.right.object;
        } else {
          return; // both sides non-literal (a.length === b.length) — no fixed threshold
        }

        if (isPathTaintedReceiver(receiver)) {
          context.report({ node, messageId: 'renderedTextLength' });
        }
      },

      CallExpression(node) {
        const callee = node.callee;

        // <receiver>.includes|startsWith|endsWith(<arg>)
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          MEMBERSHIP_METHODS.has(callee.property.name) &&
          node.arguments.length >= 1
        ) {
          if (isPathTaintedReceiver(callee.object)) {
            context.report({ node, messageId: 'renderedTextLength' });
          }
          return;
        }

        // assert.match(<receiver>, /regex/)
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'assert' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'match' &&
          node.arguments.length >= 2
        ) {
          if (isPathTaintedReceiver(node.arguments[0])) {
            context.report({ node, messageId: 'renderedTextLength' });
          }
        }
      },
    };
  },
};

module.exports = rule;
