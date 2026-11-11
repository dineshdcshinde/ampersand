/**
 * @file Popup entry point: the controller.
 *
 * Wires the pieces together and holds no logic of its own:
 *
 *   DOM events ──► store actions ──► store emits a change ──► views re-render
 *                       │
 *   "Update URL" ──► chrome/tabs + chrome/storage
 *
 * Where things live:
 * - src/lib/      pure URL logic (no Chrome, no DOM), unit-tested
 * - src/chrome/   the only code that calls Chrome APIs
 * - src/popup/    store (state + actions) and views (DOM)
 */

import { createStore } from './src/popup/store.js';
import { renderParamList } from './src/popup/views/param-list.js';
import { openMenu, closeMenu } from './src/popup/views/menu.js';
import { createToast } from './src/popup/views/toast.js';
import { buildUrl, parseUrl, toObject } from './src/lib/url-params.js';
import { isTrackingKey } from './src/lib/tracking.js';
import { rememberUnchecked } from './src/lib/unchecked-memory.js';
import { getActiveTab, isEditable, openNextTo, setTabUrl } from './src/chrome/tabs.js';
import * as storage from './src/chrome/storage.js';

/** Show the search box once a URL has this many params. */
const SEARCH_THRESHOLD = 8;

/** Every element the controller touches, looked up once. */
const ui = {
  base: /** @type {HTMLInputElement} */ (document.getElementById('base')),
  hash: /** @type {HTMLInputElement} */ (document.getElementById('hash')),
  hashRow: document.getElementById('hashRow'),
  filterWrap: document.getElementById('filterWrap'),
  filter: /** @type {HTMLInputElement} */ (document.getElementById('filter')),
  list: document.getElementById('list'),
  emptyText: document.getElementById('emptyText'),
  textWrap: document.getElementById('bulkWrap'),
  text: /** @type {HTMLTextAreaElement} */ (document.getElementById('bulk')),
  tracking: document.getElementById('tracking'),
  trackingText: document.getElementById('trackingText'),
  cleanButton: document.getElementById('cleanBtn'),
  moreButton: document.getElementById('moreBtn'),
  copyButton: document.getElementById('copyBtn'),
  applyButton: /** @type {HTMLButtonElement} */ (document.getElementById('applyBtn')),
  menu: document.getElementById('menu'),
  toast: document.getElementById('toast'),
};

const store = createStore();
const toast = createToast(ui.toast);

/** Set once at start-up. */
const session = {
  /** @type {chrome.tabs.Tab} */ tab: /** @type {any} */ (null),
  /** @type {import('./src/chrome/storage.js').Settings} */ settings: { noReload: false },
  /** @type {string[]} URLs before each update, for "Undo last update". */ history: [],
};

/* =========================================================================
   Rendering
   ========================================================================= */

/**
 * Redraw after a store change.
 *
 * @param {import('./src/popup/store.js').ChangeKind} kind
 */
function render(kind) {
  if (kind === 'list') renderStructure();
  renderSummary();
}

/** The parts that depend on which params exist: rows, search, text mode, fragment. */
function renderStructure() {
  const { state } = store;
  const searching = state.filter.trim() !== '';

  ui.filterWrap.hidden = state.textMode || (state.params.length < SEARCH_THRESHOLD && !searching);
  ui.list.hidden = state.textMode;
  ui.textWrap.hidden = !state.textMode;
  ui.emptyText.hidden = state.textMode || state.params.length > 0;
  ui.hashRow.hidden = !state.hash && !state.originalHash;
  syncInput(ui.base, state.base);
  syncInput(ui.hash, state.hash);

  if (state.textMode) {
    if (ui.text.value !== state.text) ui.text.value = state.text;
    return;
  }

  renderParamList(
    ui.list,
    {
      params: store.visibleParams(),
      showAddRow: !searching,
      isFirstParam: state.params.length === 0,
    },
    {
      onEdit: (id, changes) => store.editParam(id, changes),
      onRemove: removeParam,
      onCopy: (text) => copyText(text),
      onAdd: (key, value) => store.addParam(key, value),
    },
  );
}

