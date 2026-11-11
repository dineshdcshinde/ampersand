# Publishing Ampersand

A checklist from "it works on my machine" to "live on the Chrome Web Store". Budget about an hour of your time. Review then takes anywhere from a few hours to a few days, so submit as early as you can.

You'll need:

- A Google account you want to publish under. Use a long-term one, because the extension belongs to it.
- US $5 for the one-time Chrome Web Store developer fee (card payment).
- Node.js 20+ (for `npm test`) and Windows PowerShell (for `npm run package`).

---

## 1. Final check (10 min)

1. **Run the tests.** Open a terminal in the `ampersand` folder and run `npm test`. All tests should pass.
2. **Test by hand in Chrome.** Go to `chrome://extensions`, reload Ampersand, and run through the checklist in [README.md](../README.md#manual-test-checklist).
3. **Check the version** in `manifest.json` (`"version": "1.0.0"`). Each later upload needs a higher number (1.0.1, 1.1.0…).

## 2. Build the zip (1 min)

```
npm run package
```

This creates `dist/ampersand-1.0.0.zip` with only the extension files: no tests, docs or store images. Open the zip to check that `manifest.json` sits at the top level, not inside a folder.

> No PowerShell? Make a zip containing exactly `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `icons/` and `src/`, all at the top level.

## 3. Put the privacy policy online (10 min)

The store needs a public link to your privacy policy.

1. Open `docs/PRIVACY.md` and replace **[your email address]** at the bottom with a real contact email.
2. Publish it somewhere public. The easiest options:
   - **GitHub Gist:** go to gist.github.com, paste the file, name it `PRIVACY.md`, and create a **public** gist. Copy its URL.
   - **GitHub repo:** push this project to a public repo. The link to `docs/PRIVACY.md` works as is.
   - **Google Docs:** paste the text, then use **File → Share → Publish to web** and copy that link.
3. Open the link in a private window to make sure it loads without signing in.

## 4. Register as a Chrome Web Store developer (10 min, once)

1. Go to the **Chrome Web Store Developer Dashboard**: `chrome.google.com/webstore/devconsole`
2. Sign in with your chosen Google account, accept the developer agreement, and pay the **$5** fee.
3. Fill in the **Account** tab: publisher name (your name or brand, shown on the listing), contact email, and verify that email.
4. Google may ask you to verify your identity or address. Do this now, because publishing is blocked until it's done.

## 5. Create the item (20 min)

In the dashboard, click **+ New item** and upload `dist/ampersand-1.0.0.zip`.

Then fill in each tab. **Copy and paste everything from [store/LISTING.md](../store/LISTING.md)**:

| Dashboard tab | What to do |
|---|---|
| **Store listing** | Description, category (Developer Tools), language, icon, 3 screenshots, small promo tile |
| **Privacy practices** | Single purpose, the 3 permission justifications, "No remote code", tick **Web history**, tick the 3 certifications, paste your privacy policy URL |
| **Distribution** | Free, Public, all regions |

The most common reason for rejection is a mismatch between the privacy tab and what the code does. The answers in LISTING.md match the code exactly, so paste them as written.

## 6. Submit

Click **Submit for review**. You'll get an email when it's approved or if something needs fixing. While it's in review, the item shows **Pending review**.

If it's rejected, the email names the policy. Fix it, bump the version in `manifest.json`, run `npm run package` again, upload the new zip, and resubmit.

## 7. After it's live

- Your store link looks like `chromewebstore.google.com/detail/ampersand/<id>`. Share it.
- **Updating:** change the code, bump `version` in `manifest.json`, run `npm test` and `npm run package`, then go to the dashboard → your item → **Package → Upload new package** → **Submit for review**. Users get updates automatically.

---

## Microsoft Edge (optional, free)

Edge runs the same zip unchanged.

1. Go to **Microsoft Partner Center → Edge program** (`partner.microsoft.com/dashboard/microsoftedge`) and register. There's no fee.
2. **Create new extension**, upload the same zip.
3. Reuse the description, screenshots and privacy policy URL from LISTING.md. Edge also asks for a 300×300 logo; scale up `icons/icon128.png` or ask for one to be made.
4. Submit. Edge review typically takes up to a week.

## Firefox and Safari (later)

- **Firefox** supports Manifest V3 but needs a few manifest changes (`browser_specific_settings` with an add-on id). Submit at addons.mozilla.org, which is free.
- **Safari** needs a Mac with Xcode to wrap the extension in an app, plus an Apple Developer account ($99/year).

These are good next steps once Chrome is live.
