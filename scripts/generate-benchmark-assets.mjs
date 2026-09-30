import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import {
  resolveImageEncoders,
  runImageEncoder,
} from "./image-encoder-tools.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "benchmark-assets");
const photos = JSON.parse(
  await fs.readFile(path.join(rootDir, "photos.json"), "utf8"),
);
const progressiveGallery = JSON.parse(
  await fs.readFile(
    path.join(rootDir, "progressive-images", "manifest.json"),
    "utf8",
  ),
);

const benchmarkMaxDimension = 960;
const previewMaxDimension = 48;
const previewQuality = 45;
const finalQuality = 82;
const streamCheckpoints = [0.1, 0.25, 0.5, 0.75, 1];

const formatDefinitions = {
  jpeg: { label: "JPEG", extension: "jpg", mimeType: "image/jpeg" },
  png: { label: "PNG", extension: "png", mimeType: "image/png" },
  webp: { label: "WebP", extension: "webp", mimeType: "image/webp" },
  avif: { label: "AVIF", extension: "avif", mimeType: "image/avif" },
  jxl: { label: "JPEG XL", extension: "jxl", mimeType: "image/jxl" },
};

function webPath(...segments) {
  return `./${segments.join("/")}`;
}

async function writeSharpAsset(pipeline, format, outputPath, options = {}) {
  const encoders = {
    jpeg: () => pipeline.jpeg({
      quality: options.quality,
      progressive: options.progressive ?? false,
    }),
    png: () => pipeline.png({
      compressionLevel: 9,
      progressive: options.progressive ?? false,
      palette: false,
    }),
    webp: () => pipeline.webp({ quality: options.quality, effort: 5 }),
    avif: () => pipeline.avif({ quality: options.quality, effort: 5 }),
  };
  await encoders[format]().toFile(outputPath);
  return (await fs.stat(outputPath)).size;
}

async function writeJxl(executable, inputPath, outputPath, { progressive, quality }) {
  const args = [
    inputPath,
    outputPath,
    `--quality=${quality}`,
    "--effort=7",
    "--lossless_jpeg=0",
  ];
  if (progressive) {
    args.push("--progressive");
  }
  runImageEncoder(executable, args);
  return (await fs.stat(outputPath)).size;
}

async function writeAvif(executable, inputPath, outputPath, { progressive, quality }) {
  const args = [
    "--qcolor",
    String(quality),
    "--qalpha",
    "100",
    "--speed",
    "6",
  ];
  if (progressive) {
    args.push("--progressive");
  }
  args.push(inputPath, outputPath);
  runImageEncoder(executable, args);
  return (await fs.stat(outputPath)).size;
}

function availableAsset(format, file, bytes, extra = {}) {
  return {
    format,
    label: formatDefinitions[format].label,
    mimeType: formatDefinitions[format].mimeType,
    file,
    bytes,
    available: true,
    ...extra,
  };
}

function unavailableAsset(format, reason, extra = {}) {
  return {
    format,
    label: formatDefinitions[format].label,
    mimeType: formatDefinitions[format].mimeType,
    available: false,
    reason,
    ...extra,
  };
}

function progressiveAsset(format, file, bytes, encoder) {
  const definition = formatDefinitions[format];
  return availableAsset(
    format,
    file,
    bytes,
    {
      encoder,
      checkpoints: streamCheckpoints.map((fraction, index) => ({
        fraction,
        offset: Math.min(bytes, Math.ceil(bytes * fraction)),
        label: index === streamCheckpoints.length - 1
          ? "final"
          : `${Math.round(fraction * 100)}% bytes`,
      })),
    },
  );
}

async function inlineAsset(format, filePath, bytes, extra = {}) {
  const definition = formatDefinitions[format];
  const encoded = await fs.readFile(filePath);
  const dataUrl = `data:${definition.mimeType};base64,${encoded.toString("base64")}`;
  return availableAsset(
    format,
    null,
    bytes,
    {
      label: `Inline ${definition.label}`,
      transport: "inline",
      configuredBytes: Buffer.byteLength(dataUrl, "utf8"),
      dataUrl,
      ...extra,
    },
  );
}

