const previewVersions = new WeakMap();

export async function loadImagePreviewImplementation() {
  const hasNativePreviewSource =
    "previewSrc" in HTMLImageElement.prototype;

  if (!hasNativePreviewSource) {
    await import("./image-preview-polyfill.js");
  }

  return {
    hasNativePreviewSource,
    polyfill: hasNativePreviewSource
      ? null
      : window.ImagePreviewPolyfill ?? null,
  };
}

export async function createFreshImageObjectUrl(src) {
  const response = await fetch(src, { cache: "reload" });
  if (!response.ok) {
    throw new Error(`Image request failed with HTTP ${response.status}.`);
  }
  return URL.createObjectURL(await response.blob());
}

export function startImagePreviewLoading(image) {
  const frame = image.parentElement;
  previewVersions.set(image, (previewVersions.get(image) ?? 0) + 1);
  frame.classList.remove("image-preview-revealing");
  frame.classList.add("image-preview-loading");
}

export function cancelImagePreviewLoading(image) {
  const frame = image.parentElement;
  previewVersions.set(image, (previewVersions.get(image) ?? 0) + 1);
  frame.classList.remove(
    "image-preview-loading",
    "image-preview-revealing",
  );
}

export function finishImagePreviewLoading(image) {
  const frame = image.parentElement;
  const version = previewVersions.get(image);
  const root = document.documentElement;
  if (
    !root.classList.contains("blur-image-previews")
    || !root.classList.contains("image-preview-css-transition")
  ) {
    cancelImagePreviewLoading(image);
    return;
  }

  frame.classList.add("image-preview-revealing");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (previewVersions.get(image) !== version) {
        return;
      }

      frame.classList.remove("image-preview-loading");
      const finishReveal = () => {
        frame.classList.remove("image-preview-revealing");
      };
      image.addEventListener("transitionend", finishReveal, { once: true });
      image.addEventListener("transitioncancel", finishReveal, { once: true });
    });
  });
}

export function initializeImagePreviewControls({
  formatSelect,
  implementationBadge,
  transitionControl,
  transitionInput,
  blurControl,
  blurInput,
  hasNativePreviewSource,
  polyfill,
  replay,
}) {
  implementationBadge.textContent =
    hasNativePreviewSource ? "Native API" : "Polyfill";
  implementationBadge.title = hasNativePreviewSource
    ? "The browser exposed previewSrc at page startup."
    : "The browser did not expose previewSrc at page startup.";

  transitionControl.hidden = !polyfill;
  blurControl.hidden = !polyfill;
  transitionInput.checked = polyfill?.transitionsEnabled ?? false;
  blurInput.checked = true;
  if (polyfill) {
    polyfill.transitionsEnabled = true;
    transitionInput.checked = true;
    document.documentElement.classList.add("blur-image-previews");

    transitionInput.addEventListener("change", () => {
      polyfill.transitionsEnabled = transitionInput.checked;
      document.documentElement.classList.toggle(
        "image-preview-css-transition",
        !transitionInput.checked,
      );
      replay();
    });
    blurInput.addEventListener("change", () => {
      document.documentElement.classList.toggle(
        "blur-image-previews",
        blurInput.checked,
      );
    });
  }

  const requestedFormat = new URL(window.location.href).searchParams.get(
    "preview",
  );
  if (
    requestedFormat
    && Array.from(formatSelect.options).some(
      (option) => option.value === requestedFormat && !option.disabled,
    )
  ) {
    formatSelect.value = requestedFormat;
  }

  formatSelect.addEventListener("change", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("preview", formatSelect.value);
    window.history.replaceState(null, "", url);
    replay();
  });
}
