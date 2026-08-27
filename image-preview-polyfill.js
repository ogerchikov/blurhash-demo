(function installImagePreviewPolyfill() {
  "use strict";

  if (
    typeof HTMLImageElement === "undefined"
    || "previewSrc" in HTMLImageElement.prototype
  ) {
    return;
  }

  const states = new WeakMap();

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

  function restoreContent(image, state) {
    if (!state.previewVisible) {
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

    state.previewVisible = false;
  }

  function showPreview(image, state, previewUrl) {
    if (state.previewVisible) {
      image.style.setProperty("content", cssUrl(previewUrl), "important");
      return;
    }

    state.previousContent = image.style.getPropertyValue("content");
    state.previousContentPriority = image.style.getPropertyPriority("content");
    image.style.setProperty("content", cssUrl(previewUrl), "important");
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
      previewVisible: false,
      previousContent: "",
      previousContentPriority: "",
    };

    image.addEventListener("load", () => {
      state.finalReady = true;
      state.version += 1;
      restoreContent(image, state);
    });

    states.set(image, state);
    return state;
  }

  function updateImage(image) {
    const state = getState(image);
    const version = state.version + 1;
    state.version = version;
    restoreContent(image, state);

    const hasFinalSource = image.hasAttribute("src") || image.hasAttribute("srcset");
    const previewUrl = resolveUrl(image.getAttribute("previewsrc"));
    state.finalReady = image.complete && image.naturalWidth > 0;

    if (!hasFinalSource || !previewUrl || state.finalReady) {
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
        showPreview(image, state, preview.currentSrc || previewUrl);
      }
    }, { once: true });

    preview.addEventListener("error", () => {
      if (state.version === version) {
        restoreContent(image, state);
      }
    }, { once: true });

    preview.src = previewUrl;
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

  window.ImagePreviewPolyfill = Object.freeze({ upgrade });
}());
