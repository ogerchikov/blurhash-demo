import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const resultsDir = path.join(rootDir, "benchmark-results");
const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, "").split("=");
    return [key, value.join("=") || "true"];
  }),
);

const repeats = Math.max(1, Number.parseInt(args.get("repeats") || "5", 10));
const visual = args.get("visual") === "true";
const externalBaseUrl = process.env.BENCHMARK_BASE_URL;
const port = Number.parseInt(process.env.PORT || "8090", 10);
const baseUrl = externalBaseUrl || `http://127.0.0.1:${port}`;
let server;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/benchmark-assets/manifest.json`);
      if (response.ok) {
        return;
      }
    } catch {
      // The child server may still be starting.
    }
    await delay(100);
  }
  throw new Error(`Benchmark server did not become ready at ${baseUrl}.`);
}

function metricMap(metrics) {
  return Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
}

function metricDelta(before, after, name) {
  const value = (after[name] ?? 0) - (before[name] ?? 0);
  return Math.round(value * 100000) / 100;
}

function caseUrl(strategy, manifest, iteration) {
  const image = args.get("image") || manifest.images[0].id;
  const record = manifest.images.find((entry) => entry.id === image);
  if (!record) {
    throw new Error(`Unknown image "${image}".`);
  }
  const selectedAsset = (assets, argument, label) => {
    const requested = args.get(argument);
    if (!requested) {
      return Object.entries(assets).find(([, asset]) => asset.available)?.[0];
    }
    const asset = assets[requested];
    if (!asset) {
      throw new Error(`Unknown ${label} format "${requested}".`);
    }
    if (!asset.available) {
      throw new Error(
        `${asset.label} is unavailable: ${asset.reason || "asset generation failed"}`,
      );
    }
    return requested;
  };
  const values = {
    autorun: strategy,
    image,
    preview: selectedAsset(record.previews, "preview", "preview"),
    final: selectedAsset(record.finals, "final", "final"),
    progressive: selectedAsset(
      record.progressive,
      "progressive",
      "progressive",
    ),
    rateKbps: args.get("rateKbps") || "1500",
    latencyMs: args.get("latencyMs") || "100",
    delivery: args.get("delivery") || "auto",
    iteration,
  };
  values.visualHold = "1";
  const url = new URL("/benchmark.html", baseUrl);
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.href;
}

async function runCase(browser, strategy, manifest, iteration) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const emulateDirectNetwork =
    args.get("delivery") === "direct"
    && args.get("emulateNetwork") !== "false";
  if (emulateDirectNetwork) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: Number(args.get("latencyMs") || "100"),
      downloadThroughput:
        (Number(args.get("rateKbps") || "1500") * 1000) / 8,
      uploadThroughput: (750 * 1000) / 8,
      connectionType: "cellular3g",
    });
  }
  const url = caseUrl(strategy, manifest, iteration);
  const filmstripDir = path.join(resultsDir, "filmstrips", `${strategy}-${iteration}`);
  let screenshotLoop;
  let stopScreenshots = false;
  const frames = [];

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__benchmarkReady);
    const before = metricMap((await cdp.send("Performance.getMetrics")).metrics);
    if (visual) {
      await fs.mkdir(filmstripDir, { recursive: true });
      const target = page.locator("#imageFrame");
      const captureFrame = async () => {
        const frame = frames.length;
        const before = await page.evaluate(() => performance.now());
        const file = path.join(
          filmstripDir,
          `${String(frame).padStart(4, "0")}.png`,
        );
        await target.screenshot({ path: file });
        const after = await page.evaluate(() => performance.now());
        const time = (before + after) / 2;
        frames.push({ file, time });
      };
      await captureFrame();
      await page.evaluate(() => {
        void window.__startBenchmark();
      });
      screenshotLoop = (async () => {
        while (!stopScreenshots) {
          await captureFrame().catch(() => {});
          await delay(100);
        }
      })();
    } else {
      await page.evaluate(() => {
        void window.__startBenchmark();
      });
    }
    await page.waitForFunction(
      () => window.__benchmarkResult || window.__benchmarkError,
      null,
      { timeout: 180000 },
    );
    const outcome = await page.evaluate(() => ({
      result: window.__benchmarkResult,
      error: window.__benchmarkError,
    }));
    if (outcome.error) {
      throw new Error(outcome.error);
    }
    if (visual) {
      stopScreenshots = true;
      await screenshotLoop;
      screenshotLoop = null;
      const target = page.locator("#imageFrame");
      const time = await page.evaluate(() => performance.now());
      const file = path.join(
        filmstripDir,
        `${String(frames.length).padStart(4, "0")}.png`,
      );
      await target.screenshot({ path: file });
      frames.push({ file, time });
      outcome.result.visualAnalysis = await analyzeFrames(
        frames,
        outcome.result.measurementClockStartedAt,
      );
      if (strategy === "progressive") {
        const firstVisible = outcome.result.visualAnalysis.firstVisibleMs;
        outcome.result.incrementalPaintClassification =
          firstVisible != null
          && firstVisible < outcome.result.timings.finalLoaded - 20
            ? "incremental"
            : "final-only-or-not-observed";
      }
    }
    const after = metricMap((await cdp.send("Performance.getMetrics")).metrics);
    return {
      ...outcome.result,
      automationNetworkEmulation: emulateDirectNetwork
        ? {
            rateKbps: Number(args.get("rateKbps") || "1500"),
            latencyMs: Number(args.get("latencyMs") || "100"),
          }
        : null,
      rendererCpu: {
        taskDurationMs: metricDelta(before, after, "TaskDuration"),
        scriptDurationMs: metricDelta(before, after, "ScriptDuration"),
        layoutDurationMs: metricDelta(before, after, "LayoutDuration"),
        recalcStyleDurationMs: metricDelta(before, after, "RecalcStyleDuration"),
      },
      pass: visual ? "visual-instrumented" : "clean",
    };
  } finally {
    stopScreenshots = true;
    await screenshotLoop;
    await context.close();
  }

  async function rawPixels(file) {
    const { data, info } = await sharp(file)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, channels: info.channels };
  }

  function similarity(left, right) {
    if (
      left.width !== right.width
      || left.height !== right.height
      || left.channels !== right.channels
    ) {
      throw new Error("Visual frames have inconsistent dimensions.");
    }
    let difference = 0;
    for (let index = 0; index < left.data.length; index += 1) {
      difference += Math.abs(left.data[index] - right.data[index]);
    }
    return 1 - difference / (left.data.length * 255);
  }

  async function analyzeFrames(frames, startedAt) {
    const decoded = [];
    for (const frame of frames) {
      decoded.push({
        time: Math.round((frame.time - startedAt) * 100) / 100,
        pixels: await rawPixels(frame.file),
        file: path.relative(rootDir, frame.file),
      });
    }
    const baseline = decoded[0].pixels;
    const final = decoded.at(-1).pixels;
    const samples = decoded.map((frame) => ({
      time: frame.time,
      file: frame.file,
      changeFromBaseline: Math.round(
        (1 - similarity(frame.pixels, baseline)) * 100000,
      ) / 100000,
      similarityToFinal: Math.round(
        similarity(frame.pixels, final) * 100000,
      ) / 100000,
    }));
    const afterStart = samples.filter((sample) => sample.time >= 0);
    return {
      method: "10 fps element screenshots; performance-perturbing",
      thresholds: {
        firstVisibleBaselineDifference: 0.005,
        usefulSimilarityToFinal: 0.9,
        finalSimilarityToFinal: 0.999,
      },
      firstVisibleMs: afterStart.find(
        (sample) => sample.changeFromBaseline >= 0.005,
      )?.time ?? null,
      usefulVisualMs: afterStart.find(
        (sample) => sample.similarityToFinal >= 0.9,
      )?.time ?? null,
      finalVisualMs: afterStart.find(
        (sample) => sample.similarityToFinal >= 0.999,
      )?.time ?? null,
      samples,
    };
  }
}

async function main() {
  await fs.mkdir(resultsDir, { recursive: true });
  if (!externalBaseUrl) {
    server = spawn(
      process.execPath,
      [path.join(rootDir, "scripts", "benchmark-server.mjs")],
      {
        cwd: rootDir,
        env: { ...process.env, PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  }
  await waitForServer();
  const manifest = await fetch(`${baseUrl}/benchmark-assets/manifest.json`).then(
    (response) => response.json(),
  );
  const browser = await chromium.launch({ headless: true });
  const runs = [];
  try {
    for (let iteration = 1; iteration <= repeats; iteration += 1) {
      for (const strategy of ["preview", "progressive"]) {
        console.log(`Running ${strategy} ${iteration}/${repeats}`);
        runs.push(await runCase(browser, strategy, manifest, iteration));
      }
    }
  } finally {
    await browser.close();
  }

  const output = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    repeats,
    visual,
    warning: visual
      ? "Screenshot sampling perturbs performance; do not use this pass for CPU comparisons."
      : null,
    runs,
  };
  const outputPath = path.join(
    resultsDir,
    visual ? "visual-results.json" : "clean-results.json",
  );
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (server && !server.killed) {
      server.kill();
    }
  });
