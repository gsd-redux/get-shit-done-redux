'use strict';

/**
 * Suite classification by filename suffix (#4591 packaging fix — extracted
 * from scripts/run-tests.cjs so a SHIPPED script, e.g.
 * scripts/gen-platform-conformance-tier.cjs, can depend on it: run-tests.cjs
 * itself does not ship (it is a repo-development-only tool), so a shipped
 * file requiring it directly is MODULE_NOT_FOUND in a published install
 * (tests/packaging-shipped-scripts-require-only-shipped.test.cjs, #2858).
 * run-tests.cjs re-exports suiteOf from here unchanged for full backward
 * compatibility — this is a pure relocation, not a behavior change.
 *
 * A file with no suite suffix (plain `foo.test.cjs`) belongs to the `unit`
 * suite and returns `null` here; a suite-tagged file (`foo.install.test.cjs`)
 * returns its marker string.
 */

const { basename } = require('node:path');

const MARKED_SUITES = ['integration', 'install', 'security', 'slow', 'qa'];

function suiteOf(filename) {
  const name = basename(filename);
  if (!name.endsWith('.test.cjs')) return null;
  const base = name.slice(0, -'.test.cjs'.length);
  const lastDot = base.lastIndexOf('.');
  if (lastDot === -1) return null;
  const marker = base.slice(lastDot + 1);
  return MARKED_SUITES.includes(marker) ? marker : null;
}

module.exports = { MARKED_SUITES, suiteOf };
