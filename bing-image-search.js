import {
  cancelImagePreviewLoading,
  finishImagePreviewLoading,
  loadImagePreviewImplementation,
  startImagePreviewLoading,
} from "./image-preview-demo-support.js";
import { loadPhotosManifest } from "./manifest.js";

const imageResults = document.getElementById("imageResults");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const resultsLabel = document.getElementById("resultsLabel");
const landingModeSelect = document.getElementById("landingModeSelect");
const animatedTransitionsInput = document.getElementById(
  "animatedTransitionsInput",
);
const replayResultsButton = document.getElementById("replayResultsButton");
const detailViewer = document.getElementById("detailViewer");
const detailStage = document.getElementById("detailStage");
const detailImage = document.getElementById("detailImage");
const detailImageFrame = document.getElementById("detailImageFrame");
const detailFinalOverlay = document.getElementById("detailFinalOverlay");
const detailPreviewOverlay = document.getElementById("detailPreviewOverlay");
const detailTitle = document.getElementById("detailTitle");
const detailMeta = document.getElementById("detailMeta");
const relatedImages = document.getElementById("relatedImages");
const closeDetailButton = document.getElementById("closeDetailButton");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const replayButton = document.getElementById("replayButton");
const previewModeSelect = document.getElementById("previewModeSelect");
const loadDelaySelect = document.getElementById("loadDelaySelect");
const implementationBadge = document.getElementById("implementationBadge");
const previewExplainerTitle = document.getElementById("previewExplainerTitle");
const previewExplainerBody = document.getElementById("previewExplainerBody");
const suggestionButtons = document.querySelectorAll(".suggestion-strip button");

let records = [];
let visibleRecords = [];
let currentIndex = -1;
let displayVersion = 0;
let loadTimer = 0;
let previousFocus = null;
let activeDisplayMode = "current";
let previewImplementation = null;
let landingRenderVersion = 0;
const landingThumbnailSources = new Map();
let detailOverlayVersion = 0;
let currentDetailRecord = null;
let preparedOverlayVersion = 0;

