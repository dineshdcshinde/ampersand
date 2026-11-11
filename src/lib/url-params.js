/**
 * @file The URL model: turn a URL into a list of editable params and back.
 *
 * Everything here is a pure function with no Chrome or DOM access, so it can
 * be tested in Node (see tests/url-params.test.js).
 *
 * Golden rule: a param the user did not touch is written back with its
 * *original* encoding. Re-encoding untouched values (for example `+` versus
 * `%20`) can break links that a website depends on.
 */

/**
 * One query parameter, as shown in the popup.
 *
 * @typedef {Object} Param
 * @property {number}  id        Stable id used by the UI. Not part of the URL.
 * @property {string}  key       Decoded key the user sees and edits.
 * @property {string}  value     Decoded value the user sees and edits.
 * @property {boolean} enabled   `false` means unchecked: kept in the list but left out of the URL.
 * @property {string}  rawKey    Key exactly as it appeared in the URL (still encoded).
 * @property {string}  rawValue  Value exactly as it appeared in the URL (still encoded).
 * @property {boolean} hasEquals Whether the original had an "=" (`?flag` vs `?flag=`).
 * @property {{key: string, value: string, enabled: boolean} | null} original
 *           What the param looked like when the popup opened.
 *           `null` for params the user added, which are always "changed".
 */

/**
 * A URL split into the parts the popup edits.
 *
 * @typedef {Object} ParsedUrl
 * @property {string}  base   Everything before "?": origin and path.
 * @property {string}  hash   Fragment without the leading "#", or "".
 * @property {Param[]} params Query params in their original order.
 */

let lastId = 0;

/** @returns {number} A new unique param id. */
const nextId = () => ++lastId;

/**
 * Decode a query component for display. `+` means space in query strings.
 * Malformed sequences such as `%E0%A4` are returned as-is instead of throwing.
 *
 * @param {string} text Encoded text from the URL.
 * @returns {string} Human-readable text.
 */
export function decode(text) {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
}

/**
 * Encode user-typed text for a query component. Keeps `/ : @ ,` readable
 * because they are safe inside a query value.
 *
 * @param {string} text Text as the user typed it.
 * @returns {string} Encoded text.
 */
export function encode(text) {
  return encodeURIComponent(text)
    .replace(/%2F/gi, '/')
    .replace(/%3A/gi, ':')
    .replace(/%40/gi, '@')
    .replace(/%2C/gi, ',');
}

/**
 * Create a param from the raw (encoded) pieces of a URL.
 *
 * @param {string}  rawKey
 * @param {string}  rawValue
 * @param {boolean} hasEquals
 * @param {boolean} [enabled=true]
 * @returns {Param}
 */
export function paramFromUrl(rawKey, rawValue, hasEquals, enabled = true) {
  const key = decode(rawKey);
  const value = decode(rawValue);
  return {
    id: nextId(),
    key,
    value,
    enabled,
    rawKey,
    rawValue,
    hasEquals,
    original: { key, value, enabled },
  };
}

/**
 * Create a param the user is adding.
 *
 * @param {string} [key='']
 * @param {string} [value='']
 * @returns {Param}
 */
export function newParam(key = '', value = '') {
  return {
    id: nextId(),
    key,
    value,
    enabled: true,
    rawKey: '',
    rawValue: '',
    hasEquals: true,
    original: null,
  };
}

/**
 * Split a URL into base, params and hash.
 * Uses string splitting, not `new URL()`, so the original encoding and order survive.
 *
 * @example
 * parseUrl('https://a.com/p?x=1&flag#top')
 * // → { base: 'https://a.com/p', hash: 'top', params: [x=1, flag] }
 *
 * @param {string} url
 * @returns {ParsedUrl}
 */
export function parseUrl(url) {
  const hashAt = url.indexOf('#');
  const hash = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;

  const queryAt = beforeHash.indexOf('?');
  const base = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const query = queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '';

  const params = query
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      return eq >= 0
        ? paramFromUrl(pair.slice(0, eq), pair.slice(eq + 1), true)
        : paramFromUrl(pair, '', false);
    });

  return { base, hash, params };
}

/**
 * Has the user changed this param since the popup opened?
 *
 * @param {Param} param
 * @returns {boolean}
 */
export function isChanged(param) {
  const o = param.original;
  return !o || o.key !== param.key || o.value !== param.value || o.enabled !== param.enabled;
}

/**
 * Should this param appear in the URL? Unchecked and completely empty params are left out.
 *
 * @param {Param} param
 * @returns {boolean}
 */
export function isIncluded(param) {
  return param.enabled && (param.key !== '' || param.value !== '');
}

/**
 * The encoded key and value to write into the URL. An untouched key or value
 * keeps its original raw text (see the golden rule at the top of this file).
 *
 * @param {Param} param
 * @returns {{key: string, value: string, withEquals: boolean}}
 */
export function encodedParts(param) {
  const o = param.original;
  const key = o && param.key === o.key ? param.rawKey : encode(param.key);
  const value = o && param.value === o.value ? param.rawValue : encode(param.value);
  const withEquals = param.value !== '' || param.hasEquals;
  return { key, value, withEquals };
}

/**
 * One param as it appears in a query string: `key=value`, or just `key`.
 *
 * @param {Param} param
 * @returns {string}
 */
export function serializeParam(param) {
  const { key, value, withEquals } = encodedParts(param);
  return withEquals ? `${key}=${value}` : key;
}

/**
 * Join the parts back into a full URL. Only included params are written.
 *
 * @param {{base: string, hash: string, params: Param[]}} parts
 * @returns {string}
 */
export function buildUrl({ base, hash, params }) {
  const query = params.filter(isIncluded).map(serializeParam).join('&');
  return base + (query ? `?${query}` : '') + (hash ? `#${hash}` : '');
}

/**
 * Included params as a plain object. A repeated key becomes an array.
 *
 * @example
 * toObject([a=1, b=2, a=3]) // → { a: ['1', '3'], b: '2' }
 *
 * @param {Param[]} params
 * @returns {Record<string, string | string[]>}
 */
export function toObject(params) {
  /** @type {Record<string, string | string[]>} */
  const out = {};
  for (const p of params.filter(isIncluded)) {
    out[p.key] = p.key in out ? [].concat(out[p.key], p.value) : p.value;
  }
  return out;
}
