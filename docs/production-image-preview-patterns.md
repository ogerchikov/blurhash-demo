# Production image preview replacement patterns

Date: 2026-08-20

This is a reference for how real sites usually swap a preview image or placeholder with the final image. The goal is to capture the pattern rather than a single library-specific implementation.

## Summary table

| Format | Typical real-world usage | Major sites / references | Replacement pattern | Animation |
|---|---|---|---|---|
| BlurHash | Social feeds, media-heavy apps, feed cards | Mastodon, Pixelfed, BlurHash project | Decode hash to a tiny bitmap and replace the placeholder once the real image loads | Fade / crossfade, or canvas swap |
| ThumbHash | App-level image previews, compact binary previews | ThumbHash demo, app pipelines | Decode compact hash into a tiny bitmap and swap to final image | Fade or instant replace |
| LQIP / blur-up | Most CMS and CDN-driven sites | Unsplash, Next.js image demo, Cloudinary examples | Use a tiny blurred JPEG/WebP as the first image; replace with full image on load | Blur-to-sharp or fade |
| AVIF / progressive delivery | Modern image CDN pipelines | Shopify, CNN-style publishers, Cloudinary-hosted media | Serve AVIF/WebP/JPEG using `<picture>` and lazy loading; placeholder is usually a color or blur-up | Fade or no explicit transition |
| Color placeholder | Feed layouts, cards, skeleton-heavy pages | Next.js examples, large commerce sites | Show dominant color block while image is loading, then replace | Simple fade |
| Shimmer / skeleton | Feeds, dashboard cards, commerce grids | Next.js examples, news sites, dashboards | Show shimmering background or skeleton while the real image is loading | Animated shimmer |

---

## 1) BlurHash

### Source site URL(s)
- Mastodon public feed/media pages: https://mastodon.social/
- Pixelfed image feeds: https://pixelfed.org/
- BlurHash project reference page: https://blurha.sh/
- Implementation reference: https://github.com/woltapp/blurhash

### Observed markup pattern used to preview and replace
Source site for this pattern: Mastodon and Pixelfed use the same fixed-slot, decoded-preview approach for media cards; the pattern is also documented on the BlurHash project page.

The site keeps a fixed media box, renders a decoded BlurHash preview in a canvas or image slot, then swaps in the final image once it loads.

```html
<div class="media" style="aspect-ratio: 4 / 3;">
  <canvas class="preview"></canvas>
  <img class="full" src="/images/photo.jpg" alt="photo" hidden />
</div>
```

```js
const pixels = decodeBlurHash(blurhash, 32, 32);
ctx.putImageData(new ImageData(pixels, 32, 32), 0, 0);

fullImage.addEventListener('load', () => {
  fullImage.classList.add('loaded');
  previewCanvas.style.opacity = '0';
  fullImage.hidden = false;
});
```

### Animation on replacement
- fade from placeholder to final image
- blur-to-sharp transition
- canvas replaced by image without layout shift

### CSS positioning and animation
This is the same fixed-slot pattern used in the Mastodon/Pixelfed media cards and the BlurHash project examples:

```css
.media {
  position: relative;
  overflow: hidden;
  aspect-ratio: 4 / 3;
}

.media .preview,
.media .full {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media .preview {
  opacity: 1;
  filter: blur(8px);
  transition: opacity 260ms ease, filter 260ms ease;
}

.media .full {
  opacity: 0;
  filter: blur(8px);
  transition: opacity 260ms ease, filter 260ms ease;
}

.media .full.loaded {
  opacity: 1;
  filter: blur(0);
}
```

---

## 2) ThumbHash

### Source site URL(s)
- ThumbHash official demo / reference page: https://evanw.github.io/thumbhash/
- ThumbHash project examples: https://github.com/evanw/thumbhash

### Observed markup pattern used to preview and replace
Source site for this pattern: the ThumbHash demo page shows the same fixed-frame decode-and-replace pattern; it is the clearest public example of the technique.

The app keeps a fixed-size frame, decodes the ThumbHash to an RGBA bitmap, and swaps the bitmap for the real image when the full asset loads.

```html
<div class="thumb-media">
  <canvas class="preview"></canvas>
  <img class="real" src="/images/large.jpg" alt="" />
</div>
```

