import { galleryPreviewFormats as formats } from "./gallery-preview-formats.js";

const PREVIEW_DURATION_MS = 2500;

const formatSelect = document.getElementById("previewFormatSelect");
const reloadButton = document.getElementById("reloadGalleryButton");
const implementationBadge = document.getElementById("implementationBadge");
const galleryStatus = document.getElementById("galleryStatus");
const photoCount = document.getElementById("photoCount");
const gallery = document.getElementById("photoGallery");

let entries = [];
let replayTimer;
let replayId = 0;
let loadedImages = new Set();

const requestedFormat = new URL(window.location.href).searchParams.get("preview");
if (requestedFormat in formats) {
  formatSelect.value = requestedFormat;
}

function photoName(src) {
  const filename = src.split("/").pop().replace(/\.[^.]+$/, "");
  return filename
    .split(/[-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function createGalleryEntry(record) {
  const card = document.createElement("article");
  card.className = "photo-card";

  const frame = document.createElement("div");
  frame.className = "photo-card-frame";
  if (record.width > 0 && record.height > 0) {
    frame.style.aspectRatio = `${record.width} / ${record.height}`;
  }

  const image = document.createElement("img");
  const name = photoName(record.src);
  image.alt = name;
  image.decoding = "async";
  if (record.width > 0 && record.height > 0) {
    image.width = record.width;
    image.height = record.height;
  }

  const caption = document.createElement("div");
  caption.className = "photo-card-caption";
  const title = document.createElement("strong");
  title.textContent = name;
  const status = document.createElement("span");
  status.textContent = "Preparing preview...";
  caption.append(title, status);
  frame.appendChild(image);
  card.append(frame, caption);

  const entry = { record, image, status };
  image.addEventListener("load", () => {
    if (!image.hasAttribute("src")) {
      return;
    }
    image.classList.remove("is-blur-up");
    status.textContent = "Loaded";
    loadedImages.add(entry);
    galleryStatus.textContent = `${loadedImages.size} of ${entries.length} photos loaded`;
    if (loadedImages.size === entries.length) {
      gallery.setAttribute("aria-busy", "false");
    }
  });
  image.addEventListener("error", () => {
    if (!image.hasAttribute("src")) {
      return;
    }
    image.classList.remove("is-blur-up");
    status.textContent = "Final image failed to load";
    galleryStatus.textContent = "Some final images could not be loaded";
  });

  return { card, entry };
}

function configureAvailableFormats(records) {
  for (const option of formatSelect.options) {
    const format = formats[option.value];
    const availableForEveryPhoto = records.every((record) => format.getPreview(record));
    option.disabled = !availableForEveryPhoto;
    option.hidden = !availableForEveryPhoto;
  }

  if (formatSelect.selectedOptions[0]?.disabled) {
    const firstAvailable = Array.from(formatSelect.options).find((option) => !option.disabled);
    if (firstAvailable) {
      formatSelect.value = firstAvailable.value;
    }
  }
}

function replayGallery() {
  clearTimeout(replayTimer);
  replayId += 1;
  const currentReplayId = replayId;
  const format = formats[formatSelect.value];
  loadedImages = new Set();
  gallery.setAttribute("aria-busy", "true");

  for (const { record, image, status } of entries) {
    image.removeAttribute("src");
    const previewSrc = format.getPreview(record);
    if (previewSrc) {
      image.setAttribute("previewsrc", previewSrc);
      image.classList.toggle("is-blur-up", formatSelect.value === "lqip");
      status.textContent = `${format.label} preview`;
    } else {
      image.removeAttribute("previewsrc");
      image.classList.remove("is-blur-up");
      status.textContent = "Preview unavailable";
    }
  }

  galleryStatus.textContent = `${entries.length} ${format.label} previews shown`;

  replayTimer = setTimeout(() => {
    if (currentReplayId !== replayId) {
      return;
    }

    const cacheKey = `gallery-replay=${Date.now()}`;
    for (const { record, image, status } of entries) {
      status.textContent = "Loading full photo...";
      const finalUrl = new URL(record.src, document.baseURI);
      finalUrl.search = cacheKey;
      image.src = finalUrl.href;
    }
  }, PREVIEW_DURATION_MS);
}

async function initializeGallery() {
  const response = await fetch("./photos.json");
  if (!response.ok) {
    throw new Error(`photos.json request failed with status ${response.status}`);
  }

  const manifest = await response.json();
  const records = Array.isArray(manifest.images)
    ? manifest.images.filter((record) => typeof record.src === "string")
    : [];
  if (records.length === 0) {
    throw new Error("photos.json contains no images");
  }

  configureAvailableFormats(records);
  const fragment = document.createDocumentFragment();
  entries = records.map((record) => {
    const { card, entry } = createGalleryEntry(record);
    fragment.appendChild(card);
    return entry;
  });
  gallery.replaceChildren(fragment);
  photoCount.textContent = `${entries.length} photos`;
  replayGallery();
}

implementationBadge.textContent = window.imagePreviewDemo.implementation;
implementationBadge.dataset.implementation = window.imagePreviewDemo.implementation.toLowerCase();

formatSelect.addEventListener("change", () => {
  const url = new URL(window.location.href);
  url.searchParams.set("preview", formatSelect.value);
  window.history.replaceState(null, "", url);
  replayGallery();
});
reloadButton.addEventListener("click", replayGallery);

try {
  await initializeGallery();
} catch (error) {
  console.error(error);
  gallery.setAttribute("aria-busy", "false");
  galleryStatus.textContent = "The photo gallery could not be loaded.";
  reloadButton.disabled = true;
  formatSelect.disabled = true;
}
