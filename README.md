# X Keyboard Extras

Chrome extension that augments x.com keyboard shortcuts.

## Build

```sh
bun install
bun run build
```

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist` folder.

## Use

On `x.com`, use the built-in `j`/`k` keyboard navigation to select a tweet, then use:

- `h` to click that selected tweet's `Show more` link.
- `Shift+O` to open a referenced tweet inside the selected tweet.
- `Shift+S` to copy a screenshot of the visible part of the selected tweet to the clipboard.

The shortcuts are ignored while typing in inputs, textareas, text boxes, and the post composer. If no keyboard-selected tweet or matching target is found, the key press is left alone so x.com can handle its own shortcuts.

`Shift+S` uses Chrome's tab screenshot API, which requires broad host permission even though the content script only runs on `x.com` and `twitter.com`.
