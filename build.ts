import { mkdir, rm } from "node:fs/promises";

const rootUrl = new URL("./", import.meta.url);
const distUrl = new URL("dist/", rootUrl);
const contentEntry = new URL("src/content.ts", rootUrl).pathname;

await rm(distUrl, { recursive: true, force: true });
await mkdir(distUrl, { recursive: true });

const result = await Bun.build({
  entrypoints: [contentEntry],
  outdir: distUrl.pathname,
  target: "browser",
  format: "iife",
  sourcemap: "none"
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }

  process.exit(1);
}

const manifest = await Bun.file(new URL("src/manifest.json", rootUrl)).json();
await Bun.write(
  new URL("manifest.json", distUrl),
  `${JSON.stringify(manifest, null, 2)}\n`
);
