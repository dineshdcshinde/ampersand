/**
 * @file Remember unchecked params so they survive "Update URL".
 *
 * An unchecked param is not in the new URL, so after the page reloads the
 * popup can't see it any more. We save it, *with its position*, and put it
 * back in the same slot next time, so ticking it again restores the original
 * order.
 */

import { encodedParts, paramFromUrl } from './url-params.js';

/**
 * What we store for one unchecked param.
 *
 * @typedef {Object} UncheckedEntry
 * @property {number}  position  Index in the full list (checked and unchecked) when saved.
 * @property {string}  rawKey    Encoded key.
 * @property {string}  rawValue  Encoded value.
 * @property {boolean} hasEquals
 */

/**
 * Describe every unchecked param, with its position, so it can be saved.
 * Empty rows don't count towards positions.
 *
 * @param {import('./url-params.js').Param[]} params The full list, in display order.
 * @returns {UncheckedEntry[]}
 */
export function rememberUnchecked(params) {
  const entries = [];
  params
    .filter((p) => p.key !== '' || p.value !== '')
    .forEach((p, position) => {
      if (p.enabled) return;
      const { key, value, withEquals } = encodedParts(p);
      entries.push({ position, rawKey: key, rawValue: value, hasEquals: withEquals });
    });
  return entries;
}

/**
 * Put saved unchecked params back into a freshly parsed list, each at its
 * saved position. Inserting in ascending order rebuilds the original order
 * exactly. Entries already present in the URL are skipped.
 *
 * @param {import('./url-params.js').Param[]} params Params parsed from the current URL.
 * @param {UncheckedEntry[]} entries Saved entries.
 * @returns {import('./url-params.js').Param[]} A new list. The input isn't mutated.
 */
export function restoreUnchecked(params, entries) {
  const result = params.slice();
  const sorted = entries.slice().sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
  for (const e of sorted) {
    const alreadyThere = result.some((p) => p.rawKey === e.rawKey && p.rawValue === e.rawValue);
    if (alreadyThere) continue;
    const at = Number.isInteger(e.position) ? Math.min(e.position, result.length) : result.length;
    result.splice(at, 0, paramFromUrl(e.rawKey, e.rawValue, e.hasEquals, false));
  }
  return result;
}
