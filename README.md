# X Keyboard Extras

Browser extension for enhanced keyboard navigation on x.com (formerly Twitter). Adds keyboard shortcuts for expanding longer tweets hidden by `Show more`, opening sub-tweets, Grok, and screenshots. Runs in Chrome and can be installed locally in Safari on macOS using PortKit.

## Usage

On `x.com`, use the built-in `j`/`k` keyboard navigation to select a tweet, then use:

- `h`: expand the text behind the `Show more` link.
- `Shift+G`: `Explain this post` with Grok.
- `Shift+O`: Open the sub-tweet.
- `Shift+S`: Take a screenshot of the selected tweet and copy it to the clipboard. A brief toast confirms the copy or reports a failure.

These shortcuts are also documented in the built-in `?` keyboard shortcuts menu on `x.com`.

Promoted posts, including boosted posts, are also hidden behind a 'Show promoted post' button.
The `j`/`k` shortcuts skip collapsed promoted posts; expanded posts remain selectable.

## Install

### Chrome: GitHub Release

1. Open the latest release on GitHub.
2. Download `xkey-<version>.zip` from the release assets.
3. Unzip it somewhere permanent.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked**.
7. Select the unzipped extension folder.

### Chrome: Local Development

1. [Build the extension](#build).
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the generated `dist` folder.

### Safari

Install a signed local copy using PortKit, Xcode, and a free Apple account. See the [Safari installation guide](docs/safari.md) for setup, updates, and troubleshooting.

## Build

```sh
bun install
bun run build
```

## Pack Release Artifacts

```sh
bun run pack:zip
```

This rebuilds `dist` and writes `releases/xkey-<version>.zip`.