async function generateImage(record, tools) {
  const inputPath = path.resolve(rootDir, record.src);
  const imageDir = path.join(outputDir, record.id);
  await fs.mkdir(imageDir, { recursive: true });

  const previews = {};
  const finals = {};
  const progressive = {};

  for (const format of ["jpeg", "png", "webp", "avif"]) {
    const definition = formatDefinitions[format];
    const previewName = `preview.${definition.extension}`;
    const finalName = `final.${definition.extension}`;
    const previewPath = path.join(imageDir, previewName);
    const previewBytes = await writeSharpAsset(
      sharp(inputPath).resize({
        width: previewMaxDimension,
        height: previewMaxDimension,
        fit: "inside",
        withoutEnlargement: true,
      }),
      format,
      previewPath,
      { quality: previewQuality },
    );
    const finalBytes = await writeSharpAsset(
      sharp(inputPath).resize({
        width: benchmarkMaxDimension,
        height: benchmarkMaxDimension,
        fit: "inside",
        withoutEnlargement: true,
      }),
      format,
      path.join(imageDir, finalName),
      { quality: finalQuality },
    );
    previews[format] = availableAsset(
      format,
      webPath("benchmark-assets", record.id, previewName),
      previewBytes,
      {
        label: `External ${definition.label}`,
        transport: "external",
        configuredBytes: previewBytes,
        widthLimit: previewMaxDimension,
        quality: previewQuality,
      },
    );
    previews[`${format}-inline`] = await inlineAsset(
      format,
      previewPath,
      previewBytes,
      { widthLimit: previewMaxDimension, quality: previewQuality },
    );
    finals[format] = availableAsset(
      format,
      webPath("benchmark-assets", record.id, finalName),
      finalBytes,
      {
        quality: finalQuality,
        encoder: format === "jpeg" ? "Sharp/libjpeg" : `Sharp/${format}`,
      },
    );
  }
  const normalizedPng = path.join(imageDir, "final.png");

  if (tools.avifenc) {
    try {
      const finalAvifPath = path.join(imageDir, "final.avif");
      const finalAvifBytes = await writeAvif(
        tools.avifenc,
        normalizedPng,
        finalAvifPath,
        { progressive: false, quality: finalQuality },
      );
      finals.avif = availableAsset(
        "avif",
        webPath("benchmark-assets", record.id, "final.avif"),
        finalAvifBytes,
        {
          quality: finalQuality,
          encoder: "libavif avifenc",
        },
      );
    } catch (error) {
      finals.avif = unavailableAsset("avif", error.message);
    }
  } else {
    finals.avif = unavailableAsset(
      "avif",
      "Install avifenc from libavif for encoder-matched comparison.",
    );
  }

  if (tools.cjxl) {
    try {
      const previewPng = path.join(imageDir, "preview.png");
      const previewName = "preview.jxl";
      const finalName = "final.jxl";
      const previewBytes = await writeJxl(
        tools.cjxl,
        previewPng,
        path.join(imageDir, previewName),
        { progressive: false, quality: previewQuality },
      );
      const finalBytes = await writeJxl(
        tools.cjxl,
        normalizedPng,
        path.join(imageDir, finalName),
        { progressive: false, quality: finalQuality },
      );
      previews.jxl = availableAsset(
        "jxl",
        webPath("benchmark-assets", record.id, previewName),
        previewBytes,
        {
          label: "External JPEG XL",
          transport: "external",
          configuredBytes: previewBytes,
          widthLimit: previewMaxDimension,
          quality: previewQuality,
        },
      );
      previews["jxl-inline"] = await inlineAsset(
        "jxl",
        path.join(imageDir, previewName),
        previewBytes,
        { widthLimit: previewMaxDimension, quality: previewQuality },
      );
      finals.jxl = availableAsset(
        "jxl",
        webPath("benchmark-assets", record.id, finalName),
        finalBytes,
        { quality: finalQuality, encoder: "libjxl cjxl" },
      );
    } catch (error) {
      previews.jxl = unavailableAsset("jxl", error.message);
      previews["jxl-inline"] = unavailableAsset("jxl", error.message, {
        label: "Inline JPEG XL",
        transport: "inline",
      });
      finals.jxl = unavailableAsset("jxl", error.message);
    }
  } else {
    previews.jxl = unavailableAsset("jxl", "Install cjxl from libjxl.");
    previews["jxl-inline"] = unavailableAsset(
      "jxl",
      "Install cjxl from libjxl.",
      { label: "Inline JPEG XL", transport: "inline" },
    );
    finals.jxl = unavailableAsset("jxl", "Install cjxl from libjxl.");
  }

  const sharedProgressive = progressiveGallery.images.find(
    (image) => image.id === record.id,
  );
  if (!sharedProgressive) {
    throw new Error(
      `progressive-images/manifest.json has no entry for "${record.id}".`,
    );
  }
  progressive.jpeg = progressiveAsset(
    "jpeg",
    sharedProgressive.progressiveJpeg.src,
    sharedProgressive.progressiveJpeg.bytes,
    "Sharp/libjpeg progressive",
  );
  progressive.png = progressiveAsset(
    "png",
    sharedProgressive.interlacedPng.src,
    sharedProgressive.interlacedPng.bytes,
    "libpng Adam7 via Sharp",
  );
  progressive.avif = progressiveAsset(
    "avif",
    sharedProgressive.progressiveAvif.src,
    sharedProgressive.progressiveAvif.bytes,
    "libavif avifenc --progressive",
  );
  progressive.jxl = progressiveAsset(
    "jxl",
    sharedProgressive.progressiveJxl.src,
    sharedProgressive.progressiveJxl.bytes,
    "libjxl cjxl --progressive",
  );

  return {
    id: record.id,
    source: record.src,
    width: record.width,
    height: record.height,
    previews,
    finals,
    progressive,
  };
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const tools = await resolveImageEncoders();
const images = [];
for (const record of photos.images) {
  images.push(await generateImage(record, tools));
  console.log(`Generated benchmark assets for ${record.id}`);
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  settings: {
    benchmarkMaxDimension,
    previewMaxDimension,
    previewQuality,
    finalQuality,
    streamCheckpoints,
  },
  tools: {
    avifenc: Boolean(tools.avifenc),
    cjxl: Boolean(tools.cjxl),
  },
  formats: formatDefinitions,
  images,
};
await fs.writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`Wrote ${images.length} image matrices to benchmark-assets/manifest.json`);
