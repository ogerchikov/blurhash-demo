# blurhash-demo

A browser-based demo that compares multiple image placeholder techniques side by side:

- BlurHash
- ThumbHash
- Blur-up LQIP
- Inline AVIF
- Color placeholder
- Shimmer placeholder

The demo supports per-image comparison rows, basic benchmark metrics,
and a separate demo of the proposed native image-preview API.

## Project Structure

- `index.html`: Main comparison page with interactive cards and per-image rows table.
- `app.js`: Runtime logic for placeholder generation, manifest loading, row selection, and benchmarks.
- `base.css`: Shared page, typography, and utility-link styles.
- `styles.css`: Main comparison and comparison-table styles.
- `gallery.css`: Grid and single-image gallery styles.
- `comparison-table.html`: Dedicated table page for comparing original and placeholders.
- `comparison-table.js`: Data loading and placeholder rendering for the comparison table page.
- `native-image-preview.html`: Native `previewsrc` / `HTMLImageElement.previewSrc` API demo.
- `native-image-preview.js`: Demo setup, implementation status, and final-image reload behavior.
- `single-image-preview.html`: Single-image gallery with previous and next controls.
- `single-image-preview.js`: Single-image navigation and preview playback.
- `progressive-images/`: Checked-in progressive JPEG, PNG, AVIF, and JPEG XL gallery assets.
- `scripts/generate-progressive-demo-assets.mjs`: Regenerates the static progressive gallery assets.
- `scripts/setup-image-encoders.mjs`: Installs verified project-local AVIF and JPEG XL encoders.
- `benchmark.html`: Isolated `previewsrc` + `src` versus progressive-image benchmark.
- `benchmark.js`: Sequential clean-pass timing and structured result collection.
- `scripts/generate-benchmark-assets.mjs`: Generates the selectable codec matrix.
- `scripts/benchmark-server.mjs`: Static server with deterministic rate-limited image streaming.
- `scripts/run-benchmark.mjs`: Fresh-browser-context clean and visual benchmark runner.
- `image-preview-demo-support.js`: Shared native detection and conditional polyfill loading.
- `image-preview-polyfill.js`: Fallback implementation loaded only when the native API is unavailable.
- `precompute.html`: Browser-only precompute tool page.
- `precompute-browser.js`: Computes placeholder data in-browser and exports `photos.json`.
- `photos.json`: Precomputed manifest consumed by the app.
- `scripts/precompute-placeholders.mjs`: Node precompute script for generating `photos.json`.
- `images/`: Source images used by the demo.

## What The Main Page Shows

### Top Comparison Cards

Six techniques are rendered with synchronized replay:

- BlurHash
- ThumbHash
- Blur-up LQIP
- Inline AVIF
- Color placeholder
- Shimmer placeholder

Each card displays metrics:

- Payload
- Decode time
- First paint time
- Main-thread blocking estimate
- Similarity score (placeholder vs source)
- Time when full image is shown

### Per-Image Rows Table

The section below the cards renders one row per image found in `./images` (or from `photos.json` fallback):

- Original image
- BlurHash preview
- ThumbHash preview
- LQIP preview
- AVIF preview
- Color preview
- Shimmer preview
- Benchmarks at a glance (first paint, block estimate, similarity)

Rows are clickable: selecting a row updates the top comparison cards to that image.

## Data Source

The app requires `photos.json` and uses its `images` records for image discovery and placeholder values.
Both comparison pages validate the complete manifest at startup and report the exact invalid field before rendering data.

## Running The Demo

Serve the folder using any static web server, then open `index.html`.

Examples:

```powershell
# From repo root
npx serve .
```

or

```powershell
python -m http.server 8080
```

Then navigate to the local URL shown by your server.

### Native Image Preview Gallery

Open `native-image-preview.html` for a responsive gallery of every image listed in `photos.json`.
Each card preserves the photo dimensions from the manifest and uses a real `<img>` with
`previewsrc`. A labeled selector applies one preview format to the entire gallery:

- BlurHash using `data:image/blurhash,...`
- ThumbHash using `data:image/thumbhash;base64,...`
- LQIP / blur-up using the manifest's inline image data URL
- Inline AVIF using the manifest's AVIF preview data URL