/**
 * Put a value in an input, unless the user is typing in it right now.
 *
 * @param {HTMLInputElement} input
 * @param {string} value
 */
function syncInput(input, value) {
  if (document.activeElement !== input && input.value !== value) input.value = value;
  input.title = value;
}

/** The parts that depend on values: the tracking notice, Update button state, edited markers. */
function renderSummary() {
  const { state } = store;
  const keys = store.trackingKeys();
  ui.tracking.hidden = keys.length === 0;
  if (keys.length) {
    const named = keys.slice(0, 3).join(', ') + (keys.length > 3 ? ` +${keys.length - 3}` : '');
    ui.trackingText.textContent = `${named} ${keys.length === 1 ? 'is a tracking param' : 'are tracking params'}.`;
  }
  ui.applyButton.disabled = !store.isDirty();
  ui.base.classList.toggle('edited', state.base !== state.originalBase);
  ui.hash.classList.toggle('edited', state.hash !== state.originalHash);
}

/* =========================================================================
   Actions
   ========================================================================= */

/** @param {number} id */
function removeParam(id) {
  const result = store.removeParam(id);
  if (result) toast(`Removed ${result.removed.key || 'param'}`, result.undo);
}

function removeTracking() {
  const { count, undo } = store.removeTracking();
  toast(`Removed ${count} tracking param${count === 1 ? '' : 's'}`, undo);
}

/**
 * @param {string} text
 * @param {string} [message] Toast to show. Row copy buttons show a tick instead.
 * @returns {Promise<boolean>}
 */
async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    if (message) toast(message);
    return true;
  } catch {
    toast('Couldn’t copy');
    return false;
  }
}

/**
 * Send the edited URL to the tab, or to a new tab.
 *
 * @param {{newTab?: boolean}} [options]
 */
async function applyUrl({ newTab = false } = {}) {
  const url = store.currentUrl();
  if (!isValidUrl(url)) {
    toast('That address isn’t a valid URL');
    return;
  }
  if (newTab) {
    await openNextTo(session.tab, url);
    return;
  }
  if (!store.isDirty()) return;

  // Save before navigating: the popup may close when the page reloads.
  const { state } = store;
  await storage.saveUnchecked(session.tab.id, state.base, rememberUnchecked(store.currentParams()));
  session.history.push(state.originalUrl);
  await storage.saveHistory(session.tab.id, session.history);

  const ok = await setTabUrl(session.tab, url, { withoutReload: session.settings.noReload });
  if (!ok) {
    session.history.pop();
    toast('Couldn’t update this tab');
    return;
  }
  session.tab.url = url;
  store.load(url, await storage.loadUnchecked(session.tab.id, state.base));
  toast('URL updated');
}

/** Go back to the URL before the last "Update URL". */
async function undoLastUpdate() {
  const previous = session.history.pop();
  if (!previous) return;
  await storage.saveHistory(session.tab.id, session.history);
  const ok = await setTabUrl(session.tab, previous, { withoutReload: session.settings.noReload });
  if (!ok) {
    toast('Couldn’t update this tab');
    return;
  }
  session.tab.url = previous;
  store.load(previous, await storage.loadUnchecked(session.tab.id, store.state.base));
  toast('Went back to the previous URL');
}

function addUtmParams() {
  const first = store.addUtmParams();
  if (!first) {
    toast('UTM params are already here');
    return;
  }
  /** @type {HTMLElement | null} */ (ui.list.querySelector(`.row[data-id="${first.id}"] .v`))?.focus();
}

function toggleNoReload() {
  session.settings.noReload = !session.settings.noReload;
  storage.saveSettings(session.settings);
}

/* =========================================================================
   The ⋯ menu
   ========================================================================= */

