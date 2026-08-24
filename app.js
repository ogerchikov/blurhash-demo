
import { decode as decodeBlurHash } from "https://cdn.jsdelivr.net/npm/blurhash/+esm";
import {
  thumbHashToRGBA,
} from "https://cdn.jsdelivr.net/npm/thumbhash/+esm";

const DEFAULT_IMAGE_SRC = "./images/beach.png";
const PHOTOS_MANIFEST_SRC = "./photos.json";
const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

const delayInput = document.getElementById("delayInput");
const delayValue = document.getElementById("delayValue");
const decodeHeightSelect = document.getElementById("decodeHeightSelect");
const replayButton = document.getElementById("replayButton");
const allImagesStatus = document.getElementById("allImagesStatus");
const allImagesRowsBody = document.getElementById("allImagesRowsBody");

const blurhashViewport = document.getElementById("blurhashViewport");
const thumbhashViewport = document.getElementById("thumbhashViewport");
const lqipViewport = document.getElementById("lqipViewport");
const avifViewport = document.getElementById("avifViewport");
const colorViewport = document.getElementById("colorViewport");
const shimmerViewport = document.getElementById("shimmerViewport");
const blurhashStatus = document.getElementById("blurhashStatus");
const thumbhashStatus = document.getElementById("thumbhashStatus");
const lqipStatus = document.getElementById("lqipStatus");
const avifStatus = document.getElementById("avifStatus");
const colorStatus = document.getElementById("colorStatus");
const shimmerStatus = document.getElementById("shimmerStatus");

const blurhashPayload = document.getElementById("blurhashPayload");
const thumbhashPayload = document.getElementById("thumbhashPayload");
const lqipPayload = document.getElementById("lqipPayload");
const avifPayload = document.getElementById("avifPayload");
const colorPayload = document.getElementById("colorPayload");
const shimmerPayload = document.getElementById("shimmerPayload");
const blurhashDecodeMs = document.getElementById("blurhashDecodeMs");
const thumbhashDecodeMs = document.getElementById("thumbhashDecodeMs");
const lqipDecodeMs = document.getElementById("lqipDecodeMs");
const avifDecodeMs = document.getElementById("avifDecodeMs");
const colorDecodeMs = document.getElementById("colorDecodeMs");
const shimmerDecodeMs = document.getElementById("shimmerDecodeMs");
const blurhashFirstPaintMs = document.getElementById("blurhashFirstPaintMs");
const thumbhashFirstPaintMs = document.getElementById("thumbhashFirstPaintMs");
const lqipFirstPaintMs = document.getElementById("lqipFirstPaintMs");
const avifFirstPaintMs = document.getElementById("avifFirstPaintMs");
const colorFirstPaintMs = document.getElementById("colorFirstPaintMs");
const shimmerFirstPaintMs = document.getElementById("shimmerFirstPaintMs");
const blurhashBlockMs = document.getElementById("blurhashBlockMs");
const thumbhashBlockMs = document.getElementById("thumbhashBlockMs");
const lqipBlockMs = document.getElementById("lqipBlockMs");
const avifBlockMs = document.getElementById("avifBlockMs");
const colorBlockMs = document.getElementById("colorBlockMs");
const shimmerBlockMs = document.getElementById("shimmerBlockMs");
const blurhashSimilarity = document.getElementById("blurhashSimilarity");
const thumbhashSimilarity = document.getElementById("thumbhashSimilarity");
const lqipSimilarity = document.getElementById("lqipSimilarity");
const avifSimilarity = document.getElementById("avifSimilarity");
const colorSimilarity = document.getElementById("colorSimilarity");
const shimmerSimilarity = document.getElementById("shimmerSimilarity");
const blurhashShownMs = document.getElementById("blurhashShownMs");
const thumbhashShownMs = document.getElementById("thumbhashShownMs");
const lqipShownMs = document.getElementById("lqipShownMs");
const avifShownMs = document.getElementById("avifShownMs");
const colorShownMs = document.getElementById("colorShownMs");
const shimmerShownMs = document.getElementById("shimmerShownMs");

const state = {
  sourceImage: null,
  imageRecord: null,
  manifestImages: [],
  currentImageSrc: DEFAULT_IMAGE_SRC,
  availableImageSrcs: [],
  blurhashString: null,
  thumbHashBytes: null,
  lqipDataUrl: null,
  avifDataUrl: null,
  avifMimeType: "image/avif",
  colorHex: null,
  shimmerDataUrl: null,
  prefersReducedMotion: false,
  aspectRatio: 3 / 2,
  switchToken: 0,
  sourceImageBySrc: new Map(),
  rowBenchmarksBySrc: new Map(),
};

function makeCanvasFromRGBA(rgba, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  const imageData = context.createImageData(width, height);
  imageData.data.set(rgba);
  context.putImageData(imageData, 0, 0);

  return canvas;
}

function makeBlurhashCanvas(hash, width, height) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const rgba = decodeBlurHash(hash, safeWidth, safeHeight);
  return makeCanvasFromRGBA(rgba, safeWidth, safeHeight);
}

