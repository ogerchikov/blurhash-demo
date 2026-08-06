import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { encode as encodeBlurhash } from "blurhash";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const imagesDir = path.join(rootDir, "images");
const photosJsonPath = path.join(rootDir, "photos.json");

const SUPPORTED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
]);

const LQIP_MAX_DIMENSION = 32;
const LQIP_JPEG_QUALITY = 45;

function isSupportedImage(fileName) {
  return SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function computeBlurhashComponents(width, height) {
  const xComponents = width >= height ? 4 : 3;
  const yComponents = height >= width ? 4 : 3;
  return { xComponents, yComponents };
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

async function computePlaceholdersForImage(fileName) {
  const filePath = path.join(imagesDir, fileName);
  const image = sharp(filePath).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const { xComponents, yComponents } = computeBlurhashComponents(info.width, info.height);

  const blurhash = encodeBlurhash(rgba, info.width, info.height, xComponents, yComponents);
  const thumbhashBytes = rgbaToThumbHash(info.width, info.height, data);
  const thumbhashBase64 = Buffer.from(thumbhashBytes).toString("base64");

  const lqip = await sharp(filePath)
    .resize({ width: LQIP_MAX_DIMENSION, height: LQIP_MAX_DIMENSION, fit: "inside" })
    .jpeg({ quality: LQIP_JPEG_QUALITY })
    .toBuffer({ resolveWithObject: true });
  const lqipBase64 = lqip.data.toString("base64");
  const lqipDataUrl = `data:image/jpeg;base64,${lqipBase64}`;

  const colorSample = await sharp(filePath)
    .ensureAlpha()
    .resize({ width: 1, height: 1, fit: "fill" })
    .raw()
    .toBuffer();
  const colorR = colorSample[0];
  const colorG = colorSample[1];
  const colorB = colorSample[2];
  const colorHex = rgbToHex(colorR, colorG, colorB);
  const shimmer = makeShimmerDataUrl(lqip.info.width, lqip.info.height, colorHex);
  const shimmerBytes = Buffer.byteLength(shimmer.svg, "utf8");

  return {
    id: path.parse(fileName).name,
    src: `./images/${fileName}`,
    width: info.width,
    height: info.height,
    blurhash,
    thumbhashBase64,
    lqip: {
      mimeType: "image/jpeg",
      width: lqip.info.width,
      height: lqip.info.height,
      dataUrl: lqipDataUrl,
    },
    color: {
      r: colorR,
      g: colorG,
      b: colorB,
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
      lqipBytes: lqip.data.length,
      lqipDataUrlChars: lqipDataUrl.length,
      colorHexChars: colorHex.length,
      shimmerBytes,
      shimmerDataUrlChars: shimmer.dataUrl.length,
    },
  };
}

async function main() {
  const entries = await fs.readdir(imagesDir, { withFileTypes: true });
  const imageFiles = entries
    .filter((entry) => entry.isFile() && isSupportedImage(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (imageFiles.length === 0) {
    throw new Error("No supported images found in ./images");
  }

  const photos = [];

  for (const fileName of imageFiles) {
    const item = await computePlaceholdersForImage(fileName);
    photos.push(item);
    console.log(`Computed placeholders for ${fileName}`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    images: photos,
  };

  await fs.writeFile(photosJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${photos.length} image records to photos.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
