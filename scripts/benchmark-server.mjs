import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const benchmarkAssetsDir = path.join(rootDir, "benchmark-assets");
const progressiveImagesDir = path.join(rootDir, "progressive-images");
const port = Number.parseInt(process.env.PORT || "8080", 10);
const host = process.env.HOST || "127.0.0.1";
const runSchedulers = new Map();

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jxl": "image/jxl",
  ".png": "image/png",
  ".webp": "image/webp",
};

function resolveInsideRoot(urlPath) {
  const relative = decodeURIComponent(urlPath).replace(/^[/\\]+/, "");
  const resolved = path.resolve(rootDir, relative);
  if (resolved !== rootDir && !resolved.startsWith(`${rootDir}${path.sep}`)) {
    return null;
  }
  return resolved;
}

function setCommonHeaders(response, filePath) {
  response.setHeader(
    "Content-Type",
    mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
  );
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Timing-Allow-Origin", "*");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));
}

function acquireScheduler(runId, rateKbps) {
  if (!runId) {
    return {
      async transmit(bytes) {
        await delay((bytes * 8) / rateKbps);
      },
      release() {},
    };
  }

  let scheduler = runSchedulers.get(runId);
  if (!scheduler) {
    scheduler = {
      rateKbps,
      nextDeadline: performance.now(),
      references: 0,
      async transmit(bytes) {
        const now = performance.now();
        if (now - this.nextDeadline > 250) {
          this.nextDeadline = now;
        }
        this.nextDeadline += (bytes * 8) / this.rateKbps;
        const wait = this.nextDeadline - now;
        if (wait > 0.5) {
          await delay(wait);
        }
      },
      release() {
        this.references -= 1;
        if (this.references === 0) {
          runSchedulers.delete(runId);
        }
      },
    };
    runSchedulers.set(runId, scheduler);
  } else if (scheduler.rateKbps !== rateKbps) {
    throw new Error("A benchmark run cannot use multiple transfer rates.");
  }
  scheduler.references += 1;
  return scheduler;
}

function isPublicStaticFile(filePath) {
  const relative = path.relative(rootDir, filePath);
  const segments = relative.split(path.sep);
  if (
    relative.startsWith("..")
    || segments.some((segment) => segment.startsWith("."))
    || ["node_modules", "scripts", "benchmark-results"].includes(segments[0])
  ) {
    return false;
  }

  const extension = path.extname(filePath).toLowerCase();
  if (segments.length === 1) {
    return [".html", ".css", ".js"].includes(extension)
      || relative === "photos.json";
  }
  if (["images", "progressive-images"].includes(segments[0])) {
    return [".avif", ".jpg", ".jpeg", ".jxl", ".png", ".webp"].includes(extension);
  }
  if (segments[0] === "benchmark-assets") {
    return [".avif", ".jpg", ".jpeg", ".json", ".jxl", ".png", ".webp"]
      .includes(extension);
  }
  return false;
}

async function streamAtRate(request, response, url) {
  const requestedPath = url.searchParams.get("path") || "";
  const normalizedRequestedPath = requestedPath.replaceAll("\\", "/");
  if (
    !normalizedRequestedPath.startsWith("benchmark-assets/")
    && !normalizedRequestedPath.startsWith("progressive-images/")
  ) {
    response.writeHead(400).end("Only benchmark assets can be streamed.");
    return;
  }
  const filePath = resolveInsideRoot(requestedPath);
  const insideAllowedRoot = [benchmarkAssetsDir, progressiveImagesDir].some(
    (directory) => filePath === directory
      || filePath?.startsWith(`${directory}${path.sep}`),
  );
  if (
    !filePath
    || !insideAllowedRoot
  ) {
    response.writeHead(400).end("Invalid asset path.");
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    response.writeHead(404).end("Benchmark asset not found.");
    return;
  }
  if (!stat.isFile()) {
    response.writeHead(404).end("Benchmark asset not found.");
    return;
  }

  const rateKbps = Math.max(
    1,
    Number.parseFloat(url.searchParams.get("rateKbps") || "1500"),
  );
  const latencyMs = Math.max(
    0,
    Number.parseInt(url.searchParams.get("latencyMs") || "100", 10),
  );
  const chunkBytes = Math.max(
    512,
    Number.parseInt(url.searchParams.get("chunkBytes") || "4096", 10),
  );
  const scheduler = acquireScheduler(url.searchParams.get("run"), rateKbps);
  setCommonHeaders(response, filePath);
  response.setHeader("Content-Length", stat.size);
  response.setHeader(
    "Server-Timing",
    `configured-latency;dur=${latencyMs}, configured-rate;desc="${rateKbps} Kbps"`,
  );
  response.writeHead(200);

  const stream = fs.createReadStream(filePath, { highWaterMark: chunkBytes });
  let firstChunk = true;
  let disconnected = false;
  request.on("close", () => {
    disconnected = true;
    stream.destroy();
  });

  try {
    for await (const chunk of stream) {
      if (disconnected) {
        return;
      }
      if (firstChunk) {
        firstChunk = false;
        await delay(latencyMs);
      }
      await scheduler.transmit(chunk.length);
      if (!response.write(chunk)) {
        await new Promise((resolve) => response.once("drain", resolve));
      }
    }
    response.end();
  } catch (error) {
    if (!disconnected) {
      throw error;
    }
  } finally {
    scheduler.release();
  }
}

async function serveStatic(response, url) {
  const pathname = url.pathname === "/" ? "/benchmark.html" : url.pathname;
  const filePath = resolveInsideRoot(pathname);
  if (!filePath || !isPublicStaticFile(filePath)) {
    response.writeHead(400).end("Invalid path.");
    return;
  }
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) {
      throw new Error("Not a file");
    }
    setCommonHeaders(response, filePath);
    response.setHeader("Content-Length", stat.size);
    response.writeHead(200);
    fs.createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    }).end("Not found.");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname === "/__benchmark/capabilities") {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      }).end(JSON.stringify({ controlledStreaming: true }));
      return;
    }
    if (url.pathname === "/__benchmark/stream") {
      await streamAtRate(request, response, url);
      return;
    }
    await serveStatic(response, url);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) {
      response.writeHead(500);
    }
    response.end("Internal server error.");
  }
});

server.listen(port, host, () => {
  console.log(`Benchmark server: http://${host}:${port}/benchmark.html`);
});
