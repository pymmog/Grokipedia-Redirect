# Grokipedia Redirect

A Chrome extension that opens Wikipedia articles in [Grokipedia](https://grokipedia.com) instead.

## What it does

When you open a Wikipedia article (by clicking a link on Wikipedia, typing a Wikipedia URL, or following a bookmark), the extension sends you to the matching Grokipedia page.

- **Article exists on Grokipedia** → you see the Grokipedia article
- **Article missing on Grokipedia** → you are sent back to the original Wikipedia page

The extension only runs on Wikipedia and Grokipedia pages — not on every website.

## Install

1. Download or clone this folder to your computer
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select this project folder

The extension icon should appear in your Chrome toolbar.

## Use

1. Open any Wikipedia article as you normally would
2. The extension handles the redirect automatically

### Open Wikipedia instead

Hold **Cmd** (Mac) or **Ctrl** (Windows/Linux), or hold **Shift**, while clicking a Wikipedia article link to skip the redirect and open Wikipedia directly.

### Turn it off temporarily

1. Click the extension icon in the toolbar
2. Uncheck **Redirect enabled**

Turn it back on anytime from the same popup.

## How it works (short version)

1. You open a Wikipedia article
2. The extension opens the Grokipedia version of that article
3. If Grokipedia does not have the article, it sends you back to Wikipedia once (without looping)

No account is required. The extension only injects scripts on Wikipedia and Grokipedia.

## Updating

If you pull a newer version of this project:

1. Go to `chrome://extensions`
2. Find **Grokipedia Redirect**
3. Click the refresh icon on the extension card

## For developers

Run URL mapping tests:

```bash
node scripts/test-url-utils.mjs
```

Regenerate toolbar icons after changing the source image:

```bash
node scripts/generate-icons.mjs
```

Source image: `icons/grokipedia-redirect.png`. The script prefers `sips` (macOS) or ImageMagick (`magick`/`convert`).
