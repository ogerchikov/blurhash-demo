import { encode as encodeBlurhash } from "https://cdn.jsdelivr.net/npm/blurhash/+esm";
import { rgbaToThumbHash } from "https://cdn.jsdelivr.net/npm/thumbhash/+esm";

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const LQIP_MAX_DIMENSION = 32;
const LQIP_QUALITY = 0.45;

const scanButton = document.getElementById("scanButton");
const generateButton = document.getElementById("generateButton");
const downloadButton = document.getElementById("downloadButton");
const copyButton = document.getElementById("copyButton");

const fileListInput = document.getElementById("fileListInput");
const outputJson = document.getElementById("outputJson");
const scanStatus = document.getElementById("scanStatus");
const generateStatus = document.getElementById("generateStatus");
const resultSummary = document.getElementById("resultSummary");

let latestManifest = null;

function extname(fileName) {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) {
    return "";
  }
  return fileName.slice(dot).toLowerCase();
}

function isSupportedImage(fileName) {
  return SUPPORTED_EXTENSIONS.has(extname(fileName));
}

function computeBlurhashComponents(width, height) {
  const xComponents = width >= height ? 4 : 3;
  const yComponents = height >= width ? 4 : 3;
  return { xComponents, yComponents };
}

function listFromTextarea(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => isSupportedImage(line));
}

function byteArrayToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }

  return btoa(binary);
}

function dataUrlPayloadBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) {
    return 0;
  }

  const base64 = dataUrl.slice(comma + 1);
  return atob(base64).length;
}

function makeShimmerDataUrl(width, height, baseHex, animate = true) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const sweep = safeWidth * 2;
  const base = hexToRgb(baseHex);
  const edge = mixWithWhite(base, 0.08);
  const highlight = mixWithWhite(base, 0.16);
  const edgeHex = rgbToHex(edge.r, edge.g, edge.b);
  const highlightHex = rgbToHex(highlight.r, highlight.g, highlight.b);
  const animation = animate
    ? `
      <animate attributeName="x1" values="-${sweep};${sweep}" dur="1.8s" repeatCount="indefinite" />
      <animate attributeName="x2" values="0;${sweep * 2}" dur="1.8s" repeatCount="indefinite" />`
    : "";
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${safeWidth} ${safeHeight}" preserveAspectRatio="none">
  <defs>
    <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="-${sweep}" y1="0" x2="0" y2="0">
      <stop offset="0%" stop-color="${baseHex}" />
      <stop offset="44%" stop-color="${edgeHex}" />
      <stop offset="50%" stop-color="${highlightHex}" />
      <stop offset="56%" stop-color="${edgeHex}" />
      <stop offset="100%" stop-color="${baseHex}" />
      ${animation}
    </linearGradient>
  </defs>
  <rect width="${safeWidth}" height="${safeHeight}" fill="url(#g)" />
</svg>`;

  return {
    mimeType: "image/svg+xml",
    width: safeWidth,
    height: safeHeight,
    svg,
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`,
  };
}

function componentToHex(value) {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}

function rgbToHex(r, g, b) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function hexToRgb(hex) {
  const normalized = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return { r: 184, g: 198, b: 216 };
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function mixWithWhite(color, amount) {
  const t = Math.max(0, Math.min(1, amount));
  return {
    r: Math.round(color.r + (255 - color.r) * t),
    g: Math.round(color.g + (255 - color.g) * t),
    b: Math.round(color.b + (255 - color.b) * t),
  };
}

function computeAverageColor(rgba) {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let alphaSum = 0;

  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] / 255;
    rSum += rgba[i] * alpha;
    gSum += rgba[i + 1] * alpha;
    bSum += rgba[i + 2] * alpha;
    alphaSum += alpha;
  }

  if (alphaSum === 0) {
    return { r: 184, g: 198, b: 216 };
  }

  return {
    r: Math.round(rSum / alphaSum),
    g: Math.round(gSum / alphaSum),
    b: Math.round(bSum / alphaSum),
  };
}

function makeSummaryTable(images) {
  if (images.length === 0) {
    return "";
  }

  const rows = images
    .map((item) => {
      return `<tr>
        <td>${item.id}</td>
        <td>${item.width}x${item.height}</td>
        <td>${item.bytes.blurhashChars}</td>
        <td>${item.bytes.thumbhashBytes}</td>
        <td>${item.bytes.lqipBytes}</td>
        <td>${item.color.hex}</td>
        <td>${item.bytes.shimmerBytes}</td>
      </tr>`;
    })
    .join("\n");

  return `<table>
    <thead>
      <tr>
        <th>Image</th>
        <th>Size</th>
        <th>BlurHash chars</th>
        <th>ThumbHash bytes</th>
        <th>LQIP bytes</th>
        <th>Color</th>
        <th>Shimmer bytes</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`;
}