```js
const thumb = base64ToBytes(thumbhashBase64);
const rgba = thumbHashToRGBA(thumb);
const imageData = new ImageData(new Uint8ClampedArray(rgba), 100, 100);
previewCtx.putImageData(imageData, 0, 0);

realImg.onload = () => {
  realImg.classList.add('loaded');
  previewCanvas.style.opacity = 0;
};
```

### Animation on replacement
- usually opacity fade
- sometimes no explicit transition

### CSS positioning and animation
This follows the ThumbHash demo pattern: fixed frame, decoded bitmap, then final image fades in.

```css
.thumb-media {
  position: relative;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 1 / 1;
}

.thumb-media canvas,
.thumb-media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-media canvas {
  opacity: 1;
  transition: opacity 220ms ease;
}

.thumb-media img {
  opacity: 0;
  transition: opacity 220ms ease;
}

.thumb-media img.loaded {
  opacity: 1;
}
```

---

## 3) LQIP / blur-up

### Source site URL(s)
- Unsplash image cards and feed pages: https://unsplash.com/
- Next.js image placeholder demo: https://image-component.nextjs.gallery/placeholder
- Cloudinary blur-up and progressive image examples: https://cloudinary.com/documentation/image_optimization

### Observed markup pattern used to preview and replace
Source site for this pattern: this is the standard blur-up pattern used by Unsplash and demonstrated in the Next.js image placeholder gallery; the same pattern is common across CMS and CDN-driven image sites.

The site uses a tiny blurred preview image in the same slot as the final image, then swaps the final image in on load.

```html
<img class="preview" src="/images/photo-blur.jpg" alt="photo" />
<img class="full" src="/images/photo.jpg" alt="photo" loading="lazy" />
```

```js
const full = document.querySelector('.full');
const preview = document.querySelector('.preview');

full.addEventListener('load', () => {
  full.classList.add('loaded');
  preview.style.opacity = '0';
});
```

### Animation on replacement
- blur-to-sharp effect
- fade opacity transition
- often a slight scale-up on the preview before the final image becomes visible

### CSS positioning and animation
This matches the Unsplash + Next.js blur-up examples: preview and full image share the same container and the final image fades in after load.

```css
.preview,
.full {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview {
  filter: blur(12px);
  transform: scale(1.04);
  transition: opacity 260ms ease, filter 260ms ease;
}

.full {
  opacity: 0;
  filter: blur(12px);
  transition: opacity 260ms ease, filter 260ms ease;
}

.full.loaded {
  opacity: 1;
  filter: blur(0);
}
```

---

## 4) AVIF / progressive format delivery

### Source site URL(s)
- Shopify storefront and product media: https://shopify.com/
- Cloudinary product and media optimization examples: https://cloudinary.com/
- MDN image-format reference: https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types

### Observed markup pattern used to preview and replace
Source site for this pattern: Shopify and Cloudinary media examples both use the same `<picture>` + fallback + placeholder approach for progressive image delivery.

AVIF is served via a `<picture>` source chain, usually together with a temporary placeholder or a blur-up layer while the browser resolves the best source.

```html
<picture>
  <source srcset="/images/photo.avif" type="image/avif" />
  <source srcset="/images/photo.webp" type="image/webp" />
  <img src="/images/photo.jpg" alt="photo" />
</picture>
```

```html
<div class="media">
  <div class="placeholder"></div>
  <picture>
    <source srcset="/images/photo.avif" type="image/avif" />
    <source srcset="/images/photo.webp" type="image/webp" />
    <img src="/images/photo.jpg" alt="photo" />
  </picture>
</div>
```

```js
const img = document.querySelector('.media img');
const placeholder = document.querySelector('.media .placeholder');

img.addEventListener('load', () => {
  img.classList.add('loaded');
  placeholder.style.opacity = '0';
});
```

### Animation on replacement
- usually a subtle fade
- sometimes no explicit transition

### CSS positioning and animation
This follows the Shopify and Cloudinary progressive-delivery pattern: the placeholder sits in the same media box and the chosen AVIF/WebP/JPEG source fades in.

```css
.media {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.media .placeholder,
.media picture,
.media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.media .placeholder {
  background: linear-gradient(135deg, #c7d2fe, #f5d0fe);
  opacity: 1;
  transition: opacity 220ms ease;
}

.media img {
  opacity: 0;
  filter: blur(8px);
  transition: opacity 220ms ease, filter 220ms ease;
}

.media img.loaded {
  opacity: 1;
  filter: blur(0);
}
```

