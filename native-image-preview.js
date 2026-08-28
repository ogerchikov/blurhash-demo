import {
  base64ToBytes,
  blurhashToRasterDataUrl,
  thumbhashToRasterDataUrl,
} from "./image-hash-utils.js";

const implementationBadge = document.getElementById("implementationBadge");
const reloadButton = document.getElementById("reloadPreviewsButton");
const previewDelaySelect = document.getElementById("previewDelaySelect");
const externalImage = document.getElementById("externalPreviewImage");
const inlineImage = document.getElementById("inlinePreviewImage");

const replayEntries = [
  {
    image: externalImage,
    finalSrc: "./images/night-mood.jpg",
    status: document.querySelector('[data-status-for="externalPreviewImage"]'),
    previewDescription: "Standard image preview",
  },
  {
    image: inlineImage,
    finalSrc: "./images/beach.png",
    status: document.querySelector('[data-status-for="inlinePreviewImage"]'),
    previewDescription: "Inline raster preview",
  },
];
let replayTimer;

function reloadFinalImages() {
  clearTimeout(replayTimer);
  const cacheKey = `preview-demo=${Date.now()}`;
  const delay = Number(previewDelaySelect.value);

  for (const { image, status, previewDescription } of replayEntries) {
    image.removeAttribute("src");
    status.textContent = `${previewDescription} shown for ${delay / 1000} seconds`;
  }

  replayTimer = setTimeout(() => {
    for (const { image, finalSrc, status } of replayEntries) {
      status.textContent = "Loading final image...";
      const url = new URL(finalSrc, document.baseURI);
      url.search = cacheKey;
      image.src = url.href;
    }
  }, delay);
}

function addReplayEntry(image, finalSrc, status, previewDescription) {
  replayEntries.push({ image, finalSrc, status, previewDescription });
  image.addEventListener("load", () => {
    status.textContent = "Final image loaded";
  });
  image.addEventListener("error", () => {
    status.textContent = "Final image failed to load";
  });
}

for (const { image, status } of replayEntries) {
  image.addEventListener("load", () => {
    status.textContent = "Final image loaded";
  });
  image.addEventListener("error", () => {
    status.textContent = "Final image failed to load";
  });
}

implementationBadge.textContent = window.imagePreviewDemo.implementation;
implementationBadge.dataset.implementation = window.imagePreviewDemo.implementation.toLowerCase();

function makeBlurHashDataUrl(hash) {
  return `data:application/x-blurhash,${encodeURIComponent(hash)}`;
}

function makeThumbHashDataUrl(hash) {
  return `data:application/x-thumbhash;base64,${hash}`;
}

function configureEncodedHashPreview({
  imageId,
  statusId,
  previewUrl,
  finalSrc,
}) {
  const image = document.getElementById(imageId);
  const status = document.getElementById(statusId);

  image.setAttribute("previewsrc", previewUrl);
  addReplayEntry(
    image,
    finalSrc,
    status,
    `Encoded hash preview decoded by ${window.imagePreviewDemo.implementation}`,
  );
}

try {
  const response = await fetch("./photos.json");
  if (!response.ok) {
    throw new Error(`photos.json request failed with status ${response.status}`);
  }

  const manifest = await response.json();
  const beach = manifest.images.find((image) => image.src === "./images/beach.png");
  const forest = manifest.images.find((image) => image.src === "./images/forest-trail.jpg");
  const city = manifest.images.find((image) => image.src === "./images/city-skyline.jpg");
  if (!beach?.lqip?.dataUrl?.startsWith("data:image/jpeg")) {
    throw new Error("Beach JPEG LQIP is missing from photos.json");
  }
  if (!forest?.blurhash) {
    throw new Error("Forest BlurHash is missing from photos.json");
  }
  if (!city?.thumbhashBase64) {
    throw new Error("City ThumbHash is missing from photos.json");
  }

  inlineImage.previewSrc = beach.lqip.dataUrl;

  const blurHashJsImage = document.getElementById("blurHashJsPreview");
  const blurHashJsStatus = document.getElementById("blurHashJsStatus");
  blurHashJsImage.previewSrc = blurhashToRasterDataUrl(forest.blurhash, 32, 21);
  addReplayEntry(
    blurHashJsImage,
    forest.src,
    blurHashJsStatus,
    "JavaScript-decoded raster preview",
  );
  document.getElementById("blurHashValue").textContent = forest.blurhash;

  const thumbHashJsImage = document.getElementById("thumbHashJsPreview");
  const thumbHashJsStatus = document.getElementById("thumbHashJsStatus");
  thumbHashJsImage.previewSrc = thumbhashToRasterDataUrl(base64ToBytes(city.thumbhashBase64));
  addReplayEntry(
    thumbHashJsImage,
    city.src,
    thumbHashJsStatus,
    "JavaScript-decoded raster preview",
  );
  document.getElementById("thumbHashValue").textContent = city.thumbhashBase64;

  configureEncodedHashPreview({
    imageId: "blurHashNativePreview",
    statusId: "blurHashNativeStatus",
    previewUrl: makeBlurHashDataUrl(forest.blurhash),
    finalSrc: forest.src,
  });
  configureEncodedHashPreview({
    imageId: "thumbHashNativePreview",
    statusId: "thumbHashNativeStatus",
    previewUrl: makeThumbHashDataUrl(city.thumbhashBase64),
    finalSrc: city.src,
  });

  reloadFinalImages();
} catch (error) {
  console.error(error);
  for (const { status } of replayEntries) {
    status.textContent = "Preview setup failed";
  }
  document.getElementById("blurHashJsStatus").textContent = "JavaScript decoding failed";
  document.getElementById("thumbHashJsStatus").textContent = "JavaScript decoding failed";
  reloadButton.disabled = true;
}

reloadButton.addEventListener("click", reloadFinalImages);