function createDownload(name, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function imageToRgba(image, maxDimension = null) {
  let targetWidth = image.naturalWidth;
  let targetHeight = image.naturalHeight;

  if (typeof maxDimension === "number" && maxDimension > 0) {
    const largest = Math.max(targetWidth, targetHeight);
    if (largest > maxDimension) {
      const scale = maxDimension / largest;
      targetWidth = Math.max(1, Math.round(targetWidth * scale));
      targetHeight = Math.max(1, Math.round(targetHeight * scale));
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    rgba: imageData.data,
  };
}

function makeLqipDataUrl(image, maxDimension = LQIP_MAX_DIMENSION, quality = LQIP_QUALITY) {
  let targetWidth = image.naturalWidth;
  let targetHeight = image.naturalHeight;

  const largest = Math.max(targetWidth, targetHeight);
  if (largest > maxDimension) {
    const scale = maxDimension / largest;
    targetWidth = Math.max(1, Math.round(targetWidth * scale));
    targetHeight = Math.max(1, Math.round(targetHeight * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return {
    width: targetWidth,
    height: targetHeight,
    dataUrl: canvas.toDataURL("image/jpeg", quality),
  };
}

async function computePlaceholdersForFile(fileName) {
  const src = `./images/${fileName}`;
  const image = await loadImage(src);
  const full = imageToRgba(image);
  const thumbInput = imageToRgba(image, 100);

  const { xComponents, yComponents } = computeBlurhashComponents(full.width, full.height);
  const blurhash = encodeBlurhash(full.rgba, full.width, full.height, xComponents, yComponents);

  const thumbhashBytes = rgbaToThumbHash(thumbInput.width, thumbInput.height, thumbInput.rgba);
  const thumbhashBase64 = byteArrayToBase64(thumbhashBytes);
  const lqip = makeLqipDataUrl(image);
  const lqipBytes = dataUrlPayloadBytes(lqip.dataUrl);
  const avgColor = computeAverageColor(thumbInput.rgba);
  const colorHex = rgbToHex(avgColor.r, avgColor.g, avgColor.b);
  const shimmer = makeShimmerDataUrl(lqip.width, lqip.height, colorHex);
  const shimmerBytes = new TextEncoder().encode(shimmer.svg).length;

  return {
    id: fileName.replace(/\.[^.]+$/, ""),
    src,
    width: full.width,
    height: full.height,
    blurhash,
    thumbhashBase64,
    lqip: {
      mimeType: "image/jpeg",
      width: lqip.width,
      height: lqip.height,
      dataUrl: lqip.dataUrl,
    },
    color: {
      r: avgColor.r,
      g: avgColor.g,
      b: avgColor.b,
      hex: colorHex,
    },
    shimmer: {
      mimeType: shimmer.mimeType,
      width: shimmer.width,
      height: shimmer.height,
      dataUrl: shimmer.dataUrl,
    },
    bytes: {
      blurhashChars: blurhash.length,
      thumbhashBytes: thumbhashBytes.length,
      thumbhashBase64Chars: thumbhashBase64.length,
      lqipBytes,
      lqipDataUrlChars: lqip.dataUrl.length,
      colorHexChars: colorHex.length,
      shimmerBytes,
      shimmerDataUrlChars: shimmer.dataUrl.length,
    },
  };
}

async function scanImagesFolder() {
  scanStatus.textContent = "Scanning ./images ...";

  try {
    const response = await fetch("./images/");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const hrefMatches = [...html.matchAll(/href=["']([^"']+)["']/gi)];

    const names = hrefMatches
      .map((m) => m[1])
      .map((href) => {
        const clean = href.split("?")[0].split("#")[0];
        const parts = clean.split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
      })
      .filter((name) => name.length > 0)
      .filter((name) => isSupportedImage(name));

    const uniqueSorted = [...new Set(names)].sort((a, b) => a.localeCompare(b));

    if (uniqueSorted.length === 0) {
      throw new Error("No supported files found in listing");
    }

    fileListInput.value = uniqueSorted.join("\n");
    scanStatus.textContent = `Found ${uniqueSorted.length} image(s).`;
  } catch (error) {
    scanStatus.textContent = `Scan failed: ${error.message}. Paste file names manually.`;
  }
}

async function generateManifest() {
  const files = listFromTextarea(fileListInput.value);

  if (files.length === 0) {
    generateStatus.textContent = "No valid image file names were provided.";
    return;
  }

  generateButton.disabled = true;
  generateStatus.textContent = `Computing placeholders for ${files.length} image(s) ...`;

  try {
    const images = [];

    for (const fileName of files) {
      generateStatus.textContent = `Computing ${fileName} ...`;
      const item = await computePlaceholdersForFile(fileName);
      images.push(item);
    }

    latestManifest = {
      generatedAt: new Date().toISOString(),
      generatedBy: "browser-precompute",
      images,
    };

    const json = `${JSON.stringify(latestManifest, null, 2)}\n`;
    outputJson.value = json;
    resultSummary.innerHTML = makeSummaryTable(images);

    downloadButton.disabled = false;
    copyButton.disabled = false;
    generateStatus.textContent = `Done. Generated ${images.length} record(s).`;
  } catch (error) {
    generateStatus.textContent = `Generation failed: ${error.message}`;
    resultSummary.innerHTML = "";
  } finally {
    generateButton.disabled = false;
  }
}

scanButton.addEventListener("click", () => {
  scanImagesFolder();
});

generateButton.addEventListener("click", () => {
  generateManifest();
});

downloadButton.addEventListener("click", () => {
  if (!latestManifest) {
    return;
  }
  createDownload("photos.json", outputJson.value);
});

copyButton.addEventListener("click", async () => {
  if (!latestManifest) {
    return;
  }

  try {
    await navigator.clipboard.writeText(outputJson.value);
    generateStatus.textContent = "JSON copied to clipboard.";
  } catch {
    generateStatus.textContent = "Clipboard copy failed. Use Download instead.";
  }
});