function imageName(record) {
  return record.id
    .split(/[-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function thumbnailSource(record) {
  return `./progressive-images/${record.id}.jpg`;
}

function blurHashSource(record) {
  return `data:image/blurhash,${encodeURIComponent(record.blurhash)}`;
}

function updateModeDescription() {
  const mode = previewModeSelect.value;
  const usesPreviewSource = mode !== "current";
  implementationBadge.textContent = usesPreviewSource
    ? previewImplementation?.hasNativePreviewSource
      ? "Native preview API"
      : "Image.previewSrc polyfill"
    : "Dominant color baseline";
  previewExplainerTitle.textContent = mode === "proposed"
    ? "BlurHash preview-to-final handoff"
    : mode === "thumbnail"
      ? "Clicked-thumbnail preview-to-final handoff"
      : "Dominant-color placeholder";
  previewExplainerBody.replaceChildren();
  if (mode === "proposed") {
    previewExplainerBody.append(
      "The proposed view displays the image's BlurHash through ",
      Object.assign(document.createElement("code"), {
        textContent: "Image.previewSrc",
      }),
      ". It is replaced when the original image finishes loading.",
    );
  } else if (mode === "thumbnail") {
    previewExplainerBody.append(
      "This view passes the exact low-resolution thumbnail clicked on the landing page to ",
      Object.assign(document.createElement("code"), {
        textContent: "Image.previewSrc",
      }),
      ". It is replaced when the original image finishes loading.",
    );
  } else {
    previewExplainerBody.textContent =
      "The current view fills the image area with its dominant color until the original image finishes loading.";
  }
}

function createResultCard(record, index) {
  const article = document.createElement("article");
  article.className = "result-card";

  const button = document.createElement("button");
  button.className = "result-card__image";
  button.type = "button";
  button.style.setProperty("--image-ratio", `${record.width} / ${record.height}`);
  button.setAttribute("aria-label", `Open ${imageName(record)}`);
  button.addEventListener("click", () => {
    openDetail(index, button);
  });

  const image = document.createElement("img");
  image.alt = imageName(record);
  image.width = record.width;
  image.height = record.height;
  image.loading = index < 10 ? "eager" : "lazy";
  image.decoding = "async";
  image.addEventListener("load", () => {
    button.style.backgroundColor = "";
    if (landingModeSelect.value === "proposed") {
      finishImagePreviewLoading(image);
    }
  });
  image.addEventListener("error", () => {
    cancelImagePreviewLoading(image);
    button.style.backgroundColor = "";
  });

  const dimensions = document.createElement("span");
  dimensions.className = "result-card__size";
  dimensions.textContent = `${record.width} x ${record.height}`;

  const title = document.createElement("h2");
  title.textContent = `${imageName(record)} - high resolution image`;

  const source = document.createElement("p");
  source.textContent = "Image preview demo";

  button.append(image, dimensions);
  article.append(button, title, source);
  return article;
}

function loadResultCardImage(article, record, renderVersion) {
  const button = article.querySelector(".result-card__image");
  const image = button.querySelector("img");
  if (landingModeSelect.value === "proposed") {
    startImagePreviewLoading(image);
    image.setAttribute("previewsrc", blurHashSource(record));
  } else {
    button.style.backgroundColor = record.color.hex;
  }
  const sourceUrl = new URL(thumbnailSource(record), window.location.href);
  sourceUrl.searchParams.set("landing-replay", `${performance.timeOrigin}-${renderVersion}`);
  landingThumbnailSources.set(record.id, sourceUrl.href);
  image.src = sourceUrl.href;
}

function renderResults(query = "") {
  const renderVersion = ++landingRenderVersion;
  landingThumbnailSources.clear();
  const normalizedQuery = query.trim().toLowerCase();
  visibleRecords = normalizedQuery && normalizedQuery !== "beautiful places"
    ? records.filter((record) =>
        imageName(record).toLowerCase().includes(normalizedQuery),
      )
    : [...records];

  imageResults.replaceChildren();
  if (visibleRecords.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = `No local demo images match "${query}".`;
    imageResults.append(message);
  } else {
    const cards = visibleRecords.map((record, index) =>
      createResultCard(record, index),
    );
    imageResults.append(...cards);
    cards.forEach((card, index) => {
      loadResultCardImage(card, visibleRecords[index], renderVersion);
    });
  }
  imageResults.setAttribute("aria-busy", "false");
  resultsLabel.replaceChildren(
    document.createTextNode("Image results for "),
    Object.assign(document.createElement("strong"), {
      textContent: query.trim() || "beautiful places",
    }),
  );
}

function updateDetailInformation(record) {
  const name = imageName(record);
  detailImage.alt = name;
  detailTitle.textContent = `${name} - full resolution photograph`;
  detailMeta.textContent =
    `${record.width.toLocaleString()} x ${record.height.toLocaleString()} pixels`;
  previousButton.disabled = currentIndex <= 0;
  nextButton.disabled = currentIndex >= visibleRecords.length - 1;

  relatedImages.replaceChildren();
  visibleRecords
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ index }) => index !== currentIndex)
    .slice(0, 4)
    .forEach(({ candidate, index }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Open ${imageName(candidate)}`);
      button.addEventListener("click", () => {
        currentIndex = index;
        displayCurrentImage();
      });
      const image = document.createElement("img");
      image.src = thumbnailSource(candidate);
      image.alt = "";
      image.loading = "lazy";
      button.append(image);
      relatedImages.append(button);
    });
}

function fitDetailImage() {
  if (
    !currentDetailRecord
    || detailImageFrame.clientWidth === 0
    || detailImageFrame.clientHeight === 0
  ) {
    return;
  }

  const scale = Math.min(
    detailImageFrame.clientWidth / currentDetailRecord.width,
    detailImageFrame.clientHeight / currentDetailRecord.height,
  );
  detailImage.style.width = `${currentDetailRecord.width * scale}px`;
  detailImage.style.height = `${currentDetailRecord.height * scale}px`;
}

function detailPreviewContent() {
  return activeDisplayMode === "thumbnail"
    ? `url(${JSON.stringify(detailImage.getAttribute("previewsrc"))})`
    : detailImage.style.getPropertyValue("content");
}

async function prepareAnimatedFinalImage(source, version) {
  detailFinalOverlay.src = source;
  try {
    await detailFinalOverlay.decode();
  } catch {
    if (version === displayVersion) {
      detailImage.src = source;
    }
    return;
  }

  if (version !== displayVersion) {
    return;
  }
  const previewContent = detailPreviewContent();
  if (!previewContent) {
    detailImage.src = source;
    return;
  }

  const overlayVersion = ++detailOverlayVersion;
  preparedOverlayVersion = overlayVersion;
  detailPreviewOverlay.style.backgroundImage = previewContent;
  detailPreviewOverlay.hidden = false;
  detailFinalOverlay.hidden = false;
  detailImage.src = source;
}

function displayCurrentImage() {
  window.clearTimeout(loadTimer);
  const version = ++displayVersion;
  detailOverlayVersion += 1;
  preparedOverlayVersion = 0;
  detailPreviewOverlay.hidden = true;
  detailPreviewOverlay.classList.remove("is-revealing");
  detailPreviewOverlay.style.backgroundImage = "";
  detailFinalOverlay.hidden = true;
  detailFinalOverlay.removeAttribute("src");
  const record = visibleRecords[currentIndex];
  currentDetailRecord = record;
  updateDetailInformation(record);
  detailStage.setAttribute("aria-busy", "true");
  replayButton.disabled = true;

  activeDisplayMode = previewModeSelect.value;
  detailImage.style.removeProperty("content");
  detailImage.removeAttribute("src");
  if (activeDisplayMode !== "current") {
    detailImageFrame.style.backgroundColor = "";
    startImagePreviewLoading(detailImage);
    detailImage.setAttribute(
      "previewsrc",
      activeDisplayMode === "proposed"
        ? blurHashSource(record)
        : landingThumbnailSources.get(record.id) || thumbnailSource(record),
    );
  } else {
    cancelImagePreviewLoading(detailImage);
    detailImage.removeAttribute("previewsrc");
    detailImageFrame.style.backgroundColor = record.color.hex;
  }
  detailImage.width = record.width;
  detailImage.height = record.height;
  fitDetailImage();
  updateModeDescription();

  const delay = Number(loadDelaySelect.value);
  loadTimer = window.setTimeout(() => {
    if (version !== displayVersion) {
      return;
    }
    const source = new URL(record.src, window.location.href);
    source.searchParams.set("preview-demo", `${performance.timeOrigin}-${version}`);
    if (
      activeDisplayMode !== "current"
      && animatedTransitionsInput.checked
    ) {
      prepareAnimatedFinalImage(source.href, version);
    } else {
      detailImage.src = source.href;
    }
  }, delay);
}

function openDetail(index, trigger) {
  previousFocus = trigger;
  currentIndex = index;
  detailViewer.hidden = false;
  document.body.classList.add("detail-open");
  history.pushState({ imageDetail: true }, "", `#image=${visibleRecords[index].id}`);
  displayCurrentImage();
  closeDetailButton.focus();
}

function updateTransitionPreference() {
  const enabled = animatedTransitionsInput.checked;
  document.documentElement.classList.toggle(
    "image-preview-css-transition",
    enabled,
  );
  if (previewImplementation?.polyfill) {
    previewImplementation.polyfill.transitionsEnabled = enabled;
  }
}

function closeDetail({ useHistory = true } = {}) {
  if (detailViewer.hidden) {
    return;
  }
  window.clearTimeout(loadTimer);
  ++displayVersion;
  detailOverlayVersion += 1;
  preparedOverlayVersion = 0;
  cancelImagePreviewLoading(detailImage);
  detailPreviewOverlay.hidden = true;
  detailPreviewOverlay.classList.remove("is-revealing");
  detailPreviewOverlay.style.backgroundImage = "";
  detailFinalOverlay.hidden = true;
  detailFinalOverlay.removeAttribute("src");
  detailImage.removeAttribute("src");
  detailImage.removeAttribute("previewsrc");
  detailViewer.hidden = true;
  document.body.classList.remove("detail-open");
  if (useHistory && location.hash.startsWith("#image=")) {
    history.back();
  }
  previousFocus?.focus();
}

detailImage.addEventListener("load", () => {
  if (
    preparedOverlayVersion !== 0
    && preparedOverlayVersion === detailOverlayVersion
  ) {
    const overlayVersion = preparedOverlayVersion;
    preparedOverlayVersion = 0;
    cancelImagePreviewLoading(detailImage);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (detailOverlayVersion === overlayVersion) {
          detailPreviewOverlay.classList.add("is-revealing");
        }
      });
    });
    detailPreviewOverlay.addEventListener("transitionend", () => {
      if (detailOverlayVersion === overlayVersion) {
        detailPreviewOverlay.hidden = true;
        detailPreviewOverlay.classList.remove("is-revealing");
        detailPreviewOverlay.style.backgroundImage = "";
        detailFinalOverlay.hidden = true;
        detailFinalOverlay.removeAttribute("src");
      }
    }, { once: true });
  } else if (activeDisplayMode !== "current") {
    finishImagePreviewLoading(detailImage);
  } else {
    cancelImagePreviewLoading(detailImage);
  }
  detailImageFrame.style.backgroundColor = "";
  detailStage.setAttribute("aria-busy", "false");
  replayButton.disabled = false;
});

