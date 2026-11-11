/**
 * @file Draws the list of params: one row per param, plus an "Add param" row.
 *
 * The view only draws and reports what the user did through callbacks.
 * It never changes data itself, which is the store's job.
 */

import { ICON_ADD, ICON_COPY, ICON_DONE, ICON_REMOVE } from './icons.js';

/** Longest a value box grows before it scrolls, in px. */
const MAX_VALUE_HEIGHT = 120;

/**
 * @typedef {import('../../lib/url-params.js').Param} Param
 *
 * @typedef {Object} ListCallbacks
 * @property {(id: number, changes: Partial<Param>) => void} onEdit   User typed in a row or ticked its checkbox.
 * @property {(id: number) => void}                         onRemove User clicked ✕.
 * @property {(text: string) => Promise<boolean>}           onCopy   User clicked copy. Resolves `true` on success.
 * @property {(key: string, value: string) => void}         onAdd    User started typing in the "Add param" row.
 */

/**
 * Render the rows into `container`, replacing what was there.
 *
 * Keeps keyboard focus and caret: if the user was typing in a row, the same
 * field of the same param is focused again after rendering. If they were
 * typing in the "Add param" row, focus moves to the param it just created.
 *
 * @param {HTMLElement} container
 * @param {{params: Param[], showAddRow: boolean, isFirstParam: boolean}} model
 * @param {ListCallbacks} callbacks
 */
export function renderParamList(container, { params, showAddRow, isFirstParam }, callbacks) {
  const focus = captureFocus(container);

  container.textContent = '';
  for (const param of params) container.appendChild(createRow(param, callbacks));
  if (showAddRow) container.appendChild(createAddRow(isFirstParam, callbacks));

  container.querySelectorAll('.v').forEach(fitHeight);
  restoreFocus(container, focus, params);
}

/* ---------- rows ---------- */

/**
 * One param: [checkbox] [key] [value] [copy] [✕].
 *
 * @param {Param} param
 * @param {ListCallbacks} callbacks
 * @returns {HTMLElement}
 */
function createRow(param, callbacks) {
  const row = el('div', 'row');
  row.setAttribute('role', 'listitem');
  row.dataset.id = String(param.id);
  const name = () => param.key || 'this param';

  const checkbox = el('input');
  checkbox.type = 'checkbox';
  checkbox.checked = param.enabled;
  checkbox.title = 'Include in URL';
  checkbox.setAttribute('aria-label', `Include ${name()} in the URL`);

  const keyInput = el('input', 'k');
  keyInput.value = param.key;
  keyInput.placeholder = 'key';
  keyInput.spellcheck = false;
  keyInput.setAttribute('aria-label', 'Param name');

  const valueInput = el('textarea', 'v');
  valueInput.rows = 1;
  valueInput.value = param.value;
  valueInput.placeholder = param.original ? '' : 'value';
  valueInput.spellcheck = false;
  valueInput.setAttribute('aria-label', `Value of ${name()}`);

  const copyButton = iconButton('act copy', ICON_COPY, 'Copy value', `Copy value of ${name()}`);
  const removeButton = iconButton('act remove', ICON_REMOVE, 'Remove', `Remove ${name()}`);
  const actions = el('div', 'acts');
  actions.append(copyButton, removeButton);

  /** Repaint this row's state classes from the param. */
  const paint = () => {
    const o = param.original;
    row.classList.toggle('off', !param.enabled);
    keyInput.classList.toggle('edited', !o || param.key !== o.key);
    valueInput.classList.toggle('edited', o ? param.value !== o.value : param.value !== '');
  };

  checkbox.addEventListener('change', () => {
    callbacks.onEdit(param.id, { enabled: checkbox.checked });
    paint();
  });
  keyInput.addEventListener('input', () => {
    callbacks.onEdit(param.id, { key: keyInput.value });
    paint();
  });
  valueInput.addEventListener('input', () => {
    valueInput.value = valueInput.value.replace(/\n/g, ''); // values are single-line
    callbacks.onEdit(param.id, { value: valueInput.value });
    fitHeight(valueInput);
    paint();
  });
  copyButton.addEventListener('click', async () => {
    if (await callbacks.onCopy(param.value)) flashDone(copyButton);
  });
  removeButton.addEventListener('click', () => callbacks.onRemove(param.id));

  row.append(checkbox, keyInput, valueInput, actions);
  paint();
  return row;
}