/** @returns {import('./src/popup/views/menu.js').MenuItem[]} */
function menuItems() {
  const { state } = store;
  const params = store.currentParams();
  const withoutTracking = buildUrl({
    base: state.base,
    hash: state.hash,
    params: params.filter((p) => !isTrackingKey(p.key)),
  });

  return [
    { label: 'Open in new tab', hint: 'Ctrl+Enter', run: () => applyUrl({ newTab: true }) },
    { label: 'Undo last update', disabled: session.history.length === 0, run: undoLastUpdate },
    'separator',
    { label: 'Copy without tracking', run: () => copyText(withoutTracking, 'Copied without tracking') },
    { label: 'Copy params as JSON', run: () => copyText(JSON.stringify(toObject(params), null, 2), 'Copied as JSON') },
    'separator',
    { label: state.textMode ? 'Back to list' : 'Edit as text', run: toggleTextMode },
    { label: 'Add UTM params', run: addUtmParams },
    { label: 'Sort A to Z', disabled: state.textMode || state.params.length < 2, run: () => store.sortByKey() },
    { label: 'Remove all params', disabled: params.length === 0, run: () => toast('Removed all params', store.removeAll()) },
    'separator',
    {
      label: 'Don’t reload the page',
      detail: 'Only change the address bar',
      checked: session.settings.noReload,
      run: toggleNoReload,
    },
  ];
}

function toggleTextMode() {
  store.toggleTextMode();
  if (store.state.textMode) ui.text.focus();
}

/* =========================================================================
   Wiring
   ========================================================================= */

function bindEvents() {
  ui.base.addEventListener('input', () => store.setBase(ui.base.value));
  ui.hash.addEventListener('input', () => store.setHash(ui.hash.value));
  ui.filter.addEventListener('input', () => store.setFilter(ui.filter.value));
  ui.text.addEventListener('input', () => store.setText(ui.text.value));
  ui.cleanButton.addEventListener('click', removeTracking);
  ui.copyButton.addEventListener('click', () => copyText(store.currentUrl(), 'URL copied'));
  ui.applyButton.addEventListener('click', () => applyUrl());

  ui.moreButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (ui.menu.hidden) openMenu(ui.menu, ui.moreButton, menuItems());
    else closeMenu(ui.menu);
  });
  document.addEventListener('click', (event) => {
    if (!ui.menu.contains(/** @type {Node} */ (event.target))) closeMenu(ui.menu);
  });

  document.addEventListener('keydown', onKeyDown);
}

/**
 * Keyboard shortcuts:
 * - Enter: Update URL
 * - Ctrl/Cmd+Enter: open in a new tab
 * - Esc: close the menu (otherwise Chrome closes the popup)
 *
 * @param {KeyboardEvent} event
 */
function onKeyDown(event) {
  if (event.key === 'Escape' && !ui.menu.hidden) {
    event.preventDefault();
    closeMenu(ui.menu);
    ui.moreButton.focus();
    return;
  }
  if (event.key !== 'Enter' || event.shiftKey) return;

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    applyUrl({ newTab: true });
    return;
  }
  const target = /** @type {HTMLElement} */ (event.target);
  if (target === ui.text || target.tagName === 'BUTTON') return; // newline in text mode; buttons click themselves
  event.preventDefault();
  applyUrl();
}

/* =========================================================================
   Start
   ========================================================================= */

/**
 * @param {string} url
 * @returns {boolean}
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** Load the tab's URL and show it. */
async function start() {
  const tab = await getActiveTab();
  if (!tab || !isEditable(tab)) {
    document.body.innerHTML = '<p class="note solo">Open a normal web page to see its URL params.</p>';
    return;
  }
  session.tab = tab;
  session.settings = await storage.loadSettings();
  session.history = await storage.loadHistory(tab.id);

  store.subscribe(render);
  bindEvents();

  const { base } = parseUrl(tab.url);
  store.load(tab.url, await storage.loadUnchecked(tab.id, base));

  // Start where the user most likely wants to type.
  const first = ui.list.querySelector(store.state.params.length ? '.row .v' : '.row.add .k');
  /** @type {HTMLElement | null} */ (first)?.focus();
}

start();
