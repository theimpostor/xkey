# Installing in Safari with PortKit

[PortKit](https://github.com/Vatsal057/chrome-to-safari) converts the extension into a macOS app and signs it with your Apple Development certificate. A free Apple account is sufficient for this local setup. The signed installation was verified to stay enabled after fully quitting and reopening Safari with **Allow unsigned extensions** turned off.

## One-time setup

1. Install the full **Xcode** app, open it, and finish its initial setup. Command Line Tools alone are insufficient.
2. In **Xcode → Settings → Accounts**, add your Apple account.
3. Select your account, open **Manage Certificates…**, and create an **Apple Development** certificate using the **+** button.
4. Check that Terminal can find Xcode and a valid signing identity:

   ```sh
   xcode-select -p
   security find-identity -v -p codesigning
   ```

   The first command should point inside your Xcode app, usually `/Applications/Xcode.app/Contents/Developer`. If it points to Command Line Tools, select Xcode:

   ```sh
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   ```

   The second command should list an `Apple Development` identity. See troubleshooting below if it reports `0 valid identities found`.

## Build and install

1. Download and unzip `xkey-<version>.zip` from a GitHub release, or [build from source](../README.md#build) to generate `dist`. Use the folder containing `manifest.json` as the input to PortKit.
2. Clone PortKit once:

   ```sh
   mkdir -p "$HOME/.local/share"
   git clone https://github.com/Vatsal057/chrome-to-safari.git "$HOME/.local/share/xkey-portkit"
   ```

3. Run the following from the xkey repository after building. For a release download, replace `"$PWD/dist"` with the absolute path to the unzipped extension folder.

   ```sh
   APP_NAME='X Keyboard Extras' \
   BUNDLE_ID='com.theimpostor.xkey' \
   OUT_DIR="$HOME/Library/Caches/xkey-safari-build" \
   "$HOME/.local/share/xkey-portkit/chrome-to-safari.sh" "$PWD/dist"
   ```

   This builds and signs the app, installs it at `/Applications/X Keyboard Extras.app`, registers it with macOS, and opens it. Re-running replaces the installed app. If the build reports a missing `project.pbxproj`, apply the Xcode compatibility fix below and retry.

4. In the app, click **Quit and Open Safari Extensions Preferences…**, then enable **X Keyboard Extras** in **Safari → Settings → Extensions**.
5. Open `https://x.com`, click the extension's toolbar button, and choose **Always Allow on This Website** when Safari requests access. Reload the page.
6. Press `?` on X and check for the **xkey** shortcut section. Fully quit Safari with `⌘Q`, reopen it, and confirm the extension remains enabled.

Keep the app in Applications; Xcode and the companion app do not need to remain open. To update, download or build the new extension files and repeat step 3, then reload X. If the signing certificate expires, create a new valid certificate and rebuild.

## Troubleshooting

**Certificate exists, but no valid signing identity is found:** Check that the certificate has its private key in Keychain Access and has not expired. The Apple Worldwide Developer Relations **G3** intermediate certificate may also be missing. Download it from [Apple's certificate authority page](https://www.apple.com/certificateauthority/), import it into your login keychain, and rerun `security find-identity -v -p codesigning`. Leave its trust settings at their defaults. Apple documents the certificate chain in its [WWDR guide](https://developer.apple.com/help/account/certificates/wwdr-intermediate-certificates/).

**Missing `project.pbxproj`:** During testing with Xcode 27, the converter generated `project.xcproj`, which PortKit's CLI did not recognize. The following workaround was verified against PortKit commit `1e2525796362c20a907dd29a37677d048b41103d`.

<details>
<summary>PortKit compatibility fix for the newer Xcode project format</summary>

Edit `~/.local/share/xkey-portkit/chrome-to-safari.sh`. Replace the bundle-identifier normalization block, starting at `PBX="$PROJECT/project.pbxproj"` and ending immediately before `# --- Build`, with:

```sh
PBX="$PROJECT/project.pbxproj"
if [ ! -f "$PBX" ] && [ -f "$PROJECT/project.xcproj" ]; then
  python3 - "$PROJECT/project.xcproj" "$BUNDLE_ID" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
bundle_id = sys.argv[2]
text = path.read_text()
pattern = r'("PRODUCT_BUNDLE_IDENTIFIER"\s*:\s*")([^"\n]+)(")'
if len(re.findall(pattern, text)) != 2:
    raise SystemExit("Expected exactly two bundle identifiers in generated project")
text = re.sub(
    pattern,
    lambda m: m[1] + bundle_id + (".Extension" if m[2].endswith(".Extension") else "") + m[3],
    text,
)
path.write_text(text)
PY
else
  APP_ID="$(grep -o 'PRODUCT_BUNDLE_IDENTIFIER = "\{0,1\}[^";]*' "$PBX" \
    | sed 's/.*= "\{0,1\}//' | grep -v '\.Extension$' | head -1)"
  sed -i '' "s/PRODUCT_BUNDLE_IDENTIFIER = \"\{0,1\}[^\";]*\.Extension\"\{0,1\};/PRODUCT_BUNDLE_IDENTIFIER = \"$APP_ID.Extension\";/g" "$PBX"
fi
```

Save the script and rerun the install command. This keeps the original handling for older Xcode projects and adds support for the format encountered during testing.

</details>

**Duplicate extensions, missing resources, or the extension disables itself after restart:** In **Safari → Settings → Extensions**, uninstall any earlier temporary xkey entry. If you used `--build-only` and manually copied the app, unregister the obsolete build copy before moving it to Trash. Replace the example path below with that build copy's actual path:

```sh
/System/Library/Frameworks/CoreServices.framework/Versions/Current/Frameworks/LaunchServices.framework/Versions/Current/Support/lsregister \
  -u '/absolute/path/to/obsolete/build/X Keyboard Extras.app'
```

Then refresh registration for the app in Applications:

```sh
/System/Library/Frameworks/CoreServices.framework/Versions/Current/Frameworks/LaunchServices.framework/Versions/Current/Support/lsregister \
  -f -R '/Applications/X Keyboard Extras.app'
```

Fully quit and reopen Safari, enable the installed extension, and repeat the restart check. PortKit's normal installation command performs this registration step automatically.

## Sharing a Safari build

These instructions are for building and signing locally on each person's Mac. The release ZIP contains WebExtension files, not a ready-to-install Safari app. To publish a Safari app that others can download without Xcode, use a paid Apple Developer Program membership, **Developer ID Application** signing, and notarization. The resulting app can be hosted on GitHub Releases; see [Apple's Safari extension distribution guide](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension).
