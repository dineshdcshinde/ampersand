# Ampersand

A Chrome extension that shows the current URL's query params as a simple list. Edit, untick, remove or add a param, then press Enter to update the address bar.

## Run it locally

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Pin Ampersand. Open it with a click or **Alt+Shift+U**.

After changing code, click reload ↻ on Ampersand in `chrome://extensions`.

## Project layout

```
manifest.json        Extension config: name, permissions, icon, shortcut
popup.html / .css    The popup's markup and styles
popup.js             Controller: wires the store, views and Chrome together

src/
  lib/               Pure logic. No Chrome, no DOM. Unit-tested.
    url-params.js      Parse a URL into params and rebuild it (keeps original encoding)
    tracking.js        Recognise tracking params (utm_*, gclid…)
    unchecked-memory.js  Remember unticked params *and their position*
    text-format.js     "Edit as text": params ⇄ key=value lines
  chrome/            The only code that calls Chrome APIs (adapters)
    tabs.js            Read the active tab, update its URL, open a new tab
    storage.js         Settings, undo history, unticked params
  popup/
    store.js           State + every action (Observer for changes, Memento for undo)
    views/             DOM only: param-list, menu, toast, icons

tests/               Unit tests (node:test, nothing to install)
docs/                PUBLISHING.md (store guide), PRIVACY.md (privacy policy)
store/               Store listing text, screenshots, promo tile
scripts/package.ps1  Builds dist/ampersand-<version>.zip for upload
```

### How data flows

```
user types / clicks ──► view callback ──► store action ──► store emits 'list' or 'edit'
                                                                 │
                                    popup.js render() ◄──────────┘
                                    ├─ 'list': re-draw rows (focus and caret kept)
                                    └─ always: tracking notice, Update button, edited markers

"Update URL" ──► popup.js ──► chrome/storage (save unticked + history) ──► chrome/tabs (navigate)
```

### Principles used

- **Separation of concerns.** Logic (`lib`), browser access (`chrome`), state (`store`) and drawing (`views`) are separate. Each file has one job.
- **Pure core.** Everything that decides *what the URL should be* is a pure function, so it's testable in Node in milliseconds.
- **KISS.** No framework, no build step, no dependencies. Plain ES modules that Chrome loads directly.
- **YAGNI.** Only features in use. No options page, no background worker, no network code.
- **One source of truth.** The store owns the data. Views never change it directly; they call store actions.
- **Least privilege.** Only `activeTab`, `storage` and `scripting`. No host permissions.

Every module and function has a `/** */` comment explaining what it does, its inputs and outputs, and why.

## Tests

```
npm test
```

Runs every `tests/*.test.js` with Node's built-in test runner (Node 20+). There's nothing to install.

| File | Covers |
|---|---|
| `url-params.test.js` | Parsing, decoding, exact round-trips (base64 `==`, `+`, flags), edits, re-encoding |
| `unchecked-memory.test.js` | Unticked params come back in the same place, with the same encoding |
| `text-and-tracking.test.js` | "Edit as text" both ways; which keys count as tracking |
| `store.test.js` | Every popup action: edit, untick, remove + undo, clean tracking, add, UTM, sort, search, text mode |

### Manual test checklist

Run through this in Chrome before each release. Use a URL like
`https://example.com/?a=1&utm_source=x&b=hello+world&flag#top`

- [ ] The popup lists `a`, `utm_source`, `b`, `flag`, with `hello world` decoded
- [ ] Editing a value highlights it and enables **Update URL**. Enter updates the address bar
- [ ] Untick `a` → Update → reopen: `a` is still first, unticked. Tick → Update: the original order is back
- [ ] ✕ removes a row. **Undo** in the toast puts it back in place
- [ ] Copy icon on a row copies its value and shows a tick
- [ ] Typing in **Add param** creates a row without losing keystrokes
- [ ] The tracking notice names `utm_source`. **Remove** drops it, and Undo restores it
- [ ] ⋯ → each menu item works; the menu is never cut off
- [ ] ⋯ → **Undo last update** goes back to the previous URL
- [ ] ⋯ → **Don't reload the page**: Update changes the address bar without reloading
- [ ] A URL with 8+ params shows the search box
- [ ] On `chrome://extensions` the popup says to open a normal web page
- [ ] Light and dark mode both look right

## Publishing

See [docs/PUBLISHING.md](docs/PUBLISHING.md). The listing copy is in [store/LISTING.md](store/LISTING.md).
