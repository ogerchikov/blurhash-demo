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

try {
  const response = await fetch("./photos.json");
  if (!response.ok) {
    throw new Error(`photos.json request failed with status ${response.status}`);
  }

  const manifest = await response.json();
  const beach = manifest.images.find((image) => image.src === "./images/beach.png");
  if (!beach?.lqip?.dataUrl?.startsWith("data:image/jpeg")) {
    throw new Error("Beach JPEG LQIP is missing from photos.json");
  }

  inlineImage.previewSrc = beach.lqip.dataUrl;
  reloadFinalImages();
} catch (error) {
  console.error(error);
  setStatus(inlineImage, "Inline preview setup failed");
  reloadButton.disabled = true;
}

reloadButton.addEventListener("click", reloadFinalImages);
