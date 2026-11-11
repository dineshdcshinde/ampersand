/**
 * @file Everything Ampersand saves, behind small functions (an adapter over chrome.storage).
 *
 * - Settings live in `storage.sync`, so they follow the user's Chrome profile.
 * - Per-tab data (undo history, unchecked params) lives in `storage.session`.
 *   That memory is cleared when the browser closes, which is what we want.
 *
 * Every call swallows errors and falls back to a default. Storage must never
 * break the popup.
 */

/**
 * @typedef {Object} Settings
 * @property {boolean} noReload Update the address bar with history.pushState instead of reloading.
 */

/** @type {Settings} */
const DEFAULT_SETTINGS = { noReload: false };

/** Max URLs kept per tab for "Undo last update". */
const HISTORY_LIMIT = 25;

/**
 * @template T
 * @param {'sync' | 'session'} area
 * @param {string} key
 * @param {T} fallback
 * @returns {Promise<T>}
 */
async function read(area, key, fallback) {
  try {
    const stored = await chrome.storage[area].get(key);
    return stored[key] ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param {'sync' | 'session'} area
 * @param {string} key
 * @param {unknown} value `null` removes the key.
 * @returns {Promise<void>}
 */
async function write(area, key, value) {
  try {
    if (value === null) await chrome.storage[area].remove(key);
    else await chrome.storage[area].set({ [key]: value });
  } catch {
    /* Saving is best-effort. */
  }
}

/** @returns {Promise<Settings>} */
export async function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(await read('sync', 'settings', {})) };
}

/** @param {Settings} settings */
export function saveSettings(settings) {
  return write('sync', 'settings', settings);
}

/**
 * URLs this tab had before each "Update URL", newest last.
 *
 * @param {number} tabId
 * @returns {Promise<string[]>}
 */
export function loadHistory(tabId) {
  return read('session', `history:${tabId}`, []);
}

/**
 * @param {number} tabId
 * @param {string[]} urls Trimmed to the newest {@link HISTORY_LIMIT}.
 */
export function saveHistory(tabId, urls) {
  return write('session', `history:${tabId}`, urls.slice(-HISTORY_LIMIT));
}

/**
 * Unchecked params saved for this tab. Only returned when they were saved
 * for the same page (`base`), so they don't leak onto other sites.
 *
 * @param {number} tabId
 * @param {string} base
 * @returns {Promise<import('../lib/unchecked-memory.js').UncheckedEntry[]>}
 */
export async function loadUnchecked(tabId, base) {
  const saved = await read('session', `unchecked:${tabId}`, null);
  return saved && saved.base === base && Array.isArray(saved.entries) ? saved.entries : [];
}

/**
 * @param {number} tabId
 * @param {string} base
 * @param {import('../lib/unchecked-memory.js').UncheckedEntry[]} entries An empty list clears it.
 */
export function saveUnchecked(tabId, base, entries) {
  return write('session', `unchecked:${tabId}`, entries.length ? { base, entries } : null);
}
