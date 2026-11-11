/**
 * @file "Edit as text": params as plain lines of `key=value`.
 * A line starting with `#` is an unchecked param.
 *
 * @example
 * // ?a=1&b=2 with b unchecked becomes:
 * // a=1
 * // # b=2
 */

import { newParam } from './url-params.js';

/**
 * Write params as text, one per line.
 *
 * @param {import('./url-params.js').Param[]} params
 * @returns {string}
 */
export function paramsToText(params) {
  return params
    .map((p) => {
      const prefix = p.enabled ? '' : '# ';
      const pair = p.value !== '' || p.hasEquals ? `${p.key}=${p.value}` : p.key;
      return prefix + pair;
    })
    .join('\n');
}

/**
 * Read params back from text.
 *
 * Lines that match an existing param exactly (same key and value) reuse that
 * param, so untouched params keep their original encoding. Anything else
 * becomes a new param.
 *
 * @param {string} text
 * @param {import('./url-params.js').Param[]} existing The params before text editing began.
 * @returns {import('./url-params.js').Param[]}
 */
export function paramsFromText(text, existing) {
  /** @type {Map<string, import('./url-params.js').Param[]>} key+value → unused originals */
  const pool = new Map();
  for (const p of existing) {
    if (!p.original) continue;
    const sig = signature(p.original.key, p.original.value);
    if (!pool.has(sig)) pool.set(sig, []);
    pool.get(sig).push(p);
  }

  const result = [];
  for (const rawLine of text.split('\n')) {
    if (!rawLine.trim()) continue;
    const enabled = !/^#\s?/.test(rawLine);
    const line = enabled ? rawLine : rawLine.replace(/^#\s?/, '');
    const eq = line.indexOf('=');
    const key = eq >= 0 ? line.slice(0, eq) : line;
    const value = eq >= 0 ? line.slice(eq + 1) : '';

    const match = pool.get(signature(key, value))?.shift();
    if (match) {
      result.push({ ...match, key, value, enabled });
    } else {
      const p = newParam(key, value);
      p.hasEquals = eq >= 0;
      p.enabled = enabled;
      result.push(p);
    }
  }
  return result;
}

/**
 * @param {string} key
 * @param {string} value
 * @returns {string} A lookup key for the reuse pool.
 */
function signature(key, value) {
  return `${key}\u0000${value}`;
}