/**
 * The always-empty last row. Typing in it creates a real param.
 *
 * @param {boolean} isFirstParam Shows a plainer placeholder when the URL has no params.
 * @param {ListCallbacks} callbacks
 * @returns {HTMLElement}
 */
function createAddRow(isFirstParam, callbacks) {
  const row = el('div', 'row add');
  row.insertAdjacentHTML('beforeend', ICON_ADD);

  const keyInput = el('input', 'k');
  keyInput.placeholder = isFirstParam ? 'key' : 'Add param';
  keyInput.spellcheck = false;
  keyInput.setAttribute('aria-label', 'New param name');

  const valueInput = el('textarea', 'v');
  valueInput.rows = 1;
  valueInput.placeholder = 'value';
  valueInput.spellcheck = false;
  valueInput.setAttribute('aria-label', 'New param value');

  const add = () => callbacks.onAdd(keyInput.value, valueInput.value.replace(/\n/g, ''));
  keyInput.addEventListener('input', add);
  valueInput.addEventListener('input', add);

  row.append(keyInput, valueInput);
  return row;
}

/* ---------- focus ---------- */

/**
 * @typedef {{id: string | undefined, field: 'k' | 'v', caret: number}} FocusInfo
 */

/**
 * @param {HTMLElement} container
 * @returns {FocusInfo | null}
 */
function captureFocus(container) {
  const active = /** @type {HTMLInputElement | null} */ (document.activeElement);
  const row = active?.closest?.('.row');
  if (!row || !container.contains(row) || !active.matches('.k, .v')) return null;
  return {
    id: /** @type {HTMLElement} */ (row).dataset.id,
    field: active.classList.contains('k') ? 'k' : 'v',
    caret: active.selectionStart ?? active.value.length,
  };
}

/**
 * @param {HTMLElement} container
 * @param {FocusInfo | null} focus
 * @param {Param[]} params
 */
function restoreFocus(container, focus, params) {
  if (!focus) return;
  // Typing in the "Add param" row created a param at the end, so continue there.
  const id = focus.id ?? String(params.at(-1)?.id);
  const field = /** @type {HTMLInputElement | null} */ (
    container.querySelector(`.row[data-id="${id}"] .${focus.field}`)
  );
  if (!field) return;
  const caret = focus.id ? focus.caret : field.value.length;
  field.focus();
  field.setSelectionRange(caret, caret);
}

/* ---------- small helpers ---------- */

/**
 * Grow a value box to fit its text, up to {@link MAX_VALUE_HEIGHT}.
 *
 * @param {HTMLTextAreaElement} textarea
 */
function fitHeight(textarea) {
  textarea.style.height = 'auto';
  const h = textarea.scrollHeight;
  textarea.style.height = `${Math.min(h, MAX_VALUE_HEIGHT)}px`;
  textarea.style.overflowY = h > MAX_VALUE_HEIGHT ? 'auto' : 'hidden';
}

/**
 * Briefly swap the copy icon for a tick.
 *
 * @param {HTMLButtonElement} button
 */
function flashDone(button) {
  button.innerHTML = ICON_DONE;
  button.classList.add('done');
  setTimeout(() => {
    button.innerHTML = ICON_COPY;
    button.classList.remove('done');
  }, 1200);
}

/**
 * @param {string} className
 * @param {string} icon SVG markup.
 * @param {string} title Tooltip.
 * @param {string} label Accessible name.
 * @returns {HTMLButtonElement}
 */
function iconButton(className, icon, title, label) {
  const button = /** @type {HTMLButtonElement} */ (el('button', className));
  button.innerHTML = icon;
  button.title = title;
  button.setAttribute('aria-label', label);
  return button;
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string} [className]
 * @returns {HTMLElementTagNameMap[K]}
 */
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
