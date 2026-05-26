# X Keyboard Extras

Chrome extension for enhanced keyboard navigation on x.com (formerly Twitter). Adds keyboard shortcuts for expanding longer tweets hidden by `Show more`, opening sub-tweets, Grok, and screenshots.

## Usage

On `x.com`, use the built-in `j`/`k` keyboard navigation to select a tweet, then use:

- `h`: expand the text behind the `Show more` link.
- `Shift+G`: `Explain this post` with Grok.
- `Shift+O`: Open the sub-tweet.
- `Shift+S`: Take a screenshot of the selected tweet and copy it to the clipboard.

These shortcuts are also documented in the built-in `?` keyboard shortcuts menu on `x.com`.

Promoted posts are also hidden behind a 'Show promoted post' button.

## Install

### GitHub Release

1. Open the latest release on GitHub.
2. Download `xkey-<version>.zip` from the release assets.
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

This rebuilds `dist` and writes `releases/xkey-<version>.zip`.
