/**
 * @file The popup's state and every action that changes it.
 *
 * Patterns:
 * - **Observer**: views call `subscribe()` and are told what kind of change happened.
 * - **Memento**: destructive actions return an `undo()` that restores a snapshot.
 *
 * The store knows nothing about the DOM or Chrome, so tests/store.test.js
 * can test it directly in Node.
 */

import { buildUrl, newParam, parseUrl } from '../lib/url-params.js';
import { isTrackingKey, UTM_KEYS } from '../lib/tracking.js';
import { restoreUnchecked } from '../lib/unchecked-memory.js';
import { paramsFromText, paramsToText } from '../lib/text-format.js';

/**
 * What changed, so views redo only what they must:
 * - `'list'`  the set or order of params changed: re-render the rows.
 * - `'edit'`  a value changed in place: rows are already up to date, just refresh the summary.
 *
 * @typedef {'list' | 'edit'} ChangeKind
 */

/**
 * @typedef {Object} State
 * @property {string} originalUrl The tab's URL when loaded. "Dirty" means the built URL differs.
 * @property {string} originalBase
 * @property {string} originalHash
 * @property {string} base   Editable origin + path.
 * @property {string} hash   Editable fragment, without "#".
 * @property {import('../lib/url-params.js').Param[]} params Full list in display order.
 * @property {string} filter   Search text. Empty means show all.
 * @property {boolean} textMode "Edit as text" is open.
 * @property {string} text     Textarea contents while in text mode.
 */

/** @typedef {() => void} Undo */

/**
 * Create a store. One per popup.
 */
export function createStore() {
  /** @type {State} */
  const state = {
    originalUrl: '',
    originalBase: '',
    originalHash: '',
    base: '',
    hash: '',
    params: [],
    filter: '',
    textMode: false,
    text: '',
  };

  /** @type {Set<(kind: ChangeKind) => void>} */
  const listeners = new Set();

  /** @param {ChangeKind} kind */
  const emit = (kind) => listeners.forEach((fn) => fn(kind));

  /**
   * Take a snapshot of the list, and return a function that restores it.
   *
   * @returns {Undo}
   */
  const snapshot = () => {
    const saved = state.params.slice();
    return () => {
      state.params = saved;
      emit('list');
    };
  };

  /** Leave text mode, applying the text first, so list actions see the latest edits. */
  const commitText = () => {
    if (!state.textMode) return;
    state.params = paramsFromText(state.text, state.params);
    state.textMode = false;
  };

  return {
    state,

    /**
     * Listen for changes.
     *
     * @param {(kind: ChangeKind) => void} listener
     * @returns {() => void} Unsubscribe.
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /* ---------- reading ---------- */

    /**
     * The params as they currently stand, including unsaved text-mode edits.
     *
     * @returns {import('../lib/url-params.js').Param[]}
     */
    currentParams() {
      return state.textMode ? paramsFromText(state.text, state.params) : state.params;
    },

    /** @returns {string} The URL that "Update URL" would send. */
    currentUrl() {
      return buildUrl({ base: state.base, hash: state.hash, params: this.currentParams() });
    },

    /** @returns {boolean} Is there anything to apply? */
    isDirty() {
      return this.currentUrl() !== state.originalUrl;
    },

    /** @returns {import('../lib/url-params.js').Param[]} The rows the search filter lets through. */
    visibleParams() {
      const q = state.filter.trim().toLowerCase();
      if (!q) return state.params;
      return state.params.filter((p) => p.key.toLowerCase().includes(q) || p.value.toLowerCase().includes(q));
    },

    /** @returns {string[]} Distinct keys of checked tracking params. */
    trackingKeys() {
      const keys = this.currentParams().filter((p) => p.enabled && isTrackingKey(p.key)).map((p) => p.key);
      return [...new Set(keys)];
    },

    /* ---------- loading ---------- */

    /**
     * Load a URL, plus any unchecked params remembered for it.
     *
     * @param {string} url
     * @param {import('../lib/unchecked-memory.js').UncheckedEntry[]} [unchecked=[]]
     */
    load(url, unchecked = []) {
      const { base, hash, params } = parseUrl(url);
      Object.assign(state, {
        originalUrl: url,
        originalBase: base,
        originalHash: hash,
        base,
        hash,
        params: restoreUnchecked(params, unchecked),
        textMode: false,
        text: '',
      });
      emit('list');
    },

    /* ---------- editing in place ---------- */

    /** @param {string} base */
    setBase(base) {
      state.base = base;
      emit('edit');
    },

    /** @param {string} hash A leading "#" is ignored. */
    setHash(hash) {
      state.hash = hash.replace(/^#/, '');
      emit('edit');
    },

    /**
     * Change one param in place. The param object is mutated, so a row
     * holding it sees the new values straight away.
     *
     * @param {number} id
     * @param {Partial<Pick<import('../lib/url-params.js').Param, 'key' | 'value' | 'enabled'>>} changes
     */
    editParam(id, changes) {
      const param = state.params.find((p) => p.id === id);
      if (!param) return;
      Object.assign(param, changes);
      emit('edit');
    },

    /** @param {string} text */
    setFilter(text) {
      state.filter = text;
      emit('list');
    },

    /** @param {string} text */
    setText(text) {
      state.text = text;
      emit('edit');
    },

    /* ---------- changing the list ---------- */

    /**
     * Add one param at the end.
     *
     * @param {string} key
     * @param {string} value
     * @returns {import('../lib/url-params.js').Param} The new param.
     */
    addParam(key, value) {
      const param = newParam(key, value);
      state.params.push(param);
      emit('list');
      return param;
    },

    /**
     * Add the standard UTM params that aren't already there.
     *
     * @returns {import('../lib/url-params.js').Param | null} The first one added, or `null` if all exist.
     */
    addUtmParams() {
      commitText();
      const missing = UTM_KEYS.filter((k) => !state.params.some((p) => p.key === k));
      const added = missing.map((k) => newParam(k, ''));
      state.params.push(...added);
      emit('list');
      return added[0] ?? null;
    },

    /**
     * @param {number} id
     * @returns {{removed: import('../lib/url-params.js').Param, undo: Undo} | null}
     */
    removeParam(id) {
      const removed = state.params.find((p) => p.id === id);
      if (!removed) return null;
      const undo = snapshot();
      state.params = state.params.filter((p) => p.id !== id);
      emit('list');
      return { removed, undo };
    },

    /** @returns {{count: number, undo: Undo}} */
    removeTracking() {
      commitText();
      const undo = snapshot();
      const before = state.params.length;
      state.params = state.params.filter((p) => !isTrackingKey(p.key));
      emit('list');
      return { count: before - state.params.length, undo };
    },

    /** @returns {Undo} */
    removeAll() {
      commitText();
      const undo = snapshot();
      state.params = [];
      emit('list');
      return undo;
    },

    /** Sort by key, A to Z, numbers in natural order (`p2` before `p10`). */
    sortByKey() {
      commitText();
      state.params = state.params
        .slice()
        .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));
      emit('list');
    },

    /** Switch between the list and "Edit as text". */
    toggleTextMode() {
      if (state.textMode) {
        commitText();
      } else {
        state.text = paramsToText(state.params);
        state.textMode = true;
        state.filter = '';
      }
      emit('list');
    },
  };
}

/** @typedef {ReturnType<typeof createStore>} Store */
