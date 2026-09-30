import { loadImagePreviewImplementation } from "./image-preview-demo-support.js";

const manifestUrl = "./benchmark-assets/manifest.json";
const imageSelect = document.getElementById("imageSelect");
const previewSelect = document.getElementById("previewSelect");
const finalSelect = document.getElementById("finalSelect");
const progressiveSelect = document.getElementById("progressiveSelect");
const deliverySelect = document.getElementById("deliverySelect");
const rateSelect = document.getElementById("rateSelect");
const latencySelect = document.getElementById("latencySelect");
const rateControl = document.getElementById("rateControl");
const latencyControl = document.getElementById("latencyControl");
const runButton = document.getElementById("runButton");
const status = document.getElementById("benchmarkStatus");
const imageFrame = document.getElementById("imageFrame");
const image = document.getElementById("benchmarkImage");
const implementationValue = document.getElementById("implementationValue");
const strategyValue = document.getElementById("strategyValue");
const compatibilityValue = document.getElementById("compatibilityValue");
const previewResults = document.getElementById("previewResults");
const progressiveResults = document.getElementById("progressiveResults");
const structuredResult = document.getElementById("structuredResult");

const query = new URL(window.location.href).searchParams;
const autorun = query.get("autorun");
let manifest;
let previewImplementation;
let activeRun = 0;
let latestResults = {};
let resolvedDeliveryMode = "direct";

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function assetPath(file) {
  return file.replace(/^\.\//, "");
}

function streamUrl(file, runToken) {
  const url = new URL("/__benchmark/stream", window.location.origin);
  url.searchParams.set("path", assetPath(file));
  url.searchParams.set("rateKbps", rateSelect.value);
  url.searchParams.set("latencyMs", latencySelect.value);
  url.searchParams.set("run", runToken);
  return url.href;
}

function directUrl(file, runToken) {
  const url = new URL(file, window.location.href);
  url.searchParams.set("run", runToken);
  return url.href;
}

function imageUrl(file, runToken) {
  return resolvedDeliveryMode === "controlled"
    ? streamUrl(file, runToken)
    : directUrl(file, runToken);
}

async function resolveDeliveryMode() {
  const requested = deliverySelect.value;
  if (requested === "direct") {
    resolvedDeliveryMode = "direct";
  } else {
    let controlledAvailable = false;
    try {
      const response = await fetch("./__benchmark/capabilities", {
        cache: "no-store",
      });
      if (response.ok) {
        const capabilities = await response.json();
        controlledAvailable = capabilities.controlledStreaming === true;
      }
    } catch {
      // Static hosts intentionally fall back to direct asset delivery.
    }
    if (requested === "controlled" && !controlledAvailable) {
      throw new Error(
        "Controlled streaming is unavailable on this host. Choose direct delivery.",
      );
    }
    resolvedDeliveryMode = controlledAvailable ? "controlled" : "direct";
  }

  const controlled = resolvedDeliveryMode === "controlled";
  rateSelect.disabled = !controlled;
  latencySelect.disabled = !controlled;
  rateControl.title = controlled
    ? ""
    : "Rate is controlled by the network and static host.";
  latencyControl.title = controlled
    ? ""
    : "Latency is controlled by the network and static host.";
  return resolvedDeliveryMode;
}

function afterPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function waitForImageLoad(target, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Image load timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timeout);
      target.removeEventListener("load", onLoad);
      target.removeEventListener("error", onError);
    }
    function onLoad() {
      cleanup();
      resolve();
    }
    async function onError() {
      cleanup();
      const source = target.currentSrc || target.src;
      if (source && !source.includes("/__benchmark/stream")) {
        try {
          const response = await fetch(source, {
            method: "HEAD",
            cache: "no-store",
          });
          if (!response.ok) {
            reject(new Error(
              `Image request failed with HTTP ${response.status}: ${
                new URL(source).pathname
              }`,
            ));
            return;
          }
          const contentType = response.headers.get("content-type") || "unknown";
          reject(new Error(
            `The browser could not decode the selected image (Content-Type: ${contentType}).`,
          ));
          return;
        } catch (error) {
          if (error instanceof TypeError) {
            reject(new Error(`Image request failed: ${error.message}`));
            return;
          }
          reject(error);
          return;
        }
      }
      reject(new Error("The browser could not decode the selected image."));
    }
    target.addEventListener("load", onLoad, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function relative(value, startedAt) {
  return Number.isFinite(value) ? round(value - startedAt) : null;
}

function selectedRecord() {
  return manifest.images.find((entry) => entry.id === imageSelect.value);
}

function getResourceEntries(runToken) {
  return performance.getEntriesByType("resource")
    .filter((entry) => entry.name.includes(`run=${runToken}`))
    .map((entry) => ({
      name: entry.name,
      startTime: round(entry.startTime),
      responseStart: round(entry.responseStart),
      responseEnd: round(entry.responseEnd),
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
    }));
}

function totalResourceField(resources, field) {
  return resources.reduce((total, entry) => total + (entry[field] || 0), 0);
}

function beginLongTaskCollection() {
  const entries = [];
  let observer = null;
  if (PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
    observer.observe({ type: "longtask", buffered: false });
  }
  return () => {
    observer?.disconnect();
    return {
      count: entries.length,
      duration: round(entries.reduce((sum, entry) => sum + entry.duration, 0)),
    };
  };
}

function resetImage(record) {
  image.removeAttribute("src");
  image.removeAttribute("previewsrc");
  delete image.dataset.imagePreviewBenchmarkId;
  image.width = record.width;
  image.height = record.height;
  image.alt = record.id;
  imageFrame.style.aspectRatio = `${record.width} / ${record.height}`;
  compatibilityValue.textContent = "Testing...";
}

function collectPolyfillTimings(benchmarkId, startedAt) {
  const timings = {};
  const handler = (event) => {
    if (event.detail?.benchmarkId === benchmarkId) {
      timings[event.detail.milestone] = relative(event.detail.time, startedAt);
    }
  };
  document.addEventListener("imagepreviewtiming", handler);
  return {
    timings,
    stop() {
      document.removeEventListener("imagepreviewtiming", handler);
    },
  };
}

async function runPreviewStrategy(record, runToken) {
  const preview = record.previews[previewSelect.value];
  const final = record.finals[finalSelect.value];
  if (!preview?.available || !final?.available) {
    throw new Error("The selected preview or final asset was not generated.");
  }

  resetImage(record);
  strategyValue.textContent = `${preview.label} preview + ${final.label} final`;
  const benchmarkId = `preview-${runToken}`;
  const startedAt = performance.now();
  const stopLongTasks = beginLongTaskCollection();
  const polyfill = collectPolyfillTimings(benchmarkId, startedAt);
  image.dataset.imagePreviewBenchmarkId = benchmarkId;
  image.decoding = "async";

  const loadPromise = waitForImageLoad(image);
  image.setAttribute(
    "previewsrc",
    preview.transport === "inline"
      ? preview.dataUrl
      : imageUrl(preview.file, runToken),
  );
  image.src = imageUrl(final.file, runToken);

  try {
    await loadPromise;
    const loadedAt = performance.now();
    await image.decode();
    const decodedAt = performance.now();
    await afterPaint();
    const paintedAt = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const resources = getResourceEntries(runToken);
    const previewCompatibility = previewImplementation.hasNativePreviewSource
      ? "native-preview-opaque"
      : polyfill.timings["preview-painted"] != null
        ? "preview-painted"
        : polyfill.timings["preview-error"] != null
          ? "preview-decode-failed"
          : "preview-not-painted-before-final";
    compatibilityValue.textContent = previewCompatibility;
    return {
      strategy: "preview",
      deliveryMode: resolvedDeliveryMode,
      runToken,
      measurementClockStartedAt: round(startedAt),
      formats: {
        preview: preview.format,
        final: final.format,
      },
      configuredBytes: {
        preview: preview.configuredBytes ?? preview.bytes,
        previewEncoded: preview.bytes,
        final: final.bytes,
        total: (preview.configuredBytes ?? preview.bytes) + final.bytes,
      },
      timings: {
        finalLoaded: relative(loadedAt, startedAt),
        finalDecoded: relative(decodedAt, startedAt),
        finalPaintApproximation: relative(paintedAt, startedAt),
        ...polyfill.timings,
      },
      longTasks: stopLongTasks(),
      resources,
      observedTransferSize: totalResourceField(resources, "transferSize"),
      observedEncodedBodySize: totalResourceField(resources, "encodedBodySize"),
      previewImplementation: previewImplementation.hasNativePreviewSource
        ? "native"
        : "polyfill",
      previewTransport: preview.transport || "external",
      previewCompatibility,
    };
  } finally {
    polyfill.stop();
  }
}

async function runProgressiveStrategy(record, runToken) {
  const progressive = record.progressive[progressiveSelect.value];
  if (!progressive?.available) {
    throw new Error(progressive?.reason || "The progressive asset was not generated.");
  }

  resetImage(record);
  strategyValue.textContent = `Progressive ${progressive.label}`;
  const startedAt = performance.now();
  const stopLongTasks = beginLongTaskCollection();
  image.decoding = "async";
  const loadPromise = waitForImageLoad(image);
  image.src = imageUrl(progressive.file, runToken);

  await loadPromise;
  const loadedAt = performance.now();
  await image.decode();
  const decodedAt = performance.now();
  await afterPaint();
  const paintedAt = performance.now();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const resources = getResourceEntries(runToken);
  compatibilityValue.textContent = "Decoded; incremental paint not yet classified";
  return {
    strategy: "progressive",
    deliveryMode: resolvedDeliveryMode,
    runToken,
    measurementClockStartedAt: round(startedAt),
    formats: { progressive: progressive.format },
    configuredBytes: {
      progressive: progressive.bytes,
      total: progressive.bytes,
    },
    checkpoints: progressive.checkpoints,
    timings: {
      firstVisual: null,
      finalLoaded: relative(loadedAt, startedAt),
      finalDecoded: relative(decodedAt, startedAt),
      finalPaintApproximation: relative(paintedAt, startedAt),
    },
    longTasks: stopLongTasks(),
    resources,
    observedTransferSize: totalResourceField(resources, "transferSize"),
    observedEncodedBodySize: totalResourceField(resources, "encodedBodySize"),
    incrementalPaintClassification: "requires-visual-pass",
  };
}

function metric(label, value, description = "") {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const valueNode = document.createElement("dd");
  term.textContent = label;
  valueNode.textContent = value;
  if (description) {
    row.title = description;
    term.title = description;
  }
  row.append(term, valueNode);
  return row;
}

function formatMs(value) {
  return value == null ? "Not observable" : `${value.toFixed(2)} ms`;
}

function formatBytes(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${new Intl.NumberFormat().format(value)} B`;
}

function renderResult(result, container) {
  const metrics = [
    metric(
      "Delivery",
      result.deliveryMode === "controlled" ? "Controlled stream" : "Direct static",
      result.deliveryMode === "controlled"
        ? "The local benchmark endpoint schedules shared bandwidth and latency."
        : "The image is loaded directly from the static host with a cache-busting URL.",
    ),
    metric(
      result.strategy === "preview" ? "Codec path" : "Codec",
      result.strategy === "preview"
        ? `${result.formats.preview.toUpperCase()} preview → ${
            result.formats.final.toUpperCase()
          } final`
        : result.formats.progressive.toUpperCase(),
      result.strategy === "preview"
        ? "The preview codec and final-image codec selected for this treatment."
        : "The codec used by the single progressive image.",
    ),
    metric(
      "Configured bytes",
      formatBytes(result.configuredBytes.total),
      "Payload size configured by the benchmark. External previews use their encoded file "
        + "size; inline previews include the complete Base64 data URL; the final file is added.",
    ),
    metric(
      "Observed body bytes",
      formatBytes(result.observedEncodedBodySize),
      "Encoded HTTP response-body bytes reported by Resource Timing. This excludes "
        + "response headers, TLS, TCP/IP, connection setup, and retransmissions.",
    ),
  ];
  if (result.previewTransport === "inline") {
    metrics.push(metric(
      "Inline preview payload",
      formatBytes(result.configuredBytes.preview),
      "Complete data URL size, including the MIME prefix and Base64 expansion. It is counted "
        + "in configured bytes but creates no separate HTTP response.",
    ));
  }
  metrics.push(
    metric("Final load", formatMs(result.timings.finalLoaded)),
    metric("Final decode", formatMs(result.timings.finalDecoded)),
    metric("Final paint approximation", formatMs(result.timings.finalPaintApproximation)),
    metric(
      "First visual",
      formatMs(result.timings["preview-painted"] ?? result.timings.firstVisual),
    ),
    metric("Long tasks", `${result.longTasks.count} / ${formatMs(result.longTasks.duration)}`),
  );
  container.replaceChildren(...metrics);
}

function currentConfig() {
  return {
    image: imageSelect.value,
    preview: previewSelect.value,
    final: finalSelect.value,
    progressive: progressiveSelect.value,
    delivery: deliverySelect.value,
    resolvedDelivery: resolvedDeliveryMode,
    rateKbps: Number(rateSelect.value),
    latencyMs: Number(latencySelect.value),
  };
}

function updateUrl() {
  const url = new URL(window.location.href);
  const config = currentConfig();
  Object.entries(config).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.delete("autorun");
  window.history.replaceState(null, "", url);
}

async function execute(strategy) {
  const runNumber = activeRun + 1;
  activeRun = runNumber;
  const record = selectedRecord();
  const runToken = `${Date.now()}-${strategy}-${runNumber}`;
  performance.clearResourceTimings();
  setStatus(`Running ${strategy} strategy...`);
  const result = strategy === "preview"
    ? await runPreviewStrategy(record, runToken)
    : await runProgressiveStrategy(record, runToken);
  if (activeRun !== runNumber) {
    throw new Error("Run was superseded.");
  }
  latestResults[strategy] = result;
  renderResult(
    result,
    strategy === "preview" ? previewResults : progressiveResults,
  );
  structuredResult.textContent = JSON.stringify({
    config: currentConfig(),
    results: latestResults,
  }, null, 2);
  return result;
}

async function runBoth() {
  runButton.disabled = true;
  latestResults = {};
  try {
    await resolveDeliveryMode();
    updateUrl();
    await execute("preview");
    await execute("progressive");
    strategyValue.textContent = "Complete";
    setStatus(
      finalSelect.value === progressiveSelect.value
        ? "Both clean passes completed sequentially with the same final codec."
        : "Both passes completed. This is a cross-codec comparison, so byte differences "
          + "include codec efficiency as well as loading strategy.",
    );
  } catch (error) {
    console.error(error);
    compatibilityValue.textContent = "Failed";
    setStatus(error.message, true);
  } finally {
    runButton.disabled = false;
  }
}

function populateAssetSelect(select, assets, selectedValue) {
  select.replaceChildren();
  Object.entries(assets).forEach(([key, asset]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = asset.available
      ? `${asset.label} (${formatBytes(asset.configuredBytes ?? asset.bytes)})`
      : `${asset.label} — unavailable`;
    option.disabled = !asset.available;
    option.title = asset.reason || "";
    select.appendChild(option);
  });
  if (selectedValue && select.querySelector(`option[value="${CSS.escape(selectedValue)}"]`)) {
    select.value = selectedValue;
  }
  if (select.selectedOptions[0]?.disabled) {
    select.value = Array.from(select.options).find((option) => !option.disabled)?.value || "";
  }
}

function populateForImage() {
  const record = selectedRecord();
  populateAssetSelect(previewSelect, record.previews, query.get("preview"));
  populateAssetSelect(finalSelect, record.finals, query.get("final"));
  populateAssetSelect(progressiveSelect, record.progressive, query.get("progressive"));
}

function validateRequestedAsset(record, group, parameter) {
  const requested = query.get(parameter);
  if (!requested) {
    return;
  }
  const asset = record[group][requested];
  if (!asset) {
    throw new Error(`Unknown ${parameter} format "${requested}".`);
  }
  if (!asset.available) {
    throw new Error(
      `${asset.label} is unavailable: ${asset.reason || "asset generation failed"}`,
    );
  }
}

function selectQueryValue(select, name) {
  const value = query.get(name);
  if (value && Array.from(select.options).some((option) => option.value === value)) {
    select.value = value;
  }
}

async function initialize() {
  if (autorun) {
    document.body.classList.add("autorun");
  }
  const response = await fetch(manifestUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      "Benchmark assets are missing. Run `npm run benchmark:generate` first.",
    );
  }
  manifest = await response.json();
  previewImplementation = await loadImagePreviewImplementation();
  if (previewImplementation.polyfill) {
    previewImplementation.polyfill.transitionsEnabled = false;
  }
  implementationValue.textContent = previewImplementation.hasNativePreviewSource
    ? "Native API"
    : "Instrumented polyfill";

  imageSelect.replaceChildren(...manifest.images.map((record) => {
    const option = document.createElement("option");
    option.value = record.id;
    option.textContent = record.id;
    return option;
  }));
  selectQueryValue(imageSelect, "image");
  const requestedRecord = selectedRecord();
  validateRequestedAsset(requestedRecord, "previews", "preview");
  validateRequestedAsset(requestedRecord, "finals", "final");
  validateRequestedAsset(requestedRecord, "progressive", "progressive");
  populateForImage();
  selectQueryValue(rateSelect, "rateKbps");
  selectQueryValue(latencySelect, "latencyMs");
  selectQueryValue(deliverySelect, "delivery");
  await resolveDeliveryMode();
  resetImage(selectedRecord());

  imageSelect.addEventListener("change", () => {
    populateForImage();
    resetImage(selectedRecord());
  });
  deliverySelect.addEventListener("change", async () => {
    try {
      await resolveDeliveryMode();
      setStatus(
        resolvedDeliveryMode === "controlled"
          ? "Controlled streaming is available."
          : "Using direct static delivery; network conditions are uncontrolled.",
      );
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  runButton.addEventListener("click", runBoth);
  setStatus(
    resolvedDeliveryMode === "controlled"
      ? "Ready. Controlled runs use separate sequential image loads."
      : "Ready. Using direct static delivery with uncontrolled network conditions.",
  );
  window.__benchmarkReady = true;

  if (autorun === "preview" || autorun === "progressive") {
    let started = false;
    const startAutorun = async () => {
      if (started) {
        return window.__benchmarkResult;
      }
      started = true;
      try {
        window.__benchmarkResult = await execute(autorun);
        setStatus(`${autorun} autorun complete.`);
        return window.__benchmarkResult;
      } catch (error) {
        window.__benchmarkError = error.message;
        setStatus(error.message, true);
        throw error;
      }
    };
    window.__startBenchmark = startAutorun;
    if (query.get("visualHold") === "1") {
      setStatus("Visual runner is ready to establish its baseline.");
      return;
    }
    try {
      await startAutorun();
    } catch (error) {
      // startAutorun publishes the failure for the automation harness.
    }
  }
}

initialize().catch((error) => {
  console.error(error);
  window.__benchmarkError = error.message;
  setStatus(error.message, true);
  runButton.disabled = true;
});
