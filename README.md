# Grokipedia Redirect

A Chrome extension that opens Wikipedia article links in [Grokipedia](https://grokipedia.com) instead.

## What it does

When you click a Wikipedia article link anywhere in Chrome, the extension sends you to the matching Grokipedia page.

- **Article exists on Grokipedia** → you see the Grokipedia article
- **Article missing on Grokipedia** → you are sent back to the original Wikipedia page you clicked

## Install

1. Download or clone this folder to your computer
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select this project folder (`groki`)

The extension icon should appear in your Chrome toolbar.

## Use

1. Click any Wikipedia article link as you normally would
2. The extension handles the redirect automatically

### Open Wikipedia instead

Hold **Cmd** (Mac) or **Ctrl** (Windows/Linux), or hold **Shift**, while clicking to skip the redirect and open Wikipedia directly.

### Turn it off temporarily

1. Click the extension icon in the toolbar
2. Uncheck **Redirect enabled**

Turn it back on anytime from the same popup.

## How it works (short version)

1. You click a Wikipedia link
2. The extension opens the Grokipedia version of that article
3. If Grokipedia does not have the article, it sends you back to the Wikipedia link you clicked

No account is required. The extension only runs when you click Wikipedia article links.

## Updating

If you pull a newer version of this project:

1. Go to `chrome://extensions`
2. Find **Grokipedia Redirect**
3. Click the refresh icon on the extension card

## Safari (macOS)

The shared extension logic lives in the repository root (Chrome load-unpacked). The `safari/` folder contains an Xcode project equivalent to running:

```bash
xcrun safari-web-extension-converter . --macos-only --app-name "Grokipedia Redirect" --bundle-identifier com.pymmog.grokipedia-redirect --project-location safari
```

### Build and run

1. From the repo root, copy the latest shared files into the Safari extension bundle:

   ```bash
   ./scripts/sync-safari.sh
   ```

2. Open `safari/Grokipedia Redirect/Grokipedia Redirect.xcodeproj` in Xcode.
3. Select the **Grokipedia Redirect** scheme and your **Personal Team** under Signing & Capabilities for both the app and the extension targets.
4. Build and run (⌘R). macOS installs the containing app; enable the extension in Safari.

### Enable the extension in Safari

1. In Safari, open **Settings → Advanced** and turn on **Show features for web developers**.
2. Open **Develop → Allow Unsigned Extensions** (required for local/debug builds).
3. Open **Safari → Settings → Extensions**, enable **Grokipedia Redirect**, and allow it on the sites you use.

Re-run `./scripts/sync-safari.sh` after changing root extension files, then rebuild in Xcode.

## For developers

Regenerate toolbar icons after changing the source image:

```bash
node scripts/generate-icons.mjs
```

Source image: `icons/grokipedia-redirect.png`

Run URL mapping tests:

```bash
node scripts/test-url-utils.mjs
```