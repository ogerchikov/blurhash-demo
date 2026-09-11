import {
  base64ToBytes,
  makeBlurhashCanvas,
  makeThumbhashCanvas,
} from "./image-hash-utils.js";
import { loadPhotosManifest } from "./manifest.js";

const tableBody = document.getElementById("previewTableBody");

function normalizeSrc(src) {
  return src.replace(/^\.\//, "");
}

function decodeSizeForRecord(record) {
  const ratio = record.width / record.height;
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
  image.alt = `${record.id} original`;
  viewport.appendChild(image);
  return viewport;
}

function createBlurHashNode(record) {
  const viewport = createViewportNode();
  const size = decodeSizeForRecord(record);
  const canvas = makeBlurhashCanvas(record.blurhash, size.width, size.height);
  viewport.appendChild(canvas);
  return viewport;
}

function createThumbHashNode(record) {
  const viewport = createViewportNode();
  const bytes = base64ToBytes(record.thumbhashBase64);
  const canvas = makeThumbhashCanvas(bytes);
  viewport.appendChild(canvas);
  return viewport;
}

function createLqipNode(record) {
  const viewport = createViewportNode();
  const image = new Image();
  image.loading = "lazy";
  image.className = "lqip-preview";
  image.src = record.lqip.dataUrl;
  image.alt = `${record.id} lqip`;
  viewport.appendChild(image);

  return viewport;
}

function createAvifNode(record) {
  const viewport = createViewportNode();
  const image = new Image();
  image.loading = "lazy";
  image.className = "lqip-preview";
  image.src = record.avif.dataUrl;
  image.alt = `${record.id} avif`;
  viewport.appendChild(image);

  return viewport;
}

function createColorNode(record) {
  const viewport = createViewportNode();
  const swatch = document.createElement("div");
  swatch.className = "color-preview";
  swatch.style.backgroundColor = record.color.hex;
  viewport.appendChild(swatch);
  return viewport;
}

function createShimmerNode(record) {
  const viewport = createViewportNode();
  const image = new Image();
  image.loading = "lazy";
  image.className = "shimmer-preview";
  image.src = record.shimmer.dataUrl;
  image.alt = `${record.id} shimmer`;
  viewport.appendChild(image);
  return viewport;
}

function createPayloadText(record) {
  const { bytes } = record;
  return [
    `BlurHash: ${record.blurhash.length} chars`,
    `ThumbHash: ${bytes.thumbhashBytes} bytes`,
    `LQIP: ${bytes.lqipBytes} bytes`,
    `AVIF: ${bytes.avifBytes} bytes`,
    `Color: ${bytes.colorHexChars} chars (${record.color.hex})`,
    `Shimmer: ${bytes.shimmerBytes} bytes`,
  ].join("\n");
}

function buildRow(record) {
  const row = document.createElement("tr");

  const imageMetaCell = document.createElement("td");
  imageMetaCell.className = "meta-cell";
  const normalized = normalizeSrc(record.src);
  imageMetaCell.innerHTML = `
    <strong>${record.id}</strong>
    <span>${normalized}</span>
    <span>${record.width} x ${record.height}</span>
  `;

  const originalCell = document.createElement("td");
  originalCell.appendChild(createOriginalNode(record));

  const blurhashCell = document.createElement("td");
  blurhashCell.appendChild(createBlurHashNode(record));

  const thumbhashCell = document.createElement("td");
  thumbhashCell.appendChild(createThumbHashNode(record));

  const lqipCell = document.createElement("td");
  lqipCell.appendChild(createLqipNode(record));

  const avifCell = document.createElement("td");
  avifCell.appendChild(createAvifNode(record));

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
  row.appendChild(avifCell);
  row.appendChild(colorCell);
  row.appendChild(shimmerCell);
  row.appendChild(payloadCell);

  return row;
}

function renderEmpty(message) {
  tableBody.innerHTML = "";
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 9;
  cell.className = "table-empty";
  cell.textContent = message;
  row.appendChild(cell);
  tableBody.appendChild(row);
}

async function init() {
  try {
    const { images: records } = await loadPhotosManifest();

    tableBody.innerHTML = "";
    records.forEach((record) => {
      tableBody.appendChild(buildRow(record));
    });
  } catch (error) {
    console.error(error);
    renderEmpty(error.message);
  }
}

init();
