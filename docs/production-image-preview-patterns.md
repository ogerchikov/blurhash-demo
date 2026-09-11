# Production image preview patterns

Date: 2026-09-06

This report summarizes image-preview techniques verified on real sites or in
production application source. A site is listed as a live example only when a
specific public page was observed exercising the technique. Source-level
examples are listed separately when no stable, public demonstration URL was
verified.

## Live, verified examples

| Site and demonstration URL | Framework or library | Preview format | Usage pattern |
| --- | --- | --- | --- |
| [Unsplash](https://unsplash.com/) | Custom image component | Inline base64-encoded 8x8 BMP | The final `<img>` has the preview as its CSS `background-image`. The selected `src` or `srcset` image paints over the background when available. |
| [Next.js image placeholder demo](https://image-component.nextjs.gallery/placeholder) | Next.js `<Image>` | Tiny JPEG embedded in an inline SVG | The generated SVG is the CSS background of the final `<img>`. Next.js removes the background after the final image loads and decoding settles. |
| [Next.js color demo](https://image-component.nextjs.gallery/color) | Next.js `<Image>` | Blurred 1x1 GIF | The GIF is the final `<img>` element's CSS background. It provides a color placeholder rather than a preview of recognizable image content. |
| [Next.js shimmer demo](https://image-component.nextjs.gallery/shimmer) | Next.js `<Image>` | Animated SVG | The SVG is a CSS background loading indicator on the final `<img>`, not a preview representation of the final image. |
| [Cico Jazz Orchester hero](https://cicojazz.de/#hero) | Cloudinary HTML SDK (`@cloudinary/html`) | Cloudinary predominant-color transformation | Cloudinary's `placeholder({ mode: "predominant-color" })` plugin first assigns a transformed placeholder URL to one `<img>`, preloads the final responsive image, and then replaces the element's `src`. |
| [Cloudinary React SDK training tool](https://cloudinary-training.github.io/cld-intro-react-sdk-training-tool/#/placeholder) | React and `@cloudinary/react` `AdvancedImage` | Cloudinary blurred-image transformation | The example applies `placeholder({ mode: "blur" })`. Press **Run** in the embedded editor to execute it. The plugin replaces the source of one image rather than stacking two image elements. |
| [Minds post](https://www.minds.com/newsfeed/1565424642032668690) | Minds web client | BlurHash decoded to canvas | A decoded canvas is displayed with the final `<img>`. After the image loads, the canvas fades out over approximately 300 ms and is removed. |

Supporting source:

- [Next.js placeholder demo source](https://github.com/vercel/next.js/blob/canary/examples/image-component/app/placeholder/page.tsx)
- [Cloudinary HTML placeholder plugin](https://github.com/cloudinary/frontend-frameworks/blob/9a05f3571fec1a3d0ecc66a899db1833d326c094/packages/html/src/plugins/placeholder.ts#L10-L108)
- [Cico Jazz Cloudinary setup](https://github.com/LeoGanz/CJO_Website/blob/64731c8ba37b664aa2dc57de08c534357f6297c3/src/scripts/images.ts#L24-L38)
- [Cloudinary training example](https://github.com/cloudinary-training/cld-intro-react-sdk-training-tool/blob/29006ba52bdc2897cbd5af5999bae7b6f0cac4ee/src/components/PlaceholderPlugin.js#L6-L19)

## Production-source examples without a stable public demonstration URL

These applications contain production preview implementations, but the
relevant UI may require authentication, a configured server, uploaded media,
or a temporary deployment. Their inclusion does not claim that every image in
the product uses the technique.

| Product | Framework or library | Preview format | Usage pattern |
| --- | --- | --- | --- |
| Mastodon | React | BlurHash decoded to canvas | Some media components stack a decoded canvas with the final image and hide the canvas after loading. The path used depends on the component and server configuration. |
| Misskey | Vue | BlurHash decoded in a worker | A worker decodes the hash into a canvas. The canvas is replaced after the final image completes `decode()`; user preferences can control use of the preview. |
| Nextcloud Photos | Vue | BlurHash, small thumbnail, and larger preview | The image component can progress through several layers: BlurHash, a small thumbnail, a larger preview, and the final image. |
| Nextcloud Talk | Vue | BlurHash decoded to canvas | A canvas remains visible while a server-generated file preview loads. |
| Jellyfin Vue | Vue | BlurHash decoded in a worker | The decoded canvas occupies the image component's placeholder slot until the final image is ready. |
| Jesus Film Next Steps | Next.js | BlurHash converted to a WebP data URL | The application converts BlurHash output to WebP and supplies it to Next.js as `blurDataURL`; Next.js manages display and removal of the placeholder. |

Supporting source:

- [Mastodon BlurHash component](https://github.com/mastodon/mastodon/blob/main/app/javascript/mastodon/components/blurhash.tsx)
- [Mastodon media gallery](https://github.com/mastodon/mastodon/blob/main/app/javascript/mastodon/components/media_gallery.jsx)

## Reference demonstrations

Reference projects demonstrate decoding formats but should not be described as
production image-loading examples:

| Demonstration | Format | Observed behavior |
| --- | --- | --- |
| [BlurHash](https://blurha.sh/) | BlurHash | The hero stacks decoded canvases and images, but cycles image opacity as a demonstration rather than handing off when an image finishes loading. |
| [ThumbHash](https://evanw.github.io/thumbhash/) | ThumbHash | The comparison page renders decoded output as generated PNG data URLs or canvases. It does not demonstrate a preview-to-final loading lifecycle. |

## Recurring implementation patterns

1. **CSS background on the final `<img>`:** Unsplash and the Next.js demos avoid a second preview element. Final image content covers the background, and framework code may later remove it.
2. **Source replacement on one `<img>`:** Cloudinary first assigns a transformed placeholder URL, preloads the final resource, and replaces `src`.
3. **Decoded canvas stacked with the final image:** Minds, Mastodon, Misskey, Nextcloud, and Jellyfin decode BlurHash into a separate canvas and coordinate its removal with image loading or decoding.
4. **Compact hash converted to a conventional image URL:** Jesus Film Next Steps converts BlurHash to a WebP data URL and delegates the lifecycle to Next.js.
5. **Non-content loading placeholders:** Dominant-color and shimmer backgrounds cover the same loading period but do not provide recognizable preview content.

Across these patterns, custom implementations must coordinate sizing,
decoding, source changes, loading or `decode()` completion, transitions,
cancellation, and cleanup. The duplicated lifecycle logic is separate from the
preview format itself.

## Claims not established by this review

- An API response containing a `blur_hash` field does not prove that the
  corresponding website renders BlurHash.
- A package dependency does not prove that a deployed page exercises its
  placeholder feature.
- No per-image preview was verified on the Pixelfed marketing site.
- Responsive images were observed on Shopify and Cloudinary pages, but their
  use did not establish a loading-preview implementation.
- No live official Cloudinary-owned product page was verified as directly
  executing the exact HTML placeholder plugin. The Cloudinary training site is
  an interactive SDK example.