detailImage.addEventListener("error", () => {
  cancelImagePreviewLoading(detailImage);
  detailStage.setAttribute("aria-busy", "false");
  replayButton.disabled = false;
  detailTitle.textContent = `${detailImage.alt} failed to load`;
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renderResults(searchInput.value);
});
suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = button.textContent;
    renderResults(searchInput.value);
  });
});
landingModeSelect.addEventListener("change", () => {
  renderResults(searchInput.value);
});
animatedTransitionsInput.addEventListener("change", () => {
  updateTransitionPreference();
  renderResults(searchInput.value);
  if (!detailViewer.hidden) {
    displayCurrentImage();
  }
});
replayResultsButton.addEventListener("click", () => {
  renderResults(searchInput.value);
});
closeDetailButton.addEventListener("click", () => closeDetail());
replayButton.addEventListener("click", displayCurrentImage);
previewModeSelect.addEventListener("change", () => {
  updateModeDescription();
  if (!detailViewer.hidden) {
    displayCurrentImage();
  }
});
loadDelaySelect.addEventListener("change", displayCurrentImage);
previousButton.addEventListener("click", () => {
  currentIndex -= 1;
  displayCurrentImage();
});
nextButton.addEventListener("click", () => {
  currentIndex += 1;
  displayCurrentImage();
});
document.addEventListener("keydown", (event) => {
  if (detailViewer.hidden) {
    return;
  }
  if (event.key === "Escape") {
    closeDetail();
  } else if (event.key === "ArrowLeft" && !previousButton.disabled) {
    currentIndex -= 1;
    displayCurrentImage();
  } else if (event.key === "ArrowRight" && !nextButton.disabled) {
    currentIndex += 1;
    displayCurrentImage();
  }
});
window.addEventListener("popstate", () => {
  if (!location.hash.startsWith("#image=")) {
    closeDetail({ useHistory: false });
  }
});
new ResizeObserver(fitDetailImage).observe(detailImageFrame);

try {
  previewImplementation = await loadImagePreviewImplementation();
  updateModeDescription();
  document.documentElement.classList.add(
    "blur-image-previews",
  );
  updateTransitionPreference();
  ({ images: records } = await loadPhotosManifest());
  renderResults(searchInput.value);
} catch (error) {
  console.error(error);
  imageResults.setAttribute("aria-busy", "false");
  imageResults.innerHTML =
    '<p class="empty-message">The image preview demo could not be loaded.</p>';
}
