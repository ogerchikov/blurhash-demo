import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function canRun(executable) {
  const result = spawnSync(executable, ["--version"], {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

export async function resolveImageEncoders() {
  const environment = {
    avifenc: process.env.AVIFENC_PATH,
    cjxl: process.env.CJXL_PATH,
  };
  let local = {};
  try {
    const manifest = JSON.parse(
      await fs.readFile(path.join(rootDir, ".image-tools", "manifest.json"), "utf8"),
    );
    local = Object.fromEntries(
      Object.entries(manifest.tools).map(([name, tool]) => [
        name,
        path.resolve(rootDir, tool.executable),
      ]),
    );
  } catch {
    // Project-local tools are optional when system tools are available.
  }

  return Object.fromEntries(
    ["avifenc", "cjxl"].map((name) => {
      const candidates = [environment[name], local[name], name].filter(Boolean);
      return [name, candidates.find(canRun) || null];
    }),
  );
}

export function runImageEncoder(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || result.error?.message || "Encoder failed").trim(),
    );
  }
  return result;
}
