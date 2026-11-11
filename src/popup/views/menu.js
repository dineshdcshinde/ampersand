/**
 * @file A small dropdown menu that works with the keyboard. Used for the ⋯ button.
 */

/**
 * @typedef {Object} MenuAction
 * @property {string}     label
 * @property {() => void} run
 * @property {string}     [hint]     Shown on the right, such as a shortcut.
 * @property {string}     [detail]   A second, quieter line under the label.
 * @property {boolean}    [disabled]
 * @property {boolean}    [checked]  Set it (true/false) to render the item as a checkbox.
 *
 * @typedef {MenuAction | 'separator'} MenuItem
 */

/**
 * Show `items` in `menu`, under `anchor`, aligned to its right edge.
 *
 * @param {HTMLElement} menu   The (hidden) menu container.
 * @param {HTMLElement} anchor The button that opened it.
 * @param {MenuItem[]} items
 */
export function openMenu(menu, anchor, items) {
  menu.textContent = '';
  for (const item of items) menu.appendChild(item === 'separator' ? separator() : menuButton(menu, item));

  menu.hidden = false;
  const box = anchor.getBoundingClientRect();
  menu.style.top = `${box.bottom + 4}px`;
  menu.style.left = `${Math.max(8, box.right - menu.offsetWidth)}px`;

  // A Chrome popup is only as tall as its content, so a short popup would cut
  // the menu off. Grow the page to fit it while it's open.
  const needed = box.bottom + 4 + menu.offsetHeight + 8;
  if (document.body.offsetHeight < needed) document.body.style.minHeight = `${needed}px`;

  /** @type {HTMLButtonElement | null} */ (menu.querySelector('button:not(:disabled)'))?.focus();
}

/** @param {HTMLElement} menu */
export function closeMenu(menu) {
  menu.hidden = true;
  document.body.style.minHeight = '';
}

/**
 * @param {HTMLElement} menu
 * @param {MenuAction} item
 * @returns {HTMLButtonElement}
 */
function menuButton(menu, item) {
  const button = document.createElement('button');
  button.disabled = Boolean(item.disabled);
  const isCheck = typeof item.checked === 'boolean';
  button.setAttribute('role', isCheck ? 'menuitemcheckbox' : 'menuitem');

  if (isCheck) {
    button.setAttribute('aria-checked', String(item.checked));
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = /** @type {boolean} */ (item.checked);
    box.tabIndex = -1;
    box.setAttribute('aria-hidden', 'true');
    button.appendChild(box);
  }

  const label = document.createElement('span');
  label.textContent = item.label;
  if (item.detail) {
    const detail = document.createElement('span');
    detail.className = 'sub';
    detail.textContent = item.detail;
    label.appendChild(detail);
  }
  button.appendChild(label);

  if (item.hint) {
    const hint = document.createElement('span');
    hint.className = 'kbd';
    hint.textContent = item.hint;
    button.appendChild(hint);
  }

  button.addEventListener('click', () => {
    closeMenu(menu);
    item.run();
  });
  return button;
}

/** @returns {HTMLElement} */
function separator() {
  const line = document.createElement('div');
  line.className = 'sep';
  line.setAttribute('role', 'separator');
  return line;
}
