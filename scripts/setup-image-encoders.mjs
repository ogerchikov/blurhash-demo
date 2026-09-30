import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const toolsDir = path.join(rootDir, ".image-tools");

const releases = {
  avifenc: {
    version: "1.4.2",
    archive: "libavif-1.4.2-windows-x64.zip",
    url: "https://github.com/AOMediaCodec/libavif/releases/download/v1.4.2/windows-artifacts.zip",
    sha256: "cb2d9fea43dcbab1d0707e3b37eb7b08070ad2fb60a2c188c39ec12382c0484a",
    executable: "avifenc.exe",
  },
  cjxl: {
    version: "0.12.0",
    archive: "libjxl-0.12.0-windows-x64.zip",
    url: "https://github.com/libjxl/libjxl/releases/download/v0.12.0/jxl-x64-windows.zip",
    sha256: "4ee3f72134a2a49774c357f2bffecf30d752d702147896c493578789de15a97c",
    executable: "cjxl.exe",
  },
};

if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error(
    "The pinned bootstrap currently supports Windows x64. On other platforms, install "
    + "avifenc and cjxl on PATH before running the progressive asset generator.",
  );
}

async function sha256(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function download(release, archivePath) {
  const response = await fetch(release.url);
  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${response.status}: ${release.url}`);
  }
  await fs.writeFile(archivePath, Buffer.from(await response.arrayBuffer()));
}

async function findFile(directory, name) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFile(entryPath, name);
      if (nested) {
        return nested;
      }
    } else if (entry.name.toLowerCase() === name.toLowerCase()) {
      return entryPath;
    }
  }
  return null;
}

async function install(name, release) {
  const installDir = path.join(toolsDir, name);
  const archivePath = path.join(toolsDir, release.archive);
  await fs.mkdir(toolsDir, { recursive: true });

  let digest = "";
  try {
    digest = await sha256(archivePath);
  } catch {
    // The pinned archive has not been downloaded yet.
  }
  if (digest !== release.sha256) {
    await fs.rm(archivePath, { force: true });
    console.log(`Downloading ${name} ${release.version}...`);
    await download(release, archivePath);
    digest = await sha256(archivePath);
  }
  if (digest !== release.sha256) {
    await fs.rm(archivePath, { force: true });
    throw new Error(
      `${name} archive SHA-256 mismatch: expected ${release.sha256}, received ${digest}.`,
    );
  }

  await fs.rm(installDir, { recursive: true, force: true });
  await fs.mkdir(installDir, { recursive: true });
  const extraction = spawnSync(
    "pwsh",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Expand-Archive -LiteralPath $env:ENCODER_ARCHIVE "
        + "-DestinationPath $env:ENCODER_INSTALL_DIR -Force",
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        ENCODER_ARCHIVE: archivePath,
        ENCODER_INSTALL_DIR: installDir,
      },
    },
  );
  if (extraction.status !== 0) {
    throw new Error(
      `Could not extract ${release.archive}: ${
        extraction.stderr || extraction.stdout || "tar failed"
      }`,
    );
  }

  const executable = await findFile(installDir, release.executable);
  if (!executable) {
    throw new Error(`${release.executable} was not found in ${release.archive}.`);
  }
  return {
    version: release.version,
    executable: path.relative(rootDir, executable),
    archiveSha256: release.sha256,
    source: release.url,
  };
}

const installed = {};
for (const [name, release] of Object.entries(releases)) {
  installed[name] = await install(name, release);
  console.log(`Installed ${name} ${release.version}`);
}

await fs.writeFile(
  path.join(toolsDir, "manifest.json"),
  `${JSON.stringify({ installedAt: new Date().toISOString(), tools: installed }, null, 2)}\n`,
);
console.log("Project-local image encoders are ready.");
