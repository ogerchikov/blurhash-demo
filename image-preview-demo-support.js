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

export function initializeImagePreviewControls({
  formatSelect,
  implementationBadge,
  transitionControl,
  transitionInput,
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
  transitionInput.checked = polyfill?.transitionsEnabled ?? false;
  if (polyfill) {
    transitionInput.addEventListener("change", () => {
      polyfill.transitionsEnabled = transitionInput.checked;
      replay();
    });
  }

  const requestedFormat = new URL(window.location.href).searchParams.get(
    "preview",
  );
  if (
    requestedFormat
    && Array.from(formatSelect.options).some(
      (option) => option.value === requestedFormat,
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
