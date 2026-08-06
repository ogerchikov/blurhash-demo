import { decode as decodeBlurHash } from "https://cdn.jsdelivr.net/npm/blurhash/+esm";
import { thumbHashToRGBA } from "https://cdn.jsdelivr.net/npm/thumbhash/+esm";

const PHOTOS_MANIFEST_SRC = "./photos.json";
const tableBody = document.getElementById("previewTableBody");

function normalizeSrc(src) {
  return (src || "").replace(/^\.\//, "");
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image ${src}`));
    image.src = src;
  });
}

function imageToRgba(image, maxDimension = 24) {
  const largest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = largest > maxDimension ? maxDimension / largest : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);

  return context.getImageData(0, 0, width, height).data;
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
    return "#d9e0eb";
  }

  return rgbToHex(
    Math.round(rSum / alphaSum),
    Math.round(gSum / alphaSum),
    Math.round(bSum / alphaSum)
  );
}

function decodeSizeForRecord(record) {
  const sourceWidth = Number(record?.width) || 3;
  const sourceHeight = Number(record?.height) || 2;
  const ratio = sourceWidth / sourceHeight;
  const height = 36;
  const width = Math.max(1, Math.round(height * ratio));
  return { width, height };
}

function createViewportNode() {
  const wrapper = document.createElement("div");
  wrapper.className = "table-viewport";
  return wrapper;
}

function createOriginalNode(record) {
  const viewport = createViewportNode();
  const image = new Image();
  image.loading = "lazy";
  image.src = record.src;
  image.alt = `${record.id || "image"} original`;
  viewport.appendChild(image);
  return viewport;
}

function createBlurHashNode(record) {
  const viewport = createViewportNode();

  if (!record.blurhash) {
    viewport.classList.add("table-viewport--empty");
    viewport.textContent = "No blurhash";
    return viewport;
  }

  const size = decodeSizeForRecord(record);
  const rgba = decodeBlurHash(record.blurhash, size.width, size.height);
  const canvas = makeCanvasFromRGBA(rgba, size.width, size.height);
  viewport.appendChild(canvas);

  return viewport;
}

function createThumbHashNode(record) {
  const viewport = createViewportNode();

  if (!record.thumbhashBase64) {
    viewport.classList.add("table-viewport--empty");
    viewport.textContent = "No thumbhash";
    return viewport;
  }

  const bytes = base64ToBytes(record.thumbhashBase64);
  const decoded = thumbHashToRGBA(bytes);
  const canvas = makeCanvasFromRGBA(decoded.rgba, decoded.w, decoded.h);
  viewport.appendChild(canvas);

  return viewport;
}

function createLqipNode(record) {
  const viewport = createViewportNode();

  if (!record?.lqip?.dataUrl) {
    viewport.classList.add("table-viewport--empty");
    viewport.textContent = "No lqip";
    return viewport;
  }

  const image = new Image();
  image.loading = "lazy";
  image.className = "lqip-preview";
  image.src = record.lqip.dataUrl;
  image.alt = `${record.id || "image"} lqip`;
  viewport.appendChild(image);

  return viewport;
}

function createColorNode(record) {
  const viewport = createViewportNode();
  const colorHex = record?.color?.hex || "#d9e0eb";

  const swatch = document.createElement("div");
  swatch.className = "color-preview";
  swatch.style.backgroundColor = colorHex;
  viewport.appendChild(swatch);

  if (!record?.color?.hex) {
    loadImage(record.src)
      .then((image) => {
        const rgba = imageToRgba(image, 24);
        swatch.style.backgroundColor = computeAverageColor(rgba);
      })
      .catch(() => {
        swatch.style.backgroundColor = "#d9e0eb";
      });
  }

  return viewport;
}

function makeShimmerDataUrl(width, height, baseHex, animate = false) {
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

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

function createShimmerNode(record) {
  const viewport = createViewportNode();
  const image = new Image();
  image.loading = "lazy";
  image.className = "shimmer-preview";

  if (record?.shimmer?.dataUrl) {
    image.src = record.shimmer.dataUrl;
    image.alt = `${record.id || "image"} shimmer`;
    viewport.appendChild(image);
    return viewport;
  }

  const ratio = (Number(record?.width) || 3) / (Number(record?.height) || 2);
  const shimmerHeight = 36;
  const shimmerWidth = Math.max(1, Math.round(shimmerHeight * ratio));
  const baseHex = record?.color?.hex || "#d9e0eb";
  image.src = makeShimmerDataUrl(shimmerWidth, shimmerHeight, baseHex);
  image.alt = `${record.id || "image"} shimmer`;
  viewport.appendChild(image);

  return viewport;
}

function createPayloadText(record) {
  const bytes = record.bytes || {};
  const lines = [];

  if (record.blurhash) {
    lines.push(`BlurHash: ${record.blurhash.length} chars`);
  }

  if (typeof bytes.thumbhashBytes === "number") {
    lines.push(`ThumbHash: ${bytes.thumbhashBytes} bytes`);
  } else if (record.thumbhashBase64) {
    lines.push(`ThumbHash b64: ${record.thumbhashBase64.length} chars`);
  }

  if (typeof bytes.lqipBytes === "number") {
    lines.push(`LQIP: ${bytes.lqipBytes} bytes`);
  } else if (record?.lqip?.dataUrl) {
    lines.push(`LQIP url: ${record.lqip.dataUrl.length} chars`);
  }

  if (typeof bytes.colorHexChars === "number" && record?.color?.hex) {
    lines.push(`Color: ${bytes.colorHexChars} chars (${record.color.hex})`);
  } else if (record?.color?.hex) {
    lines.push(`Color: ${record.color.hex}`);
  }

  if (typeof bytes.shimmerBytes === "number") {
    lines.push(`Shimmer: ${bytes.shimmerBytes} bytes`);
  } else if (record?.shimmer?.dataUrl) {
    lines.push(`Shimmer url: ${record.shimmer.dataUrl.length} chars`);
  }

  if (lines.length === 0) {
    lines.push("No payload data");
  }

  return lines.join("\n");
}

function buildRow(record) {
  const row = document.createElement("tr");

  const imageMetaCell = document.createElement("td");
  imageMetaCell.className = "meta-cell";
  const normalized = normalizeSrc(record.src);
  imageMetaCell.innerHTML = `
    <strong>${record.id || "(no id)"}</strong>
    <span>${normalized || "(no src)"}</span>
    <span>${record.width || "?"} x ${record.height || "?"}</span>
  `;

  const originalCell = document.createElement("td");
  originalCell.appendChild(createOriginalNode(record));

  const blurhashCell = document.createElement("td");
  blurhashCell.appendChild(createBlurHashNode(record));

  const thumbhashCell = document.createElement("td");
  thumbhashCell.appendChild(createThumbHashNode(record));

  const lqipCell = document.createElement("td");
  lqipCell.appendChild(createLqipNode(record));

  const colorCell = document.createElement("td");
  colorCell.appendChild(createColorNode(record));

  const shimmerCell = document.createElement("td");
  shimmerCell.appendChild(createShimmerNode(record));

  const payloadCell = document.createElement("td");
  payloadCell.className = "payload-cell";
  payloadCell.textContent = createPayloadText(record);

  row.appendChild(imageMetaCell);
  row.appendChild(originalCell);
  row.appendChild(blurhashCell);
  row.appendChild(thumbhashCell);
  row.appendChild(lqipCell);
  row.appendChild(colorCell);
  row.appendChild(shimmerCell);
  row.appendChild(payloadCell);

  return row;
}

async function loadManifest() {
  const response = await fetch(PHOTOS_MANIFEST_SRC, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to load photos.json (${response.status})`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.images) ? payload.images : [];
}

function renderEmpty(message) {
  tableBody.innerHTML = "";
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 8;
  cell.className = "table-empty";
  cell.textContent = message;
  row.appendChild(cell);
  tableBody.appendChild(row);
}

async function init() {
  try {
    const records = await loadManifest();

    if (records.length === 0) {
      renderEmpty("photos.json has no images[] records.");
      return;
    }

    tableBody.innerHTML = "";
    records.forEach((record) => {
      tableBody.appendChild(buildRow(record));
    });
  } catch (error) {
    console.error(error);
    renderEmpty("Failed to load comparison data.");
  }
}

init();
