# X Show More Hotkey

Chrome extension that augments x.com keyboard shortcuts with `h` for the visible tweet `Show more` control.

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

On `x.com`, press `h` to click the nearest visible tweet `Show more` link. The shortcut is ignored while typing in inputs, textareas, text boxes, and the post composer.

If no visible `Show more` control is found, the key press is left alone so x.com can handle its own shortcuts.
