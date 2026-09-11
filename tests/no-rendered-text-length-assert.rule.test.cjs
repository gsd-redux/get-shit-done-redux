'use strict';

/**
 * no-rendered-text-length-assert.rule.test.cjs
 *
 * RuleTester unit tests for the local/no-rendered-text-length-assert ESLint rule.
 * Mirrors the style of tests/no-path-literal-in-assert.rule.test.cjs.
 *
 * Rule: report when a length/substring assertion is made against rendered text
 * that embeds an OS-derived path (os.tmpdir(), os.homedir(), path.join/resolve/…,
 * or a PATH_RETURNING_FNS resolver) — the #4421 incident shape.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { RuleTester } = require('eslint');

const noRenderedTextLengthAssert = require('../eslint-rules/no-rendered-text-length-assert.cjs');

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'commonjs',
  },
});

// ─── module shape ─────────────────────────────────────────────────────────────

describe('no-rendered-text-length-assert rule module', () => {
  test('exports meta and create', () => {
    assert.strictEqual(typeof noRenderedTextLengthAssert.meta, 'object');
    assert.strictEqual(typeof noRenderedTextLengthAssert.create, 'function');
    assert.strictEqual(noRenderedTextLengthAssert.meta.type, 'problem');
    assert.ok(noRenderedTextLengthAssert.meta.messages.renderedTextLength);
  });
});

// ─── INVALID cases (violation expected) ───────────────────────────────────────

describe('no-rendered-text-length-assert invalid cases', () => {
  test('invalid: matrix row 1 — template literal directly embeds path.join, .length > numeric', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [],
      invalid: [
        {
          code: '`foo ${path.join(a, b)} bar`.length > 240;',
          filename: 'tests/foo.test.cjs',
          errors: [{ messageId: 'renderedTextLength' }],
        },
      ],
    });
  });

  test('invalid: matrix row 2 — identifier resolved one hop to a template literal embedding os.tmpdir()', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [],
      invalid: [
        {
          code: `const bullet = \`x \${os.tmpdir()} y\`; bullet.length <= 240;`,
          filename: 'tests/foo.test.cjs',
          errors: [{ messageId: 'renderedTextLength' }],
        },
      ],
    });
  });

  test("invalid: matrix row 3 — KNOWN BOUNDARY: a locally shadowed `path` identifier is still name-matched as the real module (inherited from portability-vocab.cjs; same accepted boundary as sibling rule no-path-literal-in-assert). This case IS flagged, not a miss.", () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [],
      invalid: [
        {
          code: `const path = { join: () => 'safe' }; \`x \${path.join(a, b)} y\`.length > 240;`,
          filename: 'tests/foo.test.cjs',
          errors: [{ messageId: 'renderedTextLength' }],
        },
      ],
    });
  });
});

// ─── VALID cases (no violation expected) ─────────────────────────────────────

describe('no-rendered-text-length-assert valid cases', () => {
  test('valid: matrix row 1 — fixed literal, no path taint', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          code: `'literal string'.length === 5;`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 2 — no path-derived field in scope', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          code: `const obj = { name: 'foo' }; JSON.stringify(obj).length === 42;`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 3 — typed field access (the ADR-456-compliant fix shape); also not even the flagged AST shape', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          code: `json.todos[0].needs === 'yes';`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 4 — path-returning call already wrapped in a POSIX normalizer before being passed as the argument; must NOT flag', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          code: `const tmpFile = String(path.join(tmpDir(), 'x')).replace(/\\\\/g, '/'); renderX({ filePath: tmpFile }).length > 240;`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 5 — length-vs-length, no fixed numeric threshold, no truncation-boundary defect is plausible', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          code: `a.length === b.length;`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 6 — KNOWN BOUNDARY: receiver-side two-hop chain (b→a, then a is a bare Identifier not a direct path call or template literal) exceeds the one-hop budget (see rule header "Known boundaries"); documented, deliberate miss', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          code: `const a = path.join(x, y); const b = a; b.length > 240;`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 7 — KNOWN BOUNDARY: tmpFile arrives as a function PARAMETER, no declarator initializer to resolve (see rule header "Known boundaries" (b)); a different resolveOneHop code path than row 6 (binding found but not a Variable def, vs. binding found and resolved to another bare Identifier); documented, deliberate miss', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          code: `function makeAssertion(tmpFile) { tmpFile.length > 240; }`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 8 — hostile/malformed: an identifier with no resolvable declaration anywhere in scope must not crash the rule and must not be flagged', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          code: `undeclaredIdentifier.length > 240;`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 9 — KNOWN NON-GOAL (not a known boundary miss, a deliberate scope decision): the literal historical #4421/#2618 incident shape (call-argument taint) is out of scope for this rule', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          // KNOWN NON-GOAL (not a known boundary miss, a deliberate scope
          // decision): this is the literal historical #4421/#2618 incident
          // shape, but detecting it would require tracing into renderX's own
          // function body to know its return embeds the filePath argument —
          // out of scope for a single-file AST rule (see rule file "Known
          // boundaries" (e) and 40-design.md "Rejected" #2). An earlier
          // broader version of this rule that DID trace call arguments
          // produced false positives on ordinary
          // fs.readFileSync(path.join(...)) + assert.match patterns across
          // dozens of real files in this repo — proving the heuristic
          // unsound, not merely theoretically risky.
          code: `const tmpFile = path.join(tmpDir(), 'x'); const bullet = renderX({ filePath: tmpFile }); bullet.includes('Needs:');`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 10 — regression: earlier rule version flagged this — fs.readFileSync\'s return does not embed its path argument', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          // regression: earlier rule version flagged this — fs.readFileSync's
          // return does not embed its path argument
          code: `const md = fs.readFileSync(path.join(__dirname, 'x.md'), 'utf8'); assert.match(md, /some pattern/);`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 11 — bare path value, not embedded in a template literal — not the target defect class (see rule\'s "Known boundaries")', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          // bare path value, not embedded in a template literal — not the
          // target defect class (see rule's "Known boundaries")
          code: `path.join(a, b).length > 240;`,
          filename: 'tests/foo.test.cjs',
        },
        {
          // bare path value, not embedded in a template literal — not the
          // target defect class (see rule's "Known boundaries")
          code: `const p = path.resolve(a, b); p.length <= 240;`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 12 — regression (repo sweep, 45 false positives): file-extension check on a bare path value, not a rendered-text embedding', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          // real false-positive shape found by a repo-wide sweep: a
          // file-extension check on a path value, now correctly excluded
          code: `const full = path.join(dir, 'notes.md'); full.endsWith('.md');`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 13 — regression (repo sweep, 45 false positives): path-confinement check on a bare path value, not a rendered-text embedding', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          // real false-positive shape found by a repo-wide sweep: a
          // path-confinement check on a resolved path value, now correctly
          // excluded
          code: `const resolved = path.resolve(root, sub); resolved.startsWith(root);`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });

  test('valid: matrix row 14 — regression (repo sweep, 45 false positives): non-emptiness check on a bare path value, not a rendered-text embedding', () => {
    ruleTester.run('no-rendered-text-length-assert', noRenderedTextLengthAssert, {
      valid: [
        {
          // real false-positive shape found by a repo-wide sweep: a
          // non-emptiness check on a path value, now correctly excluded
          code: `const dir = path.dirname(x); dir.length > 0;`,
          filename: 'tests/foo.test.cjs',
        },
      ],
      invalid: [],
    });
  });
});
