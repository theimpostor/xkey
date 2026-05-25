# X Keyboard Extras

Chrome extension that augments x.com keyboard shortcuts.

## Usage

On `x.com`, use the built-in `j`/`k` keyboard navigation to select a tweet, then use:

- `h` to click that selected tweet's `Show more` link.
- `Shift+G` to click that selected tweet's `Explain this post`/Grok button.
- `Shift+O` to open a referenced tweet inside the selected tweet.
- `Shift+S` to copy a screenshot of the visible part of the selected tweet to the clipboard.

The shortcuts are ignored while typing in inputs, textareas, text boxes, and the post composer. If no keyboard-selected tweet or matching target is found, the key press is left alone so x.com can handle its own shortcuts.

These shortcuts are also added to an `xkey` section in X's `?` keyboard shortcuts menu.

`Shift+S` uses Chrome's `tabs.captureVisibleTab()` API. Chrome requires either
`<all_urls>` or `activeTab` for this API; this extension uses `<all_urls>`
because `Shift+S` is handled as an in-page X keyboard shortcut rather than a
browser extension invocation.

## Install

### GitHub Release

1. Open the latest release on GitHub.
2. Download `xkey-0.1.2.zip` from the release assets.
3. Unzip it somewhere permanent.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked**.
7. Select the unzipped extension folder.

### Local Development

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist` folder.

## Build

```sh
bun install
bun run build
```

## Pack Release Artifacts

```sh
bun run pack:zip
```

This is equivalent to `bun run build.ts --zip`.

This rebuilds `dist` and writes `releases/xkey-0.1.2.zip`.
