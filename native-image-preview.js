import {
  base64ToBytes,
  makeBlurhashCanvas,
  makeThumbhashCanvas,
} from "./image-hash-utils.js";

const implementationBadge = document.getElementById("implementationBadge");
const reloadButton = document.getElementById("reloadPreviewsButton");
const externalImage = document.getElementById("externalPreviewImage");
const inlineImage = document.getElementById("inlinePreviewImage");

const examples = [
  {
    image: externalImage,
    finalSrc: "./images/night-mood.jpg",
  },
  {
    image: inlineImage,
    finalSrc: "./images/beach.png",
  },
];

function setStatus(image, text) {
  const status = document.querySelector(`[data-status-for="${image.id}"]`);
  status.textContent = text;
}

function reloadFinalImages() {
  const cacheKey = `preview-demo=${Date.now()}`;

  for (const { image, finalSrc } of examples) {
    setStatus(image, "Loading final image...");
    const url = new URL(finalSrc, document.baseURI);
    url.search = cacheKey;
    image.src = url.href;
  }
}

for (const { image } of examples) {
  image.addEventListener("load", () => setStatus(image, "Final image loaded"));
  image.addEventListener("error", () => setStatus(image, "Final image failed to load"));
}

implementationBadge.textContent = window.imagePreviewDemo.implementation;
implementationBadge.dataset.implementation = window.imagePreviewDemo.implementation.toLowerCase();

function makeBlurHashDataUrl(hash) {
  return `data:application/x-blurhash,${encodeURIComponent(hash)}`;
}

function makeThumbHashDataUrl(hash) {
  return `data:application/x-thumbhash;base64,${hash}`;
}

function canDecodeNatively(dataUrl) {
  if (window.imagePreviewDemo.implementation !== "Native API") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const probe = new Image();
    const timeout = setTimeout(() => resolve(false), 1000);
    probe.addEventListener("load", () => {
      clearTimeout(timeout);
      resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0);
    }, { once: true });
    probe.addEventListener("error", () => {
      clearTimeout(timeout);
      resolve(false);
    }, { once: true });
    probe.src = dataUrl;
  });
}

async function configureNativePreview({
  imageId,
  unsupportedId,
  statusId,
  previewUrl,
  finalSrc,
}) {
  const image = document.getElementById(imageId);
  const unsupported = document.getElementById(unsupportedId);
  const status = document.getElementById(statusId);

  image.setAttribute("previewsrc", previewUrl);
  if (!await canDecodeNatively(previewUrl)) {
    status.textContent = "No native decoder is available for this media type.";
    return;
  }

  unsupported.hidden = true;
  image.hidden = false;
  image.src = finalSrc;
  status.textContent = "Native decoder available";
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

  const blurHashCanvas = makeBlurhashCanvas(forest.blurhash, 32, 21);
  document.getElementById("blurHashJsPreview").appendChild(blurHashCanvas);
  document.getElementById("blurHashJsStatus").textContent = "Decoded by the BlurHash JavaScript library";
  document.getElementById("blurHashValue").textContent = forest.blurhash;

  const thumbHashCanvas = makeThumbhashCanvas(base64ToBytes(city.thumbhashBase64));
  document.getElementById("thumbHashJsPreview").appendChild(thumbHashCanvas);
  document.getElementById("thumbHashJsStatus").textContent = "Decoded by the ThumbHash JavaScript library";
  document.getElementById("thumbHashValue").textContent = city.thumbhashBase64;

  await Promise.all([
    configureNativePreview({
      imageId: "blurHashNativePreview",
      unsupportedId: "blurHashUnsupported",
      statusId: "blurHashNativeStatus",
      previewUrl: makeBlurHashDataUrl(forest.blurhash),
      finalSrc: forest.src,
    }),
    configureNativePreview({
      imageId: "thumbHashNativePreview",
      unsupportedId: "thumbHashUnsupported",
      statusId: "thumbHashNativeStatus",
      previewUrl: makeThumbHashDataUrl(city.thumbhashBase64),
      finalSrc: city.src,
    }),
  ]);

  reloadFinalImages();
} catch (error) {
  console.error(error);
  for (const { image } of examples) {
    setStatus(image, "Preview setup failed");
  }
  document.getElementById("blurHashJsStatus").textContent = "JavaScript decoding failed";
  document.getElementById("thumbHashJsStatus").textContent = "JavaScript decoding failed";
  reloadButton.disabled = true;
}

reloadButton.addEventListener("click", reloadFinalImages);
