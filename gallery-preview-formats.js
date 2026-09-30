export const galleryPreviewFormats = {
  blurhash: {
    label: "BlurHash preview + original",
    strategy: "preview",
    getPreview(record) {
      return `data:image/blurhash,${encodeURIComponent(record.blurhash)}`;
    },
  },
  thumbhash: {
    label: "ThumbHash preview + original",
    strategy: "preview",
    getPreview(record) {
      return `data:image/thumbhash;base64,${record.thumbhashBase64}`;
    },
  },
  lqip: {
    label: "LQIP preview + original",
    strategy: "preview",
    getPreview(record) {
      return record.lqip.dataUrl;
    },
  },
  avif: {
    label: "AVIF preview + original",
    strategy: "preview",
    getPreview(record) {
      return record.avif.dataUrl;
    },
  },
  "progressive-jpeg": {
    label: "Progressive JPEG",
    strategy: "progressive",
    getSource(record) {
      return `./progressive-images/${record.id}.jpg`;
    },
  },
  "interlaced-png": {
    label: "Adam7 interlaced PNG",
    strategy: "progressive",
    getSource(record) {
      return `./progressive-images/${record.id}.png`;
    },
  },
  "progressive-avif": {
    label: "Progressive AVIF",
    strategy: "progressive",
    getSource(record) {
      return `./progressive-images/${record.id}.avif`;
    },
  },
  "progressive-jxl": {
    label: "Progressive JPEG XL",
    strategy: "progressive",
    getSource(record) {
      return `./progressive-images/${record.id}.jxl`;
    },
  },
};
