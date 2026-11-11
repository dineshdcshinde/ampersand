/**
 * @file Read and change the browser tab (an adapter over chrome.tabs and chrome.scripting).
 */

/**
 * The tab the popup was opened on. Requires the `activeTab` permission,
 * which Chrome grants when the user clicks the toolbar icon.
 *
 * @returns {Promise<chrome.tabs.Tab | null>}
 */
export async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  } catch {
    return null;
  }
}

/**
 * Can Ampersand edit this tab? Browser pages (chrome://, the Web Store) are off limits.
 *
 * @param {chrome.tabs.Tab | null} tab
 * @returns {boolean}
 */
export function isEditable(tab) {
  return Boolean(tab?.url) && /^(https?|file|ftp):/i.test(tab.url);
}

/**
 * Point the tab at a new URL.
 *
 * With `withoutReload`, and only when the origin stays the same, the address
 * bar is changed through `history.pushState` in the page. Nothing reloads,
 * which suits single-page apps. Otherwise it's a normal navigation.
 *
 * @param {chrome.tabs.Tab} tab
 * @param {string} url
 * @param {{withoutReload?: boolean}} [options]
 * @returns {Promise<boolean>} `true` if the tab was updated.
 */
export async function setTabUrl(tab, url, { withoutReload = false } = {}) {
  try {
    if (withoutReload && sameOrigin(url, tab.url)) {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: pushStateInPage,
        args: [url],
      });
      if (result?.result) return true;
    }
    await chrome.tabs.update(tab.id, { url });
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a URL in a new tab right after the current one.
 *
 * @param {chrome.tabs.Tab} tab
 * @param {string} url
 */
export function openNextTo(tab, url) {
  return chrome.tabs.create({ url, index: tab.index + 1 });
}

/**
 * Runs *inside the web page* (injected by chrome.scripting), so it may only
 * use its arguments. It can't see anything in this file.
 *
 * @param {string} url
 * @returns {boolean}
 */
function pushStateInPage(url) {
  try {
    history.pushState(history.state, '', url);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
