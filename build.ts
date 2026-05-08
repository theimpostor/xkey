import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, rename, rm } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PackageJson = {
  name?: string;
  version?: string;
};

const rootUrl = new URL("./", import.meta.url);
const distUrl = new URL("dist/", rootUrl);
const rootPath = fileURLToPath(rootUrl);
const distPath = fileURLToPath(distUrl);
const releasePath = fileURLToPath(new URL("releases/", rootUrl));
const defaultKeyPath = fileURLToPath(new URL(".crx-key.pem", rootUrl));
const generatedCrxPath = fileURLToPath(new URL("dist.crx", rootUrl));
const generatedKeyPath = fileURLToPath(new URL("dist.pem", rootUrl));
const contentEntry = new URL("src/content.ts", rootUrl).pathname;
const backgroundEntry = new URL("src/background.ts", rootUrl).pathname;
const args = process.argv.slice(2);
const shouldPackCrx = args.includes("--crx");
const unknownArgs = args.filter((arg) => arg !== "--crx");

function rootRelative(path: string): string {
  return isAbsolute(path) ? path : resolve(rootPath, path);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function findChrome(): Promise<string> {
  const { CHROME_BIN: chromeBin } = process.env;
  const candidates = [
    chromeBin,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  ].filter((path): path is string => path !== undefined && path.length > 0);

  for (const candidate of candidates) {
    const chromePath = rootRelative(candidate);

    if (await exists(chromePath)) {
      return chromePath;
    }
  }

  throw new Error(
    "Could not find Chrome. Set CHROME_BIN to the Chrome executable path.",
  );
}

async function run(command: string, commandArgs: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit" });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(
        new Error(
          signal === null
            ? `${command} exited with status ${code}`
            : `${command} exited after signal ${signal}`,
        ),
      );
    });
  });
}

async function build(): Promise<void> {
  await rm(distUrl, { recursive: true, force: true });
  await mkdir(distUrl, { recursive: true });

  const result = await Bun.build({
    entrypoints: [contentEntry, backgroundEntry],
    outdir: distUrl.pathname,
    target: "browser",
    format: "iife",
    sourcemap: "none",
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
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function packCrx(): Promise<void> {
  const chromePath = await findChrome();
  const packageJson = (await Bun.file(
    new URL("package.json", rootUrl),
  ).json()) as PackageJson;
  const name = packageJson.name ?? "extension";
  const version = packageJson.version ?? "0.0.0";
  const artifactPath = resolve(releasePath, `${name}-${version}.crx`);
  const { CRX_KEY: crxKey } = process.env;

  const configuredKeyPath =
    crxKey === undefined ? defaultKeyPath : rootRelative(crxKey);
  const hasKey = await exists(configuredKeyPath);

  if (crxKey !== undefined && !hasKey) {
    throw new Error(`CRX_KEY does not exist: ${configuredKeyPath}`);
  }

  await rm(generatedCrxPath, { force: true });
  await rm(generatedKeyPath, { force: true });

  const packArgs = [`--pack-extension=${distPath}`];

  if (hasKey) {
    packArgs.push(`--pack-extension-key=${configuredKeyPath}`);
  }

  await run(chromePath, packArgs);

  if (!(await exists(generatedCrxPath))) {
    throw new Error(`Chrome did not create ${generatedCrxPath}`);
  }

  await mkdir(releasePath, { recursive: true });
  await rm(artifactPath, { force: true });
  await rename(generatedCrxPath, artifactPath);

  if (!hasKey && (await exists(generatedKeyPath))) {
    await rename(generatedKeyPath, defaultKeyPath);
    console.log(`Saved generated CRX key: ${defaultKeyPath}`);
  }

  console.log(`Packed CRX: ${artifactPath}`);
}

try {
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown build argument: ${unknownArgs.join(", ")}`);
  }

  await build();

  if (shouldPackCrx) {
    await packCrx();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