function makeThumbhashCanvas(hashBytes) {
  const decoded = thumbHashToRGBA(hashBytes);
  return makeCanvasFromRGBA(decoded.rgba, decoded.w, decoded.h);
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

function makeColorPlaceholderNode(hex) {
  const node = document.createElement("div");
  node.className = "color-preview";
  node.style.backgroundColor = hex;
  return node;
}

function makeShimmerDataUrl(width, height, baseHex, animate = true) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const sweep = safeWidth * 2;
  const base = hexToRgb(baseHex);
  const edgeHex = rgbToHex(...Object.values(mixWithWhite(base, 0.08)));
  const highlightHex = rgbToHex(...Object.values(mixWithWhite(base, 0.16)));
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

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

function makeShimmerImageNode(dataUrl) {
  const image = new Image();
  image.className = "shimmer-preview";
  image.src = dataUrl;
  return image;
}

function revealFullImage(placeholderNode, image, startedAt, statusNode, shownAtNode) {
  const viewport = placeholderNode.parentElement;
  if (!viewport) {
    return;
  }

  image.classList.add("full-image-enter");
  viewport.appendChild(image);
  placeholderNode.classList.add("placeholder-exit");

  image.getBoundingClientRect();
  requestAnimationFrame(() => {
    image.classList.add("is-visible");

    if (state.prefersReducedMotion) {
      placeholderNode.remove();
    }
  });

  if (!state.prefersReducedMotion) {
    image.addEventListener("transitionend", () => placeholderNode.remove(), { once: true });
  }

  const shownAt = performance.now() - startedAt;
  shownAtNode.textContent = formatMs(shownAt);
  showStatus(statusNode, "full image shown");
}

function updateDelayLabel() {
  delayValue.textContent = `${delayInput.value} ms`;
}

function clearViewport(viewport) {
  while (viewport.firstChild) {
    viewport.firstChild.remove();
  }
}

function setViewportAspect(ratio) {
  const aspect = ratio || 3 / 2;
  blurhashViewport.style.aspectRatio = `${aspect}`;
  thumbhashViewport.style.aspectRatio = `${aspect}`;
  lqipViewport.style.aspectRatio = `${aspect}`;
  avifViewport.style.aspectRatio = `${aspect}`;
  colorViewport.style.aspectRatio = `${aspect}`;
  shimmerViewport.style.aspectRatio = `${aspect}`;
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

function decodeHeightToSize(decodeHeight, ratio) {
  const height = Math.max(1, Number(decodeHeight));
  const width = Math.max(1, Math.round(height * ratio));
  return { width, height };
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function normalizeSrc(src) {
  return src.replace(/^\.\//, "");
}

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

async function listImagesFromFolder() {
  const response = await fetch("./images/");
  if (!response.ok) {
    throw new Error(`Failed to read images folder (${response.status})`);
  }

  const html = await response.text();
  const hrefMatches = [...html.matchAll(/href=["']([^"']+)["']/gi)];

  const names = hrefMatches
    .map((match) => match[1])
    .map((href) => {
      const clean = href.split("?")[0].split("#")[0];
      const parts = clean.split("/").filter(Boolean);
      return parts[parts.length - 1] || "";
    })
    .filter((name) => name.length > 0)
    .filter((name) => isSupportedImage(name));

  const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  return unique.map((name) => `./images/${name}`);
}

async function listImagesFromManifest() {
  const images = await loadManifestImages();

  return images
    .map((item) => item?.src)
    .filter((src) => typeof src === "string" && src.trim().length > 0);
}

async function loadManifestImages() {
  const response = await fetch(PHOTOS_MANIFEST_SRC, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch photos.json (${response.status})`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.images) ? payload.images : [];
}

async function loadAvailableImages() {
  try {
    const fromFolder = await listImagesFromFolder();
    if (fromFolder.length > 0) {
      return fromFolder;
    }
  } catch {
    // Fall back to photos.json when directory listing is not available.
  }

  try {
    const fromManifest = await listImagesFromManifest();
    if (fromManifest.length > 0) {
      return fromManifest;
    }
  } catch {
    // Fall back to a default image when manifest is not available.
  }

  return [DEFAULT_IMAGE_SRC];
}

function decodeSizeForRow(record) {
  const sourceWidth = Number(record?.width) || 3;
  const sourceHeight = Number(record?.height) || 2;
  const ratio = sourceWidth / sourceHeight;
  const height = 36;
  const width = Math.max(1, Math.round(height * ratio));
  return { width, height };
}

function createRowViewport() {
  const viewport = document.createElement("div");
  viewport.className = "table-viewport";
  return viewport;
}

function createMissingViewport(label) {
  const viewport = createRowViewport();
  viewport.classList.add("table-viewport--empty");
  viewport.textContent = label;
  return viewport;
}

function createImageRows(records, imageSrcs, selectedSrc, onSelect) {
  allImagesRowsBody.innerHTML = "";

  if (!Array.isArray(imageSrcs) || imageSrcs.length === 0) {
    allImagesStatus.textContent = "No images found in ./images.";
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 11;
    emptyCell.className = "table-empty";
    emptyCell.textContent = "No rows available.";
    emptyRow.appendChild(emptyCell);
    allImagesRowsBody.appendChild(emptyRow);
    return;
  }

  const bySrc = new Map(
    records.map((record) => [normalizeSrc(record?.src || ""), record])
  );
  allImagesStatus.textContent = `Showing ${imageSrcs.length} image row(s).`;

  imageSrcs.forEach((src) => {
    const row = document.createElement("tr");
    const normalizedSrc = normalizeSrc(src);
    const record = bySrc.get(normalizedSrc);
    if (normalizedSrc === normalizeSrc(selectedSrc || "")) {
      row.classList.add("is-selected");
    }
    row.addEventListener("click", () => {
      if (typeof onSelect === "function") {
        onSelect(src);
      }
    });

    const imageCell = document.createElement("td");
    imageCell.className = "meta-cell";
    const title = document.createElement("strong");
    title.textContent = normalizedSrc.split("/").pop() || normalizedSrc;
    const path = document.createElement("span");
    path.textContent = normalizedSrc;
    imageCell.appendChild(title);
    imageCell.appendChild(path);

    const originalCell = document.createElement("td");
    const originalViewport = createRowViewport();
    const originalImage = new Image();
    originalImage.loading = "lazy";
    originalImage.src = src;
    originalImage.alt = `${normalizedSrc} original`;
    originalViewport.appendChild(originalImage);
    originalCell.appendChild(originalViewport);

    const blurhashCell = document.createElement("td");
    if (record?.blurhash) {
      const size = decodeSizeForRow(record);
      const rgba = decodeBlurHash(record.blurhash, size.width, size.height);
      const canvas = makeCanvasFromRGBA(rgba, size.width, size.height);
      const viewport = createRowViewport();
      viewport.appendChild(canvas);
      blurhashCell.appendChild(viewport);
    } else {
      blurhashCell.appendChild(createMissingViewport("No blurhash"));
    }

    const thumbhashCell = document.createElement("td");
    if (record?.thumbhashBase64) {
      const thumbBytes = base64ToBytes(record.thumbhashBase64);
      const decoded = thumbHashToRGBA(thumbBytes);
      const canvas = makeCanvasFromRGBA(decoded.rgba, decoded.w, decoded.h);
      const viewport = createRowViewport();
      viewport.appendChild(canvas);
      thumbhashCell.appendChild(viewport);
    } else {
      thumbhashCell.appendChild(createMissingViewport("No thumbhash"));
    }

    const lqipCell = document.createElement("td");
    if (record?.lqip?.dataUrl) {
      const viewport = createRowViewport();
      const image = new Image();
      image.loading = "lazy";
      image.className = "lqip-preview";
      image.src = record.lqip.dataUrl;
      image.alt = `${normalizedSrc} lqip`;
      viewport.appendChild(image);
      lqipCell.appendChild(viewport);
    } else {
      lqipCell.appendChild(createMissingViewport("No lqip"));
    }

    const avifCell = document.createElement("td");
    if (record?.avif?.dataUrl) {
      const viewport = createRowViewport();
      const image = new Image();
      image.loading = "lazy";
      image.className = "lqip-preview";
      image.src = record.avif.dataUrl;
      image.alt = `${normalizedSrc} avif`;
      viewport.appendChild(image);
      avifCell.appendChild(viewport);
    } else {
      avifCell.appendChild(createMissingViewport("No avif"));
    }

    const colorCell = document.createElement("td");
    if (record?.color?.hex) {
      const colorViewport = createRowViewport();
      const swatch = document.createElement("div");
      swatch.className = "color-preview";
      swatch.style.backgroundColor = record.color.hex;
      colorViewport.appendChild(swatch);
      colorCell.appendChild(colorViewport);
    } else {
      colorCell.appendChild(createMissingViewport("No color"));
    }

    const shimmerCell = document.createElement("td");
    if (record?.shimmer?.dataUrl) {
      const shimmerViewport = createRowViewport();
      const shimmerImage = new Image();
      shimmerImage.loading = "lazy";
      shimmerImage.className = "shimmer-preview";
      shimmerImage.src = record.shimmer.dataUrl;
      shimmerImage.alt = `${normalizedSrc} shimmer`;
      shimmerViewport.appendChild(shimmerImage);
      shimmerCell.appendChild(shimmerViewport);
    } else {
      shimmerCell.appendChild(createMissingViewport("No shimmer"));
    }

    const firstPaintCell = createBenchCell();
    const blockCell = createBenchCell();
    const similarityCell = createBenchCell();

    row.appendChild(imageCell);
    row.appendChild(originalCell);
    row.appendChild(blurhashCell);
    row.appendChild(thumbhashCell);
    row.appendChild(lqipCell);
    row.appendChild(avifCell);
    row.appendChild(colorCell);
    row.appendChild(shimmerCell);
    row.appendChild(firstPaintCell);
    row.appendChild(blockCell);
    row.appendChild(similarityCell);

    allImagesRowsBody.appendChild(row);

    hydrateRowBenchmarks(src, row, firstPaintCell, blockCell, similarityCell)
      .catch(() => {
        if (!row.isConnected) {
          return;
        }
        firstPaintCell.textContent = "failed";
        blockCell.textContent = "failed";
        similarityCell.textContent = "failed";
      });
  });
}

async function loadManifestRecord(imageSrc) {
  const images = state.manifestImages.length > 0 ? state.manifestImages : await loadManifestImages();

  if (images.length === 0) {
    throw new Error("photos.json has no images[] records");
  }

  const target = normalizeSrc(imageSrc);
  const matched = images.find((item) => normalizeSrc(item.src || "") === target) || images[0];

  return matched;
}

async function prepareComparisonForImage(imageSrc) {
  const token = ++state.switchToken;
  state.currentImageSrc = imageSrc;

  state.sourceImage = await loadImageElement(state.currentImageSrc);
  if (token !== state.switchToken) {
    return;
  }

  state.aspectRatio = state.sourceImage.naturalWidth / state.sourceImage.naturalHeight;
  setViewportAspect(state.aspectRatio);

  try {
    state.imageRecord = await loadManifestRecord(state.currentImageSrc);
  } catch (error) {
    console.warn("photos.json load failed", error);
    state.imageRecord = null;
  }

  if (state.imageRecord?.blurhash) {
    state.blurhashString = state.imageRecord.blurhash;
  } else {
    state.blurhashString = null;
  }

  if (state.imageRecord?.thumbhashBase64) {
    state.thumbHashBytes = base64ToBytes(state.imageRecord.thumbhashBase64);
  } else {
    state.thumbHashBytes = null;
  }

  if (state.imageRecord?.lqip?.dataUrl) {
    state.lqipDataUrl = state.imageRecord.lqip.dataUrl;
  } else {
    state.lqipDataUrl = null;
  }

  if (state.imageRecord?.avif?.dataUrl) {
    state.avifDataUrl = state.imageRecord.avif.dataUrl;
    state.avifMimeType = state.imageRecord.avif.mimeType || "image/avif";
  } else {
    state.avifDataUrl = null;
    state.avifMimeType = "image/avif";
  }

  if (state.imageRecord?.color?.hex) {
    state.colorHex = state.imageRecord.color.hex;
  } else {
    state.colorHex = null;
  }

  if (state.imageRecord?.shimmer?.dataUrl) {
    state.shimmerDataUrl = state.imageRecord.shimmer.dataUrl;
  } else {
    state.shimmerDataUrl = null;
  }

  if (state.blurhashString) {
    blurhashPayload.textContent = `${state.blurhashString.length} chars`;
  } else {
    blurhashPayload.textContent = "No blurhash in manifest";
  }

  if (state.imageRecord?.bytes?.thumbhashBytes && state.imageRecord?.bytes?.thumbhashBase64Chars) {
    thumbhashPayload.textContent = `${state.imageRecord.bytes.thumbhashBytes} bytes / ${state.imageRecord.bytes.thumbhashBase64Chars} b64 chars`;
  } else if (state.thumbHashBytes) {
    const thumbBase64 = btoa(String.fromCharCode(...state.thumbHashBytes)).replace(/=+$/, "");
    thumbhashPayload.textContent = `${state.thumbHashBytes.length} bytes / ${thumbBase64.length} b64 chars`;
  } else {
    thumbhashPayload.textContent = "No thumbhash in manifest";
  }

  if (state.imageRecord?.bytes?.lqipBytes && state.imageRecord?.bytes?.lqipDataUrlChars) {
    lqipPayload.textContent = `${state.imageRecord.bytes.lqipBytes} bytes / ${state.imageRecord.bytes.lqipDataUrlChars} data-url chars`;
  } else if (state.lqipDataUrl) {
    lqipPayload.textContent = `${state.lqipDataUrl.length} data-url chars`;
  } else {
    lqipPayload.textContent = "No lqip in manifest";
  }

  if (state.imageRecord?.bytes?.avifBytes && state.imageRecord?.bytes?.avifDataUrlChars) {
    avifPayload.textContent = `${state.imageRecord.bytes.avifBytes} bytes / ${state.imageRecord.bytes.avifDataUrlChars} data-url chars`;
  } else {
    avifPayload.textContent = "No avif in manifest";
  }

  if (state.imageRecord?.bytes?.colorHexChars && state.imageRecord?.color?.hex) {
    colorPayload.textContent = `${state.imageRecord.bytes.colorHexChars} chars (${state.imageRecord.color.hex})`;
  } else if (state.colorHex) {
    colorPayload.textContent = `${state.colorHex.length} chars (${state.colorHex})`;
  } else {
    colorPayload.textContent = "No color in manifest";
  }

  if (state.imageRecord?.bytes?.shimmerBytes && state.imageRecord?.bytes?.shimmerDataUrlChars) {
    shimmerPayload.textContent = `${state.imageRecord.bytes.shimmerBytes} bytes / ${state.imageRecord.bytes.shimmerDataUrlChars} data-url chars`;
  } else if (state.shimmerDataUrl) {
    shimmerPayload.textContent = `${state.shimmerDataUrl.length} data-url chars`;
  } else {
    shimmerPayload.textContent = "No shimmer in manifest";
  }
}

async function onSelectImageRow(imageSrc) {
  replayButton.disabled = true;
  allImagesStatus.textContent = `Loading ${normalizeSrc(imageSrc)}...`;

  try {
    await prepareComparisonForImage(imageSrc);
    createImageRows(state.manifestImages, state.availableImageSrcs, state.currentImageSrc, onSelectImageRow);
    await runComparison();
    allImagesStatus.textContent = `Showing ${state.availableImageSrcs.length} image row(s). Selected ${normalizeSrc(state.currentImageSrc)}.`;
  } catch (error) {
    allImagesStatus.textContent = `Failed to load ${normalizeSrc(imageSrc)}.`;
    console.error(error);
  } finally {
    replayButton.disabled = false;
  }
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function formatMsShort(value) {
  return `${value.toFixed(1)} ms`;
}

function estimateBlockingMs(durationMs) {
  return Math.max(0, durationMs - 16.7);
}

function imageDataFromSourceAtSize(sourceImage, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(sourceImage, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

function imageDataFromCanvas(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

function imageDataFromImage(image, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

function similarityPercent(sourceRgba, candidateRgba) {
  const length = Math.min(sourceRgba.length, candidateRgba.length);
  if (length === 0) {
    return 0;
  }

  let diffTotal = 0;
  let channelCount = 0;

  for (let i = 0; i < length; i += 4) {
    diffTotal += Math.abs(sourceRgba[i] - candidateRgba[i]);
    diffTotal += Math.abs(sourceRgba[i + 1] - candidateRgba[i + 1]);
    diffTotal += Math.abs(sourceRgba[i + 2] - candidateRgba[i + 2]);
    channelCount += 3;
  }

  const meanAbsDiff = diffTotal / channelCount;
  const similarity = 100 * (1 - meanAbsDiff / 255);
  return Math.max(0, Math.min(100, similarity));
}

async function getSourceImageForSrc(src) {
  if (state.sourceImageBySrc.has(src)) {
    return state.sourceImageBySrc.get(src);
  }

  const image = await loadImageElement(src);
  state.sourceImageBySrc.set(src, image);
  return image;
}

function getManifestRecordForSrc(src) {
  const target = normalizeSrc(src);
  return state.manifestImages.find((item) => normalizeSrc(item?.src || "") === target) || null;
}

async function decodeImageDataUrl(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  try {
    await image.decode();
  } catch {
    return null;
  }

  return image;
}

function createBenchCell() {
  const cell = document.createElement("td");
  cell.className = "payload-cell bench-cell";
  cell.textContent = "calculating...";
  return cell;
}

function formatBenchLines(values, formatter) {
  const fmt = (value) => (typeof value === "number" ? formatter(value) : "n/a");
  return [
    `BH ${fmt(values.blurhash)}`,
    `TH ${fmt(values.thumbhash)}`,
    `LQ ${fmt(values.lqip)}`,
    `AV ${fmt(values.avif)}`,
    `CL ${fmt(values.color)}`,
    `SH ${fmt(values.shimmer)}`,
  ].join("\n");
}

async function computeRowBenchmarks(src, record) {
  const sourceImage = await getSourceImageForSrc(src);
  const ratio = sourceImage.naturalWidth / sourceImage.naturalHeight;
  const size = decodeHeightToSize(36, ratio);

  const result = {
    firstPaint: {
      blurhash: null,
      thumbhash: null,
      lqip: null,
      avif: null,
      color: null,
      shimmer: null,
    },
    block: {
      blurhash: null,
      thumbhash: null,
      lqip: null,
      avif: null,
      color: null,
      shimmer: null,
    },
    similarity: {
      blurhash: null,
      thumbhash: null,
      lqip: null,
      avif: null,
      color: null,
      shimmer: null,
    },
  };

  if (record?.blurhash) {
    const t0 = performance.now();
    const canvas = makeBlurhashCanvas(record.blurhash, size.width, size.height);
    const t1 = performance.now();
    const duration = t1 - t0;
    result.firstPaint.blurhash = duration;
    result.block.blurhash = estimateBlockingMs(duration);
    const sourcePixels = imageDataFromSourceAtSize(sourceImage, canvas.width, canvas.height);
    const candidatePixels = imageDataFromCanvas(canvas);
    result.similarity.blurhash = similarityPercent(sourcePixels, candidatePixels);
  }

  if (record?.thumbhashBase64) {
    const t0 = performance.now();
    const decoded = thumbHashToRGBA(base64ToBytes(record.thumbhashBase64));
    const canvas = makeCanvasFromRGBA(decoded.rgba, decoded.w, decoded.h);
    const t1 = performance.now();
    const duration = t1 - t0;
    result.firstPaint.thumbhash = duration;
    result.block.thumbhash = estimateBlockingMs(duration);
    const sourcePixels = imageDataFromSourceAtSize(sourceImage, canvas.width, canvas.height);
    const candidatePixels = imageDataFromCanvas(canvas);
    result.similarity.thumbhash = similarityPercent(sourcePixels, candidatePixels);
  }

  if (record?.lqip?.dataUrl) {
    const t0 = performance.now();
    const image = await decodeImageDataUrl(record.lqip.dataUrl);
    const t1 = performance.now();
    const duration = t1 - t0;
    result.firstPaint.lqip = duration;
    result.block.lqip = estimateBlockingMs(duration);
    if (image) {
      const sourcePixels = imageDataFromSourceAtSize(sourceImage, image.naturalWidth, image.naturalHeight);
      const candidatePixels = imageDataFromImage(image, image.naturalWidth, image.naturalHeight);
      result.similarity.lqip = similarityPercent(sourcePixels, candidatePixels);
    }
  }

  if (record?.avif?.dataUrl) {
    const avifDataUrl = record.avif.dataUrl;
    const t0 = performance.now();
    const image = await decodeImageDataUrl(avifDataUrl);
    const t1 = performance.now();
    const duration = t1 - t0;
    result.firstPaint.avif = duration;
    result.block.avif = estimateBlockingMs(duration);
    if (image) {
      const sourcePixels = imageDataFromSourceAtSize(sourceImage, image.naturalWidth, image.naturalHeight);
      const candidatePixels = imageDataFromImage(image, image.naturalWidth, image.naturalHeight);
      result.similarity.avif = similarityPercent(sourcePixels, candidatePixels);
    }
  }

  if (record?.color?.hex) {
    const t0 = performance.now();
    const colorHex = record.color.hex;
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    context.fillStyle = colorHex;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const t1 = performance.now();
    const duration = t1 - t0;
    result.firstPaint.color = duration;
    result.block.color = estimateBlockingMs(duration);
    const sourcePixels = imageDataFromSourceAtSize(sourceImage, canvas.width, canvas.height);
    const candidatePixels = imageDataFromCanvas(canvas);
    result.similarity.color = similarityPercent(sourcePixels, candidatePixels);
  }

  if (record?.shimmer?.dataUrl) {
    const shimmerDataUrl = record.shimmer.dataUrl;
    const t0 = performance.now();
    const image = await decodeImageDataUrl(shimmerDataUrl);
    const t1 = performance.now();
    const duration = t1 - t0;
    result.firstPaint.shimmer = duration;
    result.block.shimmer = estimateBlockingMs(duration);
    if (image) {
      const sourcePixels = imageDataFromSourceAtSize(sourceImage, image.naturalWidth, image.naturalHeight);
      const candidatePixels = imageDataFromImage(image, image.naturalWidth, image.naturalHeight);
      result.similarity.shimmer = similarityPercent(sourcePixels, candidatePixels);
    }
  }

  return result;
}

async function hydrateRowBenchmarks(src, row, firstPaintCell, blockCell, similarityCell) {
  let benchmarks = state.rowBenchmarksBySrc.get(src);
  if (!benchmarks) {
    const record = getManifestRecordForSrc(src);
    benchmarks = await computeRowBenchmarks(src, record);
    state.rowBenchmarksBySrc.set(src, benchmarks);
  }

  if (!row.isConnected) {
    return;
  }

  firstPaintCell.textContent = formatBenchLines(benchmarks.firstPaint, formatMsShort);
  blockCell.textContent = formatBenchLines(benchmarks.block, formatMsShort);
  similarityCell.textContent = formatBenchLines(benchmarks.similarity, formatPercent);
}

function showStatus(el, message) {
  el.textContent = message;
}

async function runComparison() {
  replayButton.disabled = true;

  const start = performance.now();
  const swapDelayMs = Number(delayInput.value);
  const decodeHeight = Number(decodeHeightSelect.value);
  const decodeSize = decodeHeightToSize(decodeHeight, state.aspectRatio);

  clearViewport(blurhashViewport);
  clearViewport(thumbhashViewport);
  clearViewport(lqipViewport);
  clearViewport(avifViewport);
  clearViewport(colorViewport);
  clearViewport(shimmerViewport);

  showStatus(blurhashStatus, "decoding placeholder...");
  showStatus(thumbhashStatus, "decoding placeholder...");
  showStatus(lqipStatus, "decoding placeholder...");
  showStatus(avifStatus, "decoding placeholder...");
  showStatus(colorStatus, "decoding placeholder...");
  showStatus(shimmerStatus, "decoding placeholder...");

  let blurCanvas = null;
  if (state.blurhashString) {
    const blurDecodeStart = performance.now();
    blurCanvas = makeBlurhashCanvas(
      state.blurhashString,
      decodeSize.width,
      decodeSize.height
    );
    const blurDecodeEnd = performance.now();
    blurhashViewport.appendChild(blurCanvas);
    const blurDecodeDuration = blurDecodeEnd - blurDecodeStart;
    blurhashDecodeMs.textContent = formatMs(blurDecodeDuration);
    blurhashFirstPaintMs.textContent = formatMs(performance.now() - start);
    blurhashBlockMs.textContent = formatMs(estimateBlockingMs(blurDecodeDuration));
    {
      const sourcePixels = imageDataFromSourceAtSize(state.sourceImage, blurCanvas.width, blurCanvas.height);
      const candidatePixels = imageDataFromCanvas(blurCanvas);
      blurhashSimilarity.textContent = formatPercent(similarityPercent(sourcePixels, candidatePixels));
    }
    showStatus(blurhashStatus, "placeholder shown");
  } else {
    blurhashViewport.appendChild(createMissingViewport("No blurhash"));
    blurhashDecodeMs.textContent = "-";
    blurhashFirstPaintMs.textContent = "-";
    blurhashBlockMs.textContent = "-";
    blurhashSimilarity.textContent = "-";
    blurhashShownMs.textContent = "-";
    showStatus(blurhashStatus, "missing");
  }

  let thumbCanvas = null;
  if (state.thumbHashBytes) {
    const thumbDecodeStart = performance.now();
    thumbCanvas = makeThumbhashCanvas(state.thumbHashBytes);
    const thumbDecodeEnd = performance.now();
    thumbhashViewport.appendChild(thumbCanvas);
    const thumbDecodeDuration = thumbDecodeEnd - thumbDecodeStart;
    thumbhashDecodeMs.textContent = formatMs(thumbDecodeDuration);
    thumbhashFirstPaintMs.textContent = formatMs(performance.now() - start);
    thumbhashBlockMs.textContent = formatMs(estimateBlockingMs(thumbDecodeDuration));
    {
      const sourcePixels = imageDataFromSourceAtSize(state.sourceImage, thumbCanvas.width, thumbCanvas.height);
      const candidatePixels = imageDataFromCanvas(thumbCanvas);
      thumbhashSimilarity.textContent = formatPercent(similarityPercent(sourcePixels, candidatePixels));
    }
    showStatus(thumbhashStatus, "placeholder shown");
  } else {
    thumbhashViewport.appendChild(createMissingViewport("No thumbhash"));
    thumbhashDecodeMs.textContent = "-";
    thumbhashFirstPaintMs.textContent = "-";
    thumbhashBlockMs.textContent = "-";
    thumbhashSimilarity.textContent = "-";
    thumbhashShownMs.textContent = "-";
    showStatus(thumbhashStatus, "missing");
  }

  let lqipPreview = null;
  if (state.lqipDataUrl) {
    const lqipDecodeStart = performance.now();
    lqipPreview = new Image();
    lqipPreview.className = "lqip-preview";
    lqipPreview.src = state.lqipDataUrl;
    try {
      await lqipPreview.decode();
    } catch {
      lqipPreview = null;
    }

    if (lqipPreview) {
      const lqipDecodeEnd = performance.now();
      lqipViewport.appendChild(lqipPreview);
      const lqipDecodeDuration = lqipDecodeEnd - lqipDecodeStart;
      lqipDecodeMs.textContent = formatMs(lqipDecodeDuration);
      lqipFirstPaintMs.textContent = formatMs(performance.now() - start);
      lqipBlockMs.textContent = formatMs(estimateBlockingMs(lqipDecodeDuration));
      {
        const lqipWidth = Math.max(1, lqipPreview.naturalWidth || decodeSize.width);
        const lqipHeight = Math.max(1, lqipPreview.naturalHeight || decodeSize.height);
        const sourcePixels = imageDataFromSourceAtSize(state.sourceImage, lqipWidth, lqipHeight);
        const candidatePixels = imageDataFromImage(lqipPreview, lqipWidth, lqipHeight);
        lqipSimilarity.textContent = formatPercent(similarityPercent(sourcePixels, candidatePixels));
      }
      showStatus(lqipStatus, "placeholder shown");
    }
  }

  if (!lqipPreview) {
    lqipViewport.appendChild(createMissingViewport("No lqip"));
    lqipDecodeMs.textContent = "-";
    lqipFirstPaintMs.textContent = "-";
    lqipBlockMs.textContent = "-";
    lqipSimilarity.textContent = "-";
    lqipShownMs.textContent = "-";
    showStatus(lqipStatus, state.lqipDataUrl ? "unsupported" : "missing");
  }

  let avifPreview = null;
  if (state.avifDataUrl) {
    const avifDecodeStart = performance.now();
    avifPreview = new Image();
    avifPreview.className = "lqip-preview";
    avifPreview.src = state.avifDataUrl;
    try {
      await avifPreview.decode();
    } catch {
      avifPayload.textContent = "AVIF not supported by this browser";
      avifDecodeMs.textContent = "-";
      avifFirstPaintMs.textContent = "-";
      avifBlockMs.textContent = "-";
      avifSimilarity.textContent = "-";
      avifShownMs.textContent = "-";
      avifViewport.appendChild(createMissingViewport("No avif"));
      showStatus(avifStatus, "unsupported");
      avifPreview = null;
    }

    if (avifPreview) {
      const avifDecodeEnd = performance.now();
      avifViewport.appendChild(avifPreview);
      avifPayload.textContent = `${state.avifDataUrl.length} data-url chars (${state.avifMimeType})`;
      const avifDecodeDuration = avifDecodeEnd - avifDecodeStart;
      avifDecodeMs.textContent = formatMs(avifDecodeDuration);
      avifFirstPaintMs.textContent = formatMs(performance.now() - start);
      avifBlockMs.textContent = formatMs(estimateBlockingMs(avifDecodeDuration));
      {
        const avifWidth = Math.max(1, avifPreview.naturalWidth || decodeSize.width);
        const avifHeight = Math.max(1, avifPreview.naturalHeight || decodeSize.height);
        const sourcePixels = imageDataFromSourceAtSize(state.sourceImage, avifWidth, avifHeight);
        const candidatePixels = imageDataFromImage(avifPreview, avifWidth, avifHeight);
        avifSimilarity.textContent = formatPercent(similarityPercent(sourcePixels, candidatePixels));
      }
      showStatus(avifStatus, "placeholder shown");
    }
  } else {
    avifPayload.textContent = "No avif in manifest";
    avifDecodeMs.textContent = "-";
    avifFirstPaintMs.textContent = "-";
    avifBlockMs.textContent = "-";
    avifSimilarity.textContent = "-";
    avifShownMs.textContent = "-";
    avifViewport.appendChild(createMissingViewport("No avif"));
    showStatus(avifStatus, "missing");
  }

  let colorPreview = null;
  if (state.colorHex) {
    const colorDecodeStart = performance.now();
    colorPreview = makeColorPlaceholderNode(state.colorHex);
    const colorDecodeEnd = performance.now();
    colorViewport.appendChild(colorPreview);
    const colorDecodeDuration = colorDecodeEnd - colorDecodeStart;
    colorDecodeMs.textContent = formatMs(colorDecodeDuration);
    colorFirstPaintMs.textContent = formatMs(performance.now() - start);
    colorBlockMs.textContent = formatMs(estimateBlockingMs(colorDecodeDuration));
    {
      const sourcePixels = imageDataFromSourceAtSize(state.sourceImage, decodeSize.width, decodeSize.height);
      const colorCanvas = document.createElement("canvas");
      colorCanvas.width = decodeSize.width;
      colorCanvas.height = decodeSize.height;
      const colorContext = colorCanvas.getContext("2d");
      colorContext.fillStyle = state.colorHex;
      colorContext.fillRect(0, 0, colorCanvas.width, colorCanvas.height);
      const candidatePixels = imageDataFromCanvas(colorCanvas);
      colorSimilarity.textContent = formatPercent(similarityPercent(sourcePixels, candidatePixels));
    }
    showStatus(colorStatus, "placeholder shown");
  } else {
    colorViewport.appendChild(createMissingViewport("No color"));
    colorDecodeMs.textContent = "-";
    colorFirstPaintMs.textContent = "-";
    colorBlockMs.textContent = "-";
    colorSimilarity.textContent = "-";
    colorShownMs.textContent = "-";
    showStatus(colorStatus, "missing");
  }

  let shimmerPreview = null;
  if (state.shimmerDataUrl) {
    const shimmerDecodeStart = performance.now();
    shimmerPreview = makeShimmerImageNode(state.shimmerDataUrl);
    try {
      await shimmerPreview.decode();
    } catch {
      shimmerPreview = null;
    }

    if (shimmerPreview) {
      const shimmerDecodeEnd = performance.now();
      shimmerViewport.appendChild(shimmerPreview);
      const shimmerDecodeDuration = shimmerDecodeEnd - shimmerDecodeStart;
      shimmerDecodeMs.textContent = formatMs(shimmerDecodeDuration);
      shimmerFirstPaintMs.textContent = formatMs(performance.now() - start);
      shimmerBlockMs.textContent = formatMs(estimateBlockingMs(shimmerDecodeDuration));
      {
        const shimmerWidth = Math.max(1, shimmerPreview.naturalWidth || decodeSize.width);
        const shimmerHeight = Math.max(1, shimmerPreview.naturalHeight || decodeSize.height);
        const sourcePixels = imageDataFromSourceAtSize(state.sourceImage, shimmerWidth, shimmerHeight);
        const candidatePixels = imageDataFromImage(shimmerPreview, shimmerWidth, shimmerHeight);
        shimmerSimilarity.textContent = formatPercent(similarityPercent(sourcePixels, candidatePixels));
      }
      showStatus(shimmerStatus, "placeholder shown");
    }
  }

  if (!shimmerPreview) {
    shimmerViewport.appendChild(createMissingViewport("No shimmer"));
    shimmerDecodeMs.textContent = "-";
    shimmerFirstPaintMs.textContent = "-";
    shimmerBlockMs.textContent = "-";
    shimmerSimilarity.textContent = "-";
    shimmerShownMs.textContent = "-";
    showStatus(shimmerStatus, state.shimmerDataUrl ? "unsupported" : "missing");
  }

  const blurLoaded = blurCanvas
    ? new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        setTimeout(() => {
          revealFullImage(blurCanvas, image, start, blurhashStatus, blurhashShownMs);
          resolve();
        }, swapDelayMs);
      };
      image.onerror = () => reject(new Error("BlurHash image load failed"));
      image.src = state.currentImageSrc;
    })
    : Promise.resolve();

  const thumbLoaded = thumbCanvas
    ? new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        setTimeout(() => {
          revealFullImage(thumbCanvas, image, start, thumbhashStatus, thumbhashShownMs);
          resolve();
        }, swapDelayMs);
      };
      image.onerror = () => reject(new Error("ThumbHash image load failed"));
      image.src = state.currentImageSrc;
    })
    : Promise.resolve();

  const lqipLoaded = lqipPreview
    ? new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        setTimeout(() => {
          revealFullImage(lqipPreview, image, start, lqipStatus, lqipShownMs);
          resolve();
        }, swapDelayMs);
      };
      image.onerror = () => reject(new Error("LQIP image load failed"));
      image.src = state.currentImageSrc;
    })
    : Promise.resolve();

  const avifLoaded = avifPreview
    ? new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        setTimeout(() => {
          revealFullImage(avifPreview, image, start, avifStatus, avifShownMs);
          resolve();
        }, swapDelayMs);
      };
      image.onerror = () => reject(new Error("AVIF image load failed"));
      image.src = state.currentImageSrc;
    })
    : Promise.resolve();

  const colorLoaded = colorPreview
    ? new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        setTimeout(() => {
          revealFullImage(colorPreview, image, start, colorStatus, colorShownMs);
          resolve();
        }, swapDelayMs);
      };
      image.onerror = () => reject(new Error("Color placeholder image load failed"));
      image.src = state.currentImageSrc;
    })
    : Promise.resolve();

  const shimmerLoaded = shimmerPreview
    ? new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        setTimeout(() => {
          revealFullImage(shimmerPreview, image, start, shimmerStatus, shimmerShownMs);
          resolve();
        }, swapDelayMs);
      };
      image.onerror = () => reject(new Error("Shimmer placeholder image load failed"));
      image.src = state.currentImageSrc;
    })
    : Promise.resolve();

  try {
    await Promise.all([blurLoaded, thumbLoaded, lqipLoaded, avifLoaded, colorLoaded, shimmerLoaded]);
  } finally {
    replayButton.disabled = false;
  }
}

async function init() {
  updateDelayLabel();
  state.prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  state.availableImageSrcs = await loadAvailableImages();
  let manifestImages = [];
  try {
    manifestImages = await loadManifestImages();
  } catch {
    manifestImages = [];
  }
  state.manifestImages = manifestImages;
  state.currentImageSrc = state.availableImageSrcs[0] || DEFAULT_IMAGE_SRC;
  await prepareComparisonForImage(state.currentImageSrc);
  createImageRows(state.manifestImages, state.availableImageSrcs, state.currentImageSrc, onSelectImageRow);

  delayInput.addEventListener("input", () => {
    updateDelayLabel();
  });

  decodeHeightSelect.addEventListener("change", () => {
    runComparison();
  });

  replayButton.addEventListener("click", () => {
    runComparison();
  });

  await runComparison();
}

init().catch((error) => {
  showStatus(blurhashStatus, "error");
  showStatus(thumbhashStatus, "error");
  showStatus(lqipStatus, "error");
  showStatus(avifStatus, "error");
  showStatus(colorStatus, "error");
  showStatus(shimmerStatus, "error");
  replayButton.disabled = true;
  console.error(error);
});
