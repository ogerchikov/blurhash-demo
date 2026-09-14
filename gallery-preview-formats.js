export const galleryPreviewFormats = {
  blurhash: {
    getPreview(record) {
      return `data:image/blurhash,${encodeURIComponent(record.blurhash)}`;
    },
  },
  thumbhash: {
    getPreview(record) {
      return `data:image/thumbhash;base64,${record.thumbhashBase64}`;
    },
  },
  lqip: {
    getPreview(record) {
      return record.lqip.dataUrl;
    },
  },
  avif: {
    getPreview(record) {
      return record.avif.dataUrl;
    },
  },
};
