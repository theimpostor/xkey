import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PackageJson = {
  name?: string;
  version?: string;
};

const rootUrl = new URL("./", import.meta.url);
const distUrl = new URL("dist/", rootUrl);
const distPath = fileURLToPath(distUrl);
const releasePath = fileURLToPath(new URL("releases/", rootUrl));
const contentEntry = new URL("src/content.ts", rootUrl).pathname;
const backgroundEntry = new URL("src/background.ts", rootUrl).pathname;
const args = process.argv.slice(2);
const shouldPackZip = args.includes("--zip");
const unknownArgs = args.filter((arg) => arg !== "--zip");

async function run(
  command: string,
  commandArgs: string[],
  options: { cwd?: string } = {},
): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd,
      stdio: "inherit",
    });

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

async function getReleaseArtifactPath(): Promise<string> {
  const packageJson = (await Bun.file(
    new URL("package.json", rootUrl),
  ).json()) as PackageJson;
  const name = packageJson.name ?? "extension";
  const version = packageJson.version ?? "0.0.0";
  return resolve(releasePath, `${name}-${version}.zip`);
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

async function packZip(): Promise<void> {
  const artifactPath = await getReleaseArtifactPath();

  await mkdir(releasePath, { recursive: true });
  await rm(artifactPath, { force: true });
  await run("zip", ["-X", "-r", artifactPath, "."], { cwd: distPath });

  console.log(`Packed ZIP: ${artifactPath}`);
}

try {
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown build argument: ${unknownArgs.join(", ")}`);
  }

  await build();

  if (shouldPackZip) {
    await packZip();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
