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
const detailViewer = document.getElementById("detailViewer");
const detailStage = document.getElementById("detailStage");
const detailImage = document.getElementById("detailImage");
const detailTitle = document.getElementById("detailTitle");
const detailMeta = document.getElementById("detailMeta");
const relatedImages = document.getElementById("relatedImages");
const closeDetailButton = document.getElementById("closeDetailButton");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const replayButton = document.getElementById("replayButton");
const loadDelaySelect = document.getElementById("loadDelaySelect");
const implementationBadge = document.getElementById("implementationBadge");
const suggestionButtons = document.querySelectorAll(".suggestion-strip button");

let records = [];
let visibleRecords = [];
let currentIndex = -1;
let displayVersion = 0;
let loadTimer = 0;
let previousFocus = null;

function imageName(record) {
  return record.id
    .split(/[-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function thumbnailSource(record) {
  return `./progressive-images/${record.id}.jpg`;
}

function createResultCard(record, index) {
  const article = document.createElement("article");
  article.className = "result-card";

  const button = document.createElement("button");
  button.className = "result-card__image";
  button.type = "button";
  button.style.setProperty("--image-ratio", `${record.width} / ${record.height}`);
  button.setAttribute("aria-label", `Open ${imageName(record)}`);
  button.addEventListener("click", () => openDetail(index, button));

  const image = document.createElement("img");
  image.src = thumbnailSource(record);
  image.alt = imageName(record);
  image.width = record.width;
  image.height = record.height;
  image.loading = index < 10 ? "eager" : "lazy";
  image.decoding = "async";

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

function renderResults(query = "") {
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
    imageResults.append(
      ...visibleRecords.map((record, index) => createResultCard(record, index)),
    );
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

function displayCurrentImage() {
  window.clearTimeout(loadTimer);
  const version = ++displayVersion;
  const record = visibleRecords[currentIndex];
  updateDetailInformation(record);
  detailStage.setAttribute("aria-busy", "true");
  replayButton.disabled = true;

  detailImage.removeAttribute("src");
  startImagePreviewLoading(detailImage);
  detailImage.setAttribute("previewsrc", thumbnailSource(record));
  detailImage.width = record.width;
  detailImage.height = record.height;

  const delay = Number(loadDelaySelect.value);
  loadTimer = window.setTimeout(() => {
    if (version !== displayVersion) {
      return;
    }
    const source = new URL(record.src, window.location.href);
    source.searchParams.set("preview-demo", `${performance.timeOrigin}-${version}`);
    detailImage.src = source.href;
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

function closeDetail({ useHistory = true } = {}) {
  if (detailViewer.hidden) {
    return;
  }
  window.clearTimeout(loadTimer);
  ++displayVersion;
  cancelImagePreviewLoading(detailImage);
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
  finishImagePreviewLoading(detailImage);
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
closeDetailButton.addEventListener("click", () => closeDetail());
replayButton.addEventListener("click", displayCurrentImage);
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

try {
  const previewImplementation = await loadImagePreviewImplementation();
  implementationBadge.textContent = previewImplementation.hasNativePreviewSource
    ? "Native preview API"
    : "Preview API polyfill";
  document.documentElement.classList.add(
    "blur-image-previews",
    "image-preview-css-transition",
  );
  if (previewImplementation.polyfill) {
    previewImplementation.polyfill.transitionsEnabled = true;
  }
  ({ images: records } = await loadPhotosManifest());
  renderResults(searchInput.value);
} catch (error) {
  console.error(error);
  imageResults.setAttribute("aria-busy", "false");
  imageResults.innerHTML =
    '<p class="empty-message">The image preview demo could not be loaded.</p>';
}
