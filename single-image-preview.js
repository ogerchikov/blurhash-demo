import {
  galleryPreviewFormats as formats,
} from "./gallery-preview-formats.js";
import {
  createFreshImageObjectUrl,
  initializeImagePreviewControls,
  loadImagePreviewImplementation,
} from "./image-preview-demo-support.js";
import { loadPhotosManifest } from "./manifest.js";

const formatSelect = document.getElementById("previewFormatSelect");
const reloadButton = document.getElementById("reloadGalleryButton");
const implementationBadge = document.getElementById("implementationBadge");
const polyfillTransitionControl = document.getElementById(
  "polyfillTransitionControl",
);
const polyfillTransitionInput = document.getElementById(
  "polyfillTransitionInput",
);
const viewer = document.getElementById("singlePhotoViewer");
const image = document.getElementById("singlePhoto");
const title = document.getElementById("singlePhotoTitle");
const position = document.getElementById("photoPosition");
const previousButton = document.getElementById("previousPhotoButton");
const nextButton = document.getElementById("nextPhotoButton");

let records = [];
let currentIndex = 0;
let displayVersion = 0;
let objectUrl = null;

function photoName(src) {
  const filename = src.split("/").pop().replace(/\.[^.]+$/, "");
  return filename
    .split(/[-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function updateNavigation() {
  position.textContent = `${currentIndex + 1} of ${records.length}`;
  previousButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === records.length - 1;
}

async function displayCurrentPhoto(forceReload = false) {
  const version = displayVersion + 1;
  displayVersion = version;
  const record = records[currentIndex];
  const format = formats[formatSelect.value];
  const previewSrc = format.getPreview(record);

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  viewer.setAttribute("aria-busy", "true");
  image.removeAttribute("src");
  image.setAttribute("previewsrc", previewSrc);
  image.width = record.width;
  image.height = record.height;
  image.alt = photoName(record.src);
  title.textContent = image.alt;
  updateNavigation();

  let source = record.src;
  if (forceReload) {
    try {
      source = await createFreshImageObjectUrl(record.src);
    } catch (error) {
      if (version === displayVersion) {
        console.error(error);
        viewer.setAttribute("aria-busy", "false");
        title.textContent = `${image.alt} failed to load`;
      }
      return;
    }
  }

  if (version !== displayVersion) {
    if (source !== record.src) {
      URL.revokeObjectURL(source);
    }
    return;
  }

  objectUrl = source !== record.src ? source : null;
  image.src = source;
}

image.addEventListener("load", () => {
  viewer.setAttribute("aria-busy", "false");
});

image.addEventListener("error", () => {
  viewer.setAttribute("aria-busy", "false");
  title.textContent = `${image.alt} failed to load`;
});

reloadButton.addEventListener("click", () => displayCurrentPhoto(true));
previousButton.addEventListener("click", () => {
  currentIndex -= 1;
  displayCurrentPhoto(true);
});
nextButton.addEventListener("click", () => {
  currentIndex += 1;
  displayCurrentPhoto(true);
});
window.addEventListener("pagehide", () => {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
});

try {
  const { hasNativePreviewSource, polyfill } =
    await loadImagePreviewImplementation();
  ({ images: records } = await loadPhotosManifest());
  initializeImagePreviewControls({
    formatSelect,
    implementationBadge,
    transitionControl: polyfillTransitionControl,
    transitionInput: polyfillTransitionInput,
    hasNativePreviewSource,
    polyfill,
    replay: () => displayCurrentPhoto(true),
  });
  displayCurrentPhoto();
} catch (error) {
  console.error(error);
  viewer.setAttribute("aria-busy", "false");
  title.textContent = "The photo gallery could not be loaded.";
  reloadButton.disabled = true;
  formatSelect.disabled = true;
  polyfillTransitionControl.hidden = true;
  previousButton.disabled = true;
  nextButton.disabled = true;
}
