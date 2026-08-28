import { decode as decodeBlurHash } from "https://cdn.jsdelivr.net/npm/blurhash/+esm";
import { thumbHashToRGBA } from "https://cdn.jsdelivr.net/npm/thumbhash/+esm";

export function makeCanvasFromRGBA(rgba, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  const imageData = context.createImageData(width, height);
  imageData.data.set(rgba);
  context.putImageData(imageData, 0, 0);

  return canvas;
}

export function makeBlurhashCanvas(hash, width, height) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const rgba = decodeBlurHash(hash, safeWidth, safeHeight);
  return makeCanvasFromRGBA(rgba, safeWidth, safeHeight);
}

export function makeThumbhashCanvas(hashBytes) {
  const decoded = thumbHashToRGBA(hashBytes);
  return makeCanvasFromRGBA(decoded.rgba, decoded.w, decoded.h);
}

export function blurhashToRasterDataUrl(hash, width, height) {
  return makeBlurhashCanvas(hash, width, height).toDataURL("image/png");
}

export function thumbhashToRasterDataUrl(hashBytes) {
  return makeThumbhashCanvas(hashBytes).toDataURL("image/png");
}

export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}
