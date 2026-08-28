const PHOTOS_MANIFEST_SRC = "./photos.json";

const PAYLOAD_FIELDS = ["lqip", "avif", "shimmer"];
const BYTE_FIELDS = [
  "blurhashChars",
  "thumbhashBytes",
  "thumbhashBase64Chars",
  "lqipBytes",
  "lqipDataUrlChars",
  "avifBytes",
  "avifDataUrlChars",
  "colorHexChars",
  "shimmerBytes",
  "shimmerDataUrlChars",
];

function fail(path, expectation) {
  throw new TypeError(`photos.json: "${path}" ${expectation}.`);
}

function requireObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "must be an object");
  }
}

function requireString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, "must be a non-empty string");
  }
}

function requirePositiveInteger(value, path) {
  if (!Number.isInteger(value) || value <= 0) {
    fail(path, "must be a positive integer");
  }
}

function validatePayload(payload, path) {
  requireObject(payload, path);
  requireString(payload.mimeType, `${path}.mimeType`);
  requirePositiveInteger(payload.width, `${path}.width`);
  requirePositiveInteger(payload.height, `${path}.height`);
  requireString(payload.dataUrl, `${path}.dataUrl`);
  if (!payload.dataUrl.startsWith(`data:${payload.mimeType}`)) {
    fail(`${path}.dataUrl`, `must use the declared MIME type "${payload.mimeType}"`);
  }
}

function validateImage(image, index, ids, sources) {
  const path = `images[${index}]`;
  requireObject(image, path);
  requireString(image.id, `${path}.id`);
  requireString(image.src, `${path}.src`);
  requirePositiveInteger(image.width, `${path}.width`);
  requirePositiveInteger(image.height, `${path}.height`);
  requireString(image.blurhash, `${path}.blurhash`);
  requireString(image.thumbhashBase64, `${path}.thumbhashBase64`);

  if (ids.has(image.id)) {
    fail(`${path}.id`, `must be unique; "${image.id}" is duplicated`);
  }
  if (sources.has(image.src)) {
    fail(`${path}.src`, `must be unique; "${image.src}" is duplicated`);
  }
  ids.add(image.id);
  sources.add(image.src);

  PAYLOAD_FIELDS.forEach((field) => validatePayload(image[field], `${path}.${field}`));

  requireObject(image.color, `${path}.color`);
  ["r", "g", "b"].forEach((field) => {
    const value = image.color[field];
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      fail(`${path}.color.${field}`, "must be an integer from 0 through 255");
    }
  });
  if (typeof image.color.hex !== "string" || !/^#[0-9a-f]{6}$/i.test(image.color.hex)) {
    fail(`${path}.color.hex`, "must be a six-digit hexadecimal color");
  }

  requireObject(image.bytes, `${path}.bytes`);
  BYTE_FIELDS.forEach((field) => requirePositiveInteger(image.bytes[field], `${path}.bytes.${field}`));
}

function validateManifest(manifest) {
  requireObject(manifest, "root");
  requireString(manifest.generatedAt, "generatedAt");
  if (Number.isNaN(Date.parse(manifest.generatedAt))) {
    fail("generatedAt", "must be a valid date");
  }
  requireString(manifest.generatedBy, "generatedBy");
  if (!Array.isArray(manifest.images) || manifest.images.length === 0) {
    fail("images", "must be a non-empty array");
  }

  const ids = new Set();
  const sources = new Set();
  manifest.images.forEach((image, index) => validateImage(image, index, ids, sources));
  return manifest;
}

export async function loadPhotosManifest() {
  const response = await fetch(PHOTOS_MANIFEST_SRC, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`photos.json: request failed with HTTP ${response.status}.`);
  }

  let manifest;
  try {
    manifest = await response.json();
  } catch (error) {
    throw new SyntaxError(`photos.json: invalid JSON (${error.message}).`);
  }
  return validateManifest(manifest);
}
