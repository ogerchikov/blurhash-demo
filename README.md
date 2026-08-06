# blurhash-demo

A browser-based demo that compares multiple image placeholder techniques side by side:

- BlurHash
- ThumbHash
- Blur-up LQIP
- Color placeholder
- Shimmer placeholder

The demo supports per-image comparison rows, runtime fallback generation, and basic benchmark metrics for each technique.

## Project Structure

- `index.html`: Main comparison page with interactive cards and per-image rows table.
- `app.js`: Runtime logic for placeholder generation, manifest loading, row selection, and benchmarks.
- `styles.css`: Shared styles for cards, tables, placeholders, and transitions.
- `comparison-table.html`: Dedicated table page for comparing original and placeholders.
- `comparison-table.js`: Data loading and placeholder rendering for the comparison table page.
- `precompute.html`: Browser-only precompute tool page.
- `precompute-browser.js`: Computes placeholder data in-browser and exports `photos.json`.
- `photos.json`: Precomputed manifest consumed by the app.
- `scripts/precompute-placeholders.mjs`: Node precompute script for generating `photos.json`.
- `images/`: Source images used by the demo.

## What The Main Page Shows

### Top Comparison Cards

Five techniques are rendered with synchronized replay:

- BlurHash
- ThumbHash
- Blur-up LQIP
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