Changing the format automatically replays the gallery, and **Replay loading** repeats the selected
preview by fetching the original image URL with reload cache semantics and displaying the response
through a temporary object URL. This keeps replay requests fresh without modifying the image URL.
The initial load assigns `previewsrc` and `src` together, as a production page would. The page
prefers a native `HTMLImageElement.previewSrc` implementation and loads
`image-preview-polyfill.js` only when the native API is absent.

The preview-engine badge reports **Native API** when `previewSrc` exists at page startup and
**Polyfill** otherwise. Support is checked before the fallback can install its own `previewSrc`
property. When the polyfill is active, the **Polyfill transition** checkbox toggles its opt-in
`ImagePreviewPolyfill.transitionsEnabled` flag and replays the gallery. The gallery app owns its
optional blur treatment entirely in CSS. It uses the transition scope already exposed by the
polyfill, adds `image-preview-loading` before assigning `previewsrc` and `src`, and removes that
class when the final image loads. It also applies `filter: blur(...)` to
`::view-transition-old(*)`. Its app-owned animation is appended to the polyfill's default fade
and blend animations, moving the old snapshot from blurred at `scale(1.04)` to sharp at
`scale(1)` while the new final-image snapshot appears. No blur behavior or application-specific
state is added to the polyfill. When polyfill transitions are disabled, the final image's `load`
handler keeps the existing `<img>` blurred for a committed frame, then removes the loading state
on the following frame. CSS transitions its `filter` and `transform` to the sharp, unscaled state.
This fallback creates no additional DOM elements.

The same selector also provides **Progressive JPEG**, **Adam7 interlaced PNG**,
**Progressive AVIF**, and **Progressive JPEG XL** modes. These
modes load one checked-in file directly, without `previewsrc`, blur, transitions, or an
intermediate blob fetch, allowing the browser to paint incremental scans or passes when its
network delivery and decoder support them. Replay uses a unique query parameter so GitHub Pages
can serve the static file while bypassing the browser's prior image entry. AVIF and JPEG XL
remain selectable when a browser cannot decode them so the gallery reports that compatibility
failure explicitly instead of substituting another codec.

Open `single-image-preview.html` for the same preview-format and transition controls with one
photo displayed at a time. Use **Previous** and **Next** to browse the manifest; the controls are
disabled at the beginning and end of the list.

On Windows x64, install the pinned project-local encoders and regenerate the checked-in
progressive gallery files after changing source images:

```powershell
npm run tools:setup-image-encoders
npm run demo:generate-progressive
```

The setup script verifies the release SHA-256 digests before extracting libavif 1.4.2 and libjxl
0.12.0 under the ignored `.image-tools/` directory. On other platforms, install `avifenc` and
`cjxl` on `PATH`, or provide `AVIFENC_PATH` and `CJXL_PATH`. The generator limits the longest edge
to 960 pixels and writes progressive JPEG and AVIF at quality 82, lossless Adam7 PNG, and
progressive JPEG XL at quality 82. These production defaults are intended for visual exploration
and are not byte- or quality-matched benchmark encodes.

### Progressive Image Benchmark

Generate the checked static asset matrix:

```powershell
npm install
npm run tools:setup-image-encoders
npm run demo:generate-progressive
npm run benchmark:generate
```

The generated `benchmark-assets/` directory and shared `progressive-images/` directory are tracked
so `benchmark.html` works when the repository is published with GitHub Pages. The page independently
selects:

- the source image;
- JPEG, PNG, WebP, AVIF, or JPEG XL for `previewsrc`;
- JPEG, PNG, WebP, AVIF, or JPEG XL for the final `src`;
- progressive JPEG, Adam7 PNG, progressive AVIF, or progressive JPEG XL;
- delivery mode, plus transfer rate and latency when controlled streaming is available.

JPEG, PNG, WebP, AVIF, and JPEG XL preview choices are available as both external files and inline
Base64 data URLs. JPEG XL compatibility depends on the browser and its enabled features; a decode
failure is reported rather than replaced with another codec. Configured bytes include the complete
inline data URL and its Base64 expansion. Observed body bytes come from Resource Timing, so an
inline preview adds no separate response body; its payload is reported separately as
**Inline preview payload**.

