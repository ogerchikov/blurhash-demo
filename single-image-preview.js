import {
  galleryPreviewFormats as formats,
} from "./gallery-preview-formats.js";
import {
  cancelImagePreviewLoading,
  createFreshImageObjectUrl,
  finishImagePreviewLoading,
  initializeImagePreviewControls,
  loadImagePreviewImplementation,
  startImagePreviewLoading,
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
const polyfillBlurControl = document.getElementById("polyfillBlurControl");
const polyfillBlurInput = document.getElementById("polyfillBlurInput");
const viewer = document.getElementById("singlePhotoViewer");
const image = document.getElementById("singlePhoto");
const imageFrame = image.parentElement;
const title = document.getElementById("singlePhotoTitle");
const position = document.getElementById("photoPosition");
const previousButton = document.getElementById("previousPhotoButton");
const nextButton = document.getElementById("nextPhotoButton");

let records = [];
let currentIndex = 0;
let displayVersion = 0;
let objectUrl = null;
let previewImplementation = null;

function freshUrl(src, version) {
  const url = new URL(src, window.location.href);
  url.searchParams.set("replay", `${performance.timeOrigin}-${version}`);
  return url.href;
}

function updateModeControls(format) {
  const usesPreview = format.strategy === "preview";
  implementationBadge.textContent = usesPreview
    ? previewImplementation.hasNativePreviewSource
      ? "Native API"
      : "Polyfill"
    : "Browser codec";
  implementationBadge.title = usesPreview
    ? "This mode uses previewsrc before the final image."
    : "This mode loads one progressive image directly.";
  polyfillTransitionControl.hidden = !usesPreview || !previewImplementation.polyfill;
  polyfillBlurControl.hidden = !usesPreview || !previewImplementation.polyfill;
}

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
  const usesPreview = format.strategy === "preview";
  updateModeControls(format);

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  viewer.setAttribute("aria-busy", "true");
  image.removeAttribute("src");
  if (usesPreview) {
    startImagePreviewLoading(image);
    image.setAttribute("previewsrc", format.getPreview(record));
  } else {
    cancelImagePreviewLoading(image);
    image.removeAttribute("previewsrc");
  }
  image.width = record.width;
  image.height = record.height;
  image.alt = photoName(record.src);
  title.textContent = image.alt;
  updateNavigation();

  let source = usesPreview ? record.src : format.getSource(record);
  if (forceReload) {
    if (usesPreview) {
      try {
        source = await createFreshImageObjectUrl(record.src);
      } catch (error) {
        if (version === displayVersion) {
          console.error(error);
          cancelImagePreviewLoading(image);
          viewer.setAttribute("aria-busy", "false");
          title.textContent = `${image.alt} failed to load`;
        }
        return;
      }
    } else {
      source = freshUrl(source, version);
    }
  }

  if (version !== displayVersion) {
    if (source.startsWith("blob:")) {
      URL.revokeObjectURL(source);
    }
    return;
  }

  objectUrl = source.startsWith("blob:") ? source : null;
  image.src = source;
}

image.addEventListener("load", () => {
  finishImagePreviewLoading(image);
  viewer.setAttribute("aria-busy", "false");
});

image.addEventListener("error", () => {
  cancelImagePreviewLoading(image);
  viewer.setAttribute("aria-busy", "false");
  const format = formats[formatSelect.value];
  title.textContent = format.strategy === "progressive"
    ? `${format.label} is unsupported or failed to load`
    : `${image.alt} failed to load`;
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
  previewImplementation = { hasNativePreviewSource, polyfill };
  ({ images: records } = await loadPhotosManifest());
  initializeImagePreviewControls({
    formatSelect,
    implementationBadge,
    transitionControl: polyfillTransitionControl,
    transitionInput: polyfillTransitionInput,
    blurControl: polyfillBlurControl,
    blurInput: polyfillBlurInput,
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
