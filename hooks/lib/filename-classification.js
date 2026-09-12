'use strict';
// hooks/lib/filename-classification.js — hand-written, NOT generated. One
// tiny, deliberately-named filename slicer.
//
// WHY this exists: issue #4580 was caused by comparing "everything after the
// `.env.` prefix" — a multi-segment token like `local.example` — against a
// set whose members are FINAL EXTENSIONS (`example`). `.env.local.example`
// was classified by its full `local.example` tail, which is not in a set
// built from bare extensions, so the comparison silently failed. This module
// deliberately exposes ONLY the final-extension answer so the wrong token
// can't be picked by accident at a call site. The "everything after the
// first dot" form is intentionally NOT exported: no caller needs it, and an
// unused export is dead code.

/**
 * The segment after the LAST dot in `name`. A string with no dot IS its own
 * final extension. Inert on non-strings/empty input: never throws, returns
 * ''.
 *
 * @param {*} name
 * @returns {string}
 */
function finalExtension(name) {
  if (typeof name !== 'string' || name === '') return '';
  const i = name.lastIndexOf('.');
  return i === -1 ? name : name.slice(i + 1);
}

module.exports = { finalExtension };