Run `npm run tools:setup-image-encoders` first on Windows x64, or install `avifenc` and `cjxl`
on `PATH`. Missing encoders remain visible in the generated manifest as unavailable; no other
codec is silently substituted. JPEG and PNG progressive assets are generated by Sharp, while
AVIF and JPEG XL use the verified project-local tools.

The **Auto-detect** delivery setting uses the controlled endpoint when available and otherwise
loads cache-busted static URLs directly. GitHub Pages therefore selects direct delivery
automatically. In direct mode, bandwidth and latency controls are disabled because the browser,
network, and GitHub CDN determine them. Configured and observed byte metrics, decode timing, and
final-image timing remain available.

For locally controlled delivery, start:

```powershell
npm run benchmark:serve
```

Then open `http://127.0.0.1:8080/benchmark.html`. The interactive page runs the preview and
progressive strategies sequentially to avoid direct
CPU and network contention. It records Resource Timing, configured and observed bytes, image
load, `decode()`, a two-animation-frame paint approximation, long tasks, compatibility, and
opt-in polyfill preview lifecycle marks. The polyfill marks are diagnostics for the polyfill,
not estimates of native `previewSrc` behavior. The controlled server shares the selected
bandwidth across the preview and final requests in one run. Codec choices use visible production
defaults and are not implicitly byte- or quality-matched across different codecs. Sequential and
progressive variants of the same codec use matching dimensions, normalized source pixels, encoder,
and quality settings. Progressive organization can still be slightly larger or smaller because
scan/layer structure changes entropy coding. For loading-strategy comparisons, select the same
final and progressive codec.

For repeatable clean passes, install Playwright's Chromium once and run:

```powershell
npx playwright install chromium
npm run benchmark:run -- --repeats=20 --image=portrait-closeup --preview=avif --final=webp --progressive=jpeg
```

To benchmark a deployed GitHub Pages site with browser-level network emulation:

```powershell
$env:BENCHMARK_BASE_URL = "https://YOUR-ACCOUNT.github.io/blurhash-demo"
npm run benchmark:run -- --delivery=direct --repeats=20 --rateKbps=1500 --latencyMs=100
```

Direct Playwright runs apply shared Chromium/CDP network emulation by default. Pass
`--emulateNetwork=false` to measure the natural connection and CDN behavior instead.

Results are written to `benchmark-results/clean-results.json`. Add `--visual` for a separate
10 fps filmstrip pass. Visual runs are explicitly labeled as perturbed and must not be used for
CPU comparisons. The runner calculates first-visible, useful, and final visual thresholds from
image-only frames using normalized pixel differences. Raw frames and samples remain available
for alternate SSIM-based analysis. The platform exposes no reliable intermediate-scan paint
event.

## Precompute `photos.json`

You can generate precomputed placeholder data in two ways.

### Option A: Browser Tool (recommended for this demo)

1. Open `precompute.html`
2. Scan or manually list files in `images/`
3. Generate manifest
4. Download or copy output into `photos.json`

Generated fields include:

- `blurhash`
- `thumbhashBase64`
- `lqip` object (`mimeType`, `width`, `height`, `dataUrl`)
- `avif` object (`mimeType`, `width`, `height`, `dataUrl`)
- `color` object (`r`, `g`, `b`, `hex`)
- `shimmer` object (`mimeType`, `width`, `height`, `dataUrl`)
- `bytes` metrics

### Option B: Node Script

Run:

```powershell
node ./scripts/precompute-placeholders.mjs
```

This writes `photos.json` from files in `images/`.

## Notes And Behavior

- ThumbHash input is downscaled for encoding constraints.
- Shimmer is intentionally subtle and slower to resemble production usage.
- Reduced motion preference is respected for shimmer and scoped View Transitions.
- Similarity metric is a simple RGB mean-absolute-difference based percentage.

## Troubleshooting

- If no images appear, verify your server root includes `photos.json`, each record has a valid `src`, and the referenced image files exist.
- If placeholders look stale after updates, regenerate `photos.json` and hard refresh.