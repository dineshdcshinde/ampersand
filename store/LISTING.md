# Chrome Web Store listing: copy and paste

Everything you type into the Developer Dashboard, in the order the dashboard asks for it.

---

## Package

Upload: `dist/ampersand-1.0.0.zip` (made with `npm run package`, see docs/PUBLISHING.md).

The **name**, **summary** and **icon** are read from `manifest.json`:

- Name: `Ampersand – See & Edit URL Params`
- Summary (max 132 characters): `See every URL param as a simple list. Edit, untick, remove or add one, then update the address bar.`

---

## Store listing tab

**Description**

```
See every param in the current URL as a simple list. Click any value, change it, press Enter, and your address bar updates.

What you can do:
• See all params decoded and readable (no more %20 confusion)
• Edit a value, press Enter to update
• Untick params to hide them temporarily—they stay in place when you tick them back
• Delete params with Undo if you change your mind
• Copy any param value with one click
• Auto-spot tracking params (utm_, gclid, etc.) and nuke them
• Undo your last change

More options in the menu:
• Open the edited URL in a new tab (Ctrl+Enter)
• Copy just the URL without tracking stuff, or export as JSON
• Edit all params as plain text
• Add UTM params for campaign links
• Sort A to Z
• Don't reload the page (for single-page apps)

Your params stay exactly encoded the way they were. Updating never breaks anything.

Built for developers, QA, and anyone who deals with campaign links, filters, or debug flags daily.

Privacy: It only reads the tab you click it on. Everything stays in your browser—zero network requests.

Keyboard shortcut: Alt+Shift+U
```

**Category:** Developer Tools

**Language:** English

**Graphic assets** (all in this `store/` folder):

| Field | File |
|---|---|
| Store icon (128×128) | `../icons/icon128.png` |
| Screenshot 1 (1280×800) | `01-edit-params-light-1280x800.png` |
| Screenshot 2 | `02-untick-param-to-test-light-1280x800.png` |
| Screenshot 3 | `03-more-actions-menu-dark-1280x800.png` |
| Small promo tile (440×280) | `promo-tile-small-440x280.png` |

**Official URL:** leave blank (or your site, once you have one).
**Homepage URL:** your GitHub repo, if public. Otherwise leave blank.
**Support URL:** your GitHub repo's Issues page, or leave blank.

---

## Privacy practices tab

**Single purpose description**

```
Ampersand shows the query parameters of the current tab's URL as an editable list and updates the tab's address with the user's changes.
```

**Permission justification**

`activeTab`
```
Needed to read the URL of the tab the user opens Ampersand on (to show its query parameters) and to update that tab's URL when the user clicks "Update URL". Only applies to the active tab, and only after the user clicks the extension icon or presses its shortcut.
```

`storage`
```
Stores, on the user's device only: one user setting ("Don't reload the page"), and for the current browser session, the tab's previous URLs (for "Undo last update") and any parameters the user unticked (so they stay in the list in the same position). Nothing is transmitted.
```

`scripting`
```
Used only when the user turns on the optional "Don't reload the page" setting: injects a single history.pushState call into the active tab so its address changes without reloading the page (useful for single-page apps). Only runs on the tab the user opened Ampersand on, only when they click "Update URL".
```

**Remote code**

Select: **No, I am not using remote code.**

**Data usage**

Which user data do you plan to collect? Tick only:

- [x] **Web history** (the extension reads the current tab's URL and keeps previous URLs locally for Undo)

Leave everything else unticked.

Certify all three:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** the public link to `docs/PRIVACY.md` (see docs/PUBLISHING.md, step 3).

---

## Distribution tab

- Payments: **Free of charge**
- Visibility: **Public**
- Regions: **All regions**
