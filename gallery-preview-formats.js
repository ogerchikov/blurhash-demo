export const galleryPreviewFormats = {
  blurhash: {
    label: "BlurHash",
    getPreview(record) {
      return record.blurhash
        ? `data:image/blurhash,${encodeURIComponent(record.blurhash)}`
        : "";
    },
  },
  thumbhash: {
    label: "ThumbHash",
    getPreview(record) {
      return record.thumbhashBase64
        ? `data:image/thumbhash;base64,${record.thumbhashBase64}`
        : "";
    },
  },
  lqip: {
    label: "LQIP / blur-up",
    getPreview(record) {
      return record.lqip?.dataUrl || "";
    },
  },
  avif: {
    label: "Inline AVIF",
    getPreview(record) {
      return record.avif?.dataUrl || "";
    },
  },
};
