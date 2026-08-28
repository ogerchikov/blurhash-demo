# blurhash-demo

A browser-based demo that compares multiple image placeholder techniques side by side:

- BlurHash
- ThumbHash
- Blur-up LQIP
- Inline AVIF
- Color placeholder
- Shimmer placeholder

The demo supports per-image comparison rows, runtime fallback generation, basic benchmark metrics,
and a separate demo of the proposed native image-preview API.

## Project Structure

- `index.html`: Main comparison page with interactive cards and per-image rows table.
- `app.js`: Runtime logic for placeholder generation, manifest loading, row selection, and benchmarks.
- `styles.css`: Shared styles for cards, tables, placeholders, and transitions.
- `comparison-table.html`: Dedicated table page for comparing original and placeholders.
- `comparison-table.js`: Data loading and placeholder rendering for the comparison table page.
- `native-image-preview.html`: Native `previewsrc` / `HTMLImageElement.previewSrc` API demo.
- `native-image-preview.js`: Demo setup, implementation status, and final-image reload behavior.
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

## Data Source Priority

For image discovery, the app uses this order:

1. `./images/` directory listing (when the server exposes it)
2. `photos.json` image list
3. Default fallback image (`./images/beach.png`)

For per-image placeholder values:

- Uses `photos.json` values when available
- Falls back to runtime generation when values are missing

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

### Native Image Preview API Demo

Open `native-image-preview.html` to compare the supported standard preview resource forms:

- An external standard image URL supplied with the `previewsrc` attribute
- An inline JPEG data URL supplied through the `HTMLImageElement.previewSrc` property

The page detects `HTMLImageElement.prototype.previewSrc` before its image markup is parsed. Browsers
with the API use their native implementation; other browsers load `image-preview-polyfill.js`.

The page also compares BlurHash and ThumbHash in two adjacent `previewsrc` image columns. The
JavaScript side uses the same decoder libraries and `photos.json` values as the main comparison,
converts the decoded pixels to a PNG data URL, and supplies that raster through `previewsrc`. The
native side supplies encoded `application/x-blurhash` and `application/x-thumbhash` data URLs
directly through `previewsrc` without application-level decoding. Browsers with the native API
decode those formats natively; otherwise the polyfill imports the shared hash utilities, converts
the hash to an internal PNG data URL, and uses the same preview lifecycle as standard images. The
replay control holds previews before assigning the corresponding final image sources. This initial
API and polyfill demo intentionally excludes View Transition behavior.

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
- Reduced motion preference is respected for shimmer/fade behavior.
- Similarity metric is a simple RGB mean-absolute-difference based percentage.

## Troubleshooting

- If no images appear, verify your server root includes `images/` and `photos.json`.
- If folder listing is disabled, ensure `photos.json` contains `images[].src` entries.
- If placeholders look stale after updates, regenerate `photos.json` and hard refresh.