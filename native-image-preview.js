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
const galleryStatus = document.getElementById("galleryStatus");
const photoCount = document.getElementById("photoCount");
const gallery = document.getElementById("photoGallery");

let entries = [];
let settledImages = new Set();
let failedImages = 0;
let replayVersion = 0;

function photoName(src) {
  const filename = src.split("/").pop().replace(/\.[^.]+$/, "");
  return filename
    .split(/[-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function createGalleryEntry(record) {
  const card = document.createElement("figure");
  card.className = "photo-card";

  const frame = document.createElement("div");
  frame.className = "photo-card-frame";
  frame.style.aspectRatio = `${record.width} / ${record.height}`;

  const image = document.createElement("img");
  const name = photoName(record.src);
  image.alt = name;
  image.decoding = "async";
  image.width = record.width;
  image.height = record.height;

  const caption = document.createElement("figcaption");
  caption.className = "photo-card-caption";
  const title = document.createElement("strong");
  title.textContent = name;
  const status = document.createElement("output");
  status.textContent = "Preparing preview...";
  caption.append(title, status);
  frame.appendChild(image);
  card.append(frame, caption);

  const entry = {
    record,
    image,
    status,
    objectUrl: null,
  };

  function settle(failed) {
    if (settledImages.has(entry)) {
      return;
    }
    settledImages.add(entry);
    failedImages += Number(failed);
    if (settledImages.size === entries.length) {
      gallery.setAttribute("aria-busy", "false");
      galleryStatus.textContent = failedImages
        ? `${entries.length - failedImages} of ${entries.length} photos loaded; ${failedImages} failed`
        : `All ${entries.length} photos loaded`;
    }
  }

  image.addEventListener("load", () => {
    status.textContent = "Loaded";
    settle(false);
  });
  image.addEventListener("error", () => {
    status.textContent = "Final image failed to load";
    settle(true);
  });

  return { card, entry };
}

async function replayGallery(forceReload = false) {
  const version = replayVersion + 1;
  replayVersion = version;
  const format = formats[formatSelect.value];
  settledImages = new Set();
  failedImages = 0;
  gallery.setAttribute("aria-busy", "true");
  galleryStatus.textContent = `Loading ${entries.length} photos...`;

  for (const entry of entries) {
    const { record, image, status } = entry;
    if (entry.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
      entry.objectUrl = null;
    }
    image.removeAttribute("src");
    image.setAttribute("previewsrc", format.getPreview(record));
    status.textContent = "Loading full photo...";
  }

  const sources = forceReload
    ? await Promise.all(entries.map(async ({ record }) => {
        try {
          return {
            src: await createFreshImageObjectUrl(record.src),
            objectUrl: true,
          };
        } catch (error) {
          return { error };
        }
      }))
    : entries.map(({ record }) => ({ src: record.src, objectUrl: false }));

  if (version !== replayVersion) {
    for (const source of sources) {
      if (source.objectUrl) {
        URL.revokeObjectURL(source.src);
      }
    }
    return;
  }

  sources.forEach((source, index) => {
    const entry = entries[index];
    if (source.error) {
      console.error(source.error);
      entry.status.textContent = "Final image failed to load";
      settle(true);
      return;
    }
    entry.objectUrl = source.objectUrl ? source.src : null;
    entry.image.src = source.src;
  });
}

function replayFreshGallery() {
  replayGallery(true);
}

function revokeObjectUrls() {
  for (const entry of entries) {
    if (entry.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
      entry.objectUrl = null;
    }
  }
}

async function initializeGallery() {
  const { hasNativePreviewSource, polyfill } =
    await loadImagePreviewImplementation();
  const { images: records } = await loadPhotosManifest();
  const fragment = document.createDocumentFragment();
  entries = records.map((record) => {
    const { card, entry } = createGalleryEntry(record);
    fragment.appendChild(card);
    return entry;
  });
  gallery.replaceChildren(fragment);
  photoCount.textContent = `${entries.length} photos`;
  initializeImagePreviewControls({
    formatSelect,
    implementationBadge,
    transitionControl: polyfillTransitionControl,
    transitionInput: polyfillTransitionInput,
    hasNativePreviewSource,
    polyfill,
    replay: replayFreshGallery,
  });
  replayGallery();
}

reloadButton.addEventListener("click", replayFreshGallery);
window.addEventListener("pagehide", revokeObjectUrls);

try {
  await initializeGallery();
} catch (error) {
  console.error(error);
  gallery.setAttribute("aria-busy", "false");
  galleryStatus.textContent = "The photo gallery could not be loaded.";
  reloadButton.disabled = true;
  formatSelect.disabled = true;
  polyfillTransitionControl.hidden = true;
}
