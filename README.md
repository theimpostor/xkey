# X Keyboard Extras

Chrome extension that augments x.com keyboard shortcuts.

## Build

```sh
bun install
bun run build
```

## Pack Release Artifacts

```sh
bun run pack:crx
bun run pack:zip
```

These are equivalent to `bun run build.ts --crx` and
`bun run build.ts --crx --zip-crx`.

These rebuild `dist` and write `releases/x-show-more-hotkey-0.1.1.crx` or
`releases/x-show-more-hotkey-0.1.1.zip`.
On the first run, Chrome generates a private key and the script saves it as
`.crx-key.pem`. Keep that file if you want future CRX builds to keep the same
extension ID.

Use `CRX_KEY=/path/to/key.pem bun run pack:crx` to pack with an existing key,
or `CHROME_BIN=/path/to/chrome bun run pack:crx` if Chrome is not installed in a
standard macOS location.

## Install

### GitHub Release

1. Open the latest release on GitHub.
2. Download `x-show-more-hotkey-0.1.1.zip` from the release assets.
3. Rename the downloaded file to `x-show-more-hotkey-0.1.1.crx`. Do not unzip it.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Drag the renamed `.crx` file onto the extensions page and approve the install.

### Local Development

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist` folder.

## Use

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