---

## 5) Dominant color placeholder

### Source site URL(s)
- Next.js color placeholder demo: https://image-component.nextjs.gallery/color
- Major card-based commerce and media layouts that use solid-color previews before final media loads

### Observed markup pattern used to preview and replace
Source site for this pattern: the Next.js color placeholder demo uses the same swatch-then-fade pattern, and it is common across card-based commerce and media layouts.

The page reserves a media box, shows a solid-color swatch, and fades in the final image when it becomes available.

```html
<div class="card-image">
  <div class="swatch" style="background:#c99d7c"></div>
  <img src="/images/large.jpg" alt="" />
</div>
```

```css
.swatch {
  position: absolute;
  inset: 0;
  background: #c99d7c;
}

.card-image img {
  opacity: 0;
  transition: opacity 200ms ease;
}

.card-image img.loaded {
  opacity: 1;
}
```

```js
const img = document.querySelector('.card-image img');
const swatch = document.querySelector('.card-image .swatch');

img.addEventListener('load', () => {
  img.classList.add('loaded');
  swatch.style.opacity = '0';
});
```

### Animation on replacement
- simple fade
- sometimes instant replace with no animation

### CSS positioning and animation
This is the same swatch-then-fade pattern used in the Next.js color-placeholder demo.

```css
.card-image {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.card-image .swatch,
.card-image img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-image .swatch {
  background: #c99d7c;
}

.card-image img {
  opacity: 0;
  transition: opacity 200ms ease;
}

.card-image img.loaded {
  opacity: 1;
}
```

---

## 6) Shimmer / skeleton placeholder

### Source site URL(s)
- Next.js shimmer placeholder demo: https://image-component.nextjs.gallery/shimmer
- Feed-heavy news and ecommerce sites that use skeleton/image-card loading states

### Observed markup pattern used to preview and replace
Source site for this pattern: the Next.js shimmer demo shows this exact skeleton/gradient loading pattern, and it is widely used in feed-heavy news and ecommerce interfaces.

The site reserves the media area, renders a shimmer skeleton or gradient block, and then fades in the final image when the asset is ready.

```html
<div class="media skeleton">
  <img src="/images/large.jpg" alt="" />
</div>
```

```js
const media = document.querySelector('.media');
const img = document.querySelector('.media img');

img.addEventListener('load', () => {
  media.classList.remove('skeleton');
  img.classList.add('loaded');
});
```

```css
.skeleton {
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg, #f0f0f0 25%, #e5e7eb 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite linear;
}
```

### Animation on replacement
- animated shimmer while loading
- final image fades in after loading

### CSS positioning and animation
This is the same skeleton/gradient approach shown in the Next.js shimmer demo and used in feed-heavy news and ecommerce interfaces.

```css
.media {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.media.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e5e7eb 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite linear;
}

.media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 220ms ease;
}

.media img.loaded {
  opacity: 1;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## Shared production pattern across all formats

The real site pattern is usually not format-specific. It is this structure:

1. Reserve a fixed-size container.
2. Set a stable `aspect-ratio` or fixed height.
3. Show a cheap placeholder immediately.
4. Load the full image in the background.
5. Replace the placeholder with the final image.
6. Fade, blur, or transform the image for a smoother transition.

Common HTML/CSS pattern:

```html
<div class="media" style="aspect-ratio: 16 / 9;">
  <img class="preview" src="tiny-preview.jpg" alt="" />
  <img class="final" src="large.jpg" alt="" loading="lazy" />
</div>
```

```css
.media {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.preview,
.final {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview {
  filter: blur(10px);
  transform: scale(1.04);
}

.final {
  opacity: 0;
  transition: opacity 250ms ease, filter 250ms ease;
  filter: blur(0);
}

.final.loaded {
  opacity: 1;
}
```

---

## Recommendation for this demo

If the goal is to compare real production techniques, the best practical set is:

- BlurHash
- ThumbHash
- LQIP / blur-up
- AVIF picture-source delivery
- Dominant-color placeholder
- Shimmer placeholder

That set covers the main actual replacement patterns used on the web today.
