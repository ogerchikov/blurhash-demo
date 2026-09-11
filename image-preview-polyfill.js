(function installImagePreviewPolyfill() {
  "use strict";

  if (
    typeof HTMLImageElement === "undefined"
    || "previewSrc" in HTMLImageElement.prototype
  ) {
    return;
  }

  const states = new WeakMap();
  const transitionScopeAttribute = "data-image-preview-transition-scope";
  let hashUtilsModule;
  let nextTransitionScopeId = 0;

  function installViewTransitionStyles() {
    if (
      typeof document.createElement("img").startViewTransition !== "function"
      || document.getElementById("image-preview-polyfill-view-transitions")
    ) {
      return;
    }

    const style = document.createElement("style");
    style.id = "image-preview-polyfill-view-transitions";
    style.textContent = `
      @layer image-preview-polyfill {
        [data-image-preview-transition-scope]::view-transition-group(*) {
          animation-duration: 2s;
          animation-timing-function: ease;
          animation-fill-mode: both;
        }

        [data-image-preview-transition-scope]::view-transition-old(*) {
          animation-name:
            image-preview-polyfill-fade-out,
            image-preview-polyfill-mix-blend-mode-plus-lighter;
        }

        [data-image-preview-transition-scope]::view-transition-new(*) {
          animation-name:
            image-preview-polyfill-fade-in,
            image-preview-polyfill-mix-blend-mode-plus-lighter;
        }

        [data-image-preview-transition-scope]::view-transition-image-pair(*) {
          isolation: isolate;
        }

        [data-image-preview-transition-scope]::view-transition-group(root),
        [data-image-preview-transition-scope]::view-transition-old(root),
        [data-image-preview-transition-scope]::view-transition-new(root) {
          animation: none;
        }

        @keyframes image-preview-polyfill-fade-in {
          from { opacity: 0; }
        }

        @keyframes image-preview-polyfill-fade-out {
          to { opacity: 0; }
        }

        @keyframes image-preview-polyfill-mix-blend-mode-plus-lighter {
          from { mix-blend-mode: plus-lighter; }
          to { mix-blend-mode: plus-lighter; }
        }

        /* This demo intentionally preserves the preview fade under reduced motion. */
        @media (prefers-reduced-motion: reduce) {
          [data-image-preview-transition-scope]::view-transition-group(*) {
            animation-duration: 2s;
          }
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function resolveUrl(value) {
    if (!value) {
      return "";
    }

    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return "";
    }
  }

  function cssUrl(url) {
    return `url(${JSON.stringify(url)})`;
  }

  function getBlurHashSize(image) {
    const sourceWidth = Number(image.getAttribute("width")) || image.width || 32;
    const sourceHeight = Number(image.getAttribute("height")) || image.height || 32;
    const scale = Math.min(1, 32 / Math.max(sourceWidth, sourceHeight));
    return {
      width: Math.max(1, Math.round(sourceWidth * scale)),
      height: Math.max(1, Math.round(sourceHeight * scale)),
    };
  }

  async function getDisplayablePreviewUrl(previewUrl, image) {
    if (previewUrl.startsWith("data:image/blurhash,")) {
      const hash = decodeURIComponent(previewUrl.slice(previewUrl.indexOf(",") + 1));
      const size = getBlurHashSize(image);
      hashUtilsModule ||= import("./image-hash-utils.js");
      const { blurhashToRasterDataUrl } = await hashUtilsModule;
      return blurhashToRasterDataUrl(hash, size.width, size.height);
    }

    if (previewUrl.startsWith("data:image/thumbhash;base64,")) {
      const encoded = previewUrl.slice(previewUrl.indexOf(",") + 1);
      hashUtilsModule ||= import("./image-hash-utils.js");
      const { base64ToBytes, thumbhashToRasterDataUrl } = await hashUtilsModule;
      return thumbhashToRasterDataUrl(base64ToBytes(encoded));
    }

    return previewUrl;
  }

  function restoreContent(image, state) {
    if (!state.contentOverridden) {
      return;
    }

    if (state.previousContent) {
      image.style.setProperty(
        "content",
        state.previousContent,
        state.previousContentPriority,
      );
    } else {
      image.style.removeProperty("content");
    }

    state.contentOverridden = false;
    state.previewVisible = false;
  }

  function clearTransitionScope(state, scopeToken) {
    const scope = state.transitionScope;
    if (
      scope
      && state.transitionScopeToken === scopeToken
      && scope.getAttribute(transitionScopeAttribute) === scopeToken
    ) {
      scope.removeAttribute(transitionScopeAttribute);
    }

    if (state.transitionScopeToken === scopeToken) {
      state.transitionScope = null;
      state.transitionScopeToken = "";
    }
  }

  function restoreViewTransitionName(image, state) {
    if (!state.viewTransitionNameOverridden) {
      return;
    }

    if (state.previousViewTransitionName) {
      image.style.setProperty(
        "view-transition-name",
        state.previousViewTransitionName,
        state.previousViewTransitionNamePriority,
      );
    } else {
      image.style.removeProperty("view-transition-name");
    }

    state.viewTransitionNameOverridden = false;
  }

  function cancelTransition(image, state) {
    const transition = state.transition;
    const scopeToken = state.transitionScopeToken;
    state.transition = null;
    clearTransitionScope(state, scopeToken);
    restoreViewTransitionName(image, state);
    if (transition && typeof transition.skipTransition === "function") {
      try {
        transition.skipTransition();
      } catch {
        // A transition that has just finished no longer needs cancellation.
      }
    }
  }

  function getTransitionScope(image) {
    const scope = image.parentElement;
    if (!scope || typeof scope.startViewTransition !== "function") {
      return null;
    }

    const style = getComputedStyle(scope);
    const bounds = scope.getBoundingClientRect();
    if (
      style.display === "none"
      || style.display === "contents"
      || style.visibility === "hidden"
      || bounds.width <= 0
      || bounds.height <= 0
    ) {
      return null;
    }

    return scope;
  }

  function revealFinalImage(image, state, version) {
    if (!state.previewVisible || state.version !== version) {
      return;
    }

    const finalUrl = image.currentSrc || image.src;
    const scope = getTransitionScope(image);
    if (!scope) {
      restoreContent(image, state);
      return;
    }

    cancelTransition(image, state);
    const scopeToken = `image-preview-${nextTransitionScopeId += 1}`;
    scope.setAttribute(transitionScopeAttribute, scopeToken);
    state.transitionScope = scope;
    state.transitionScopeToken = scopeToken;
    state.previousViewTransitionName = image.style.getPropertyValue(
      "view-transition-name",
    );
    state.previousViewTransitionNamePriority = image.style.getPropertyPriority(
      "view-transition-name",
    );
    image.style.setProperty("view-transition-name", scopeToken, "important");
    state.viewTransitionNameOverridden = true;

    let transition;
    try {
      // Chromium currently does not paint scoped snapshots rooted at a replaced img.
      transition = scope.startViewTransition(() => {
        if (state.version === version) {
          image.style.setProperty("content", cssUrl(finalUrl), "important");
          state.previewVisible = false;
        }
      });
    } catch {
      clearTransitionScope(state, scopeToken);
      restoreViewTransitionName(image, state);
      if (state.version === version) {
        restoreContent(image, state);
      }
      return;
    }

    state.transition = transition;
    image.dispatchEvent(new CustomEvent("imagepreviewtransitionstart", {
      detail: { transition },
    }));
    transition.ready.catch(() => {});
    transition.finished
      .catch(() => {})
      .finally(() => {
        if (
          state.transition === transition
          && state.version === version
        ) {
          state.transition = null;
          restoreContent(image, state);
          restoreViewTransitionName(image, state);
          clearTransitionScope(state, scopeToken);
        }
      });
  }

  function showPreview(image, state, previewUrl) {
    if (state.contentOverridden) {
      image.style.setProperty("content", cssUrl(previewUrl), "important");
      state.previewVisible = true;
      return;
    }

    state.previousContent = image.style.getPropertyValue("content");
    state.previousContentPriority = image.style.getPropertyPriority("content");
    image.style.setProperty("content", cssUrl(previewUrl), "important");
    state.contentOverridden = true;
    state.previewVisible = true;
  }

  function getState(image) {
    let state = states.get(image);
    if (state) {
      return state;
    }

    state = {
      version: 0,
      finalReady: image.complete && image.naturalWidth > 0,
      contentOverridden: false,
      previewVisible: false,
      previousContent: "",
      previousContentPriority: "",
      transition: null,
      transitionScope: null,
      transitionScopeToken: "",
      viewTransitionNameOverridden: false,
      previousViewTransitionName: "",
      previousViewTransitionNamePriority: "",
    };

    image.addEventListener("load", () => {
      state.finalReady = true;
      const version = state.version + 1;
      state.version = version;
      revealFinalImage(image, state, version);
    });

    states.set(image, state);
    return state;
  }

  async function updateImage(image) {
    const state = getState(image);
    const version = state.version + 1;
    state.version = version;
    cancelTransition(image, state);
    restoreContent(image, state);

    const previewUrl = resolveUrl(image.getAttribute("previewsrc"));
    state.finalReady = image.complete && image.naturalWidth > 0;

    if (!previewUrl || state.finalReady) {
      return;
    }

    let displayablePreviewUrl;
    try {
      displayablePreviewUrl = await getDisplayablePreviewUrl(previewUrl, image);
    } catch {
      return;
    }

    if (
      state.version !== version
      || state.finalReady
      || !image.isConnected
    ) {
      return;
    }

    const preview = new Image();
    preview.decoding = "async";
    preview.referrerPolicy = image.referrerPolicy;

    preview.addEventListener("load", () => {
      if (
        state.version === version
        && !state.finalReady
        && image.isConnected
      ) {
        showPreview(image, state, preview.currentSrc || displayablePreviewUrl);
      }
    }, { once: true });

    preview.addEventListener("error", () => {
      if (state.version === version) {
        restoreContent(image, state);
      }
    }, { once: true });

    preview.src = displayablePreviewUrl;
  }

  function upgrade(root) {
    if (
      root instanceof HTMLImageElement
      && (root.hasAttribute("previewsrc") || states.has(root))
    ) {
      updateImage(root);
    }

    if (root.querySelectorAll) {
      root.querySelectorAll("img").forEach((image) => {
        if (image.hasAttribute("previewsrc") || states.has(image)) {
          updateImage(image);
        }
      });
    }
  }

  Object.defineProperty(HTMLImageElement.prototype, "previewSrc", {
    configurable: true,
    enumerable: true,
    get() {
      return resolveUrl(this.getAttribute("previewsrc"));
    },
    set(value) {
      this.setAttribute("previewsrc", String(value));
    },
  });

  if (!("activeImagePreviewTransition" in HTMLImageElement.prototype)) {
    Object.defineProperty(
      HTMLImageElement.prototype,
      "activeImagePreviewTransition",
      {
        configurable: true,
        enumerable: true,
        get() {
          return states.get(this)?.transition || null;
        },
      },
    );
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        updateImage(record.target);
        continue;
      }

      record.addedNodes.forEach(upgrade);
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["previewsrc", "src", "srcset", "sizes"],
    childList: true,
    subtree: true,
  });

  upgrade(document);
  installViewTransitionStyles();

  window.ImagePreviewPolyfill = Object.freeze({ upgrade });
}());
