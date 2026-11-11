/**
 * @file Short status messages at the bottom of the popup, with an optional Undo.
 */

/** How long a toast stays, in ms. Longer when there's an Undo to reach for. */
const DURATION = { plain: 1600, withUndo: 4000 };

/**
 * Bind toasts to an element. Returns a `show` function.
 *
 * @param {HTMLElement} element The (empty) toast container.
 * @returns {(message: string, undo?: () => void) => void}
 */
export function createToast(element) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;

  const hide = () => element.classList.remove('show');

  return function show(message, undo) {
    element.textContent = message;
    if (undo) {
      const button = document.createElement('button');
      button.textContent = 'Undo';
      button.addEventListener('click', () => {
        undo();
        hide();
      });
      element.appendChild(button);
    }
    element.style.pointerEvents = undo ? 'auto' : 'none';
    element.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(hide, undo ? DURATION.withUndo : DURATION.plain);
  };
}
