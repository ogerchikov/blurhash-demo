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
const outputDir = path.join(rootDir, "progressive-images");
const photos = JSON.parse(
  await fs.readFile(path.join(rootDir, "photos.json"), "utf8"),
);

const maxDimension = 960;
const jpegQuality = 82;
const images = [];
const encoders = await resolveImageEncoders();

if (!encoders.avifenc || !encoders.cjxl) {
  throw new Error(
    "Progressive AVIF and JPEG XL encoders are required. Run "
    + "`npm run tools:setup-image-encoders` first.",
  );
}

await fs.mkdir(outputDir, { recursive: true });

for (const record of photos.images) {
  const input = path.resolve(rootDir, record.src);
  const jpegName = `${record.id}.jpg`;
  const pngName = `${record.id}.png`;
  const avifName = `${record.id}.avif`;
  const jxlName = `${record.id}.jxl`;
  const resize = {
    width: maxDimension,
    height: maxDimension,
    fit: "inside",
    withoutEnlargement: true,
  };

  const jpegInfo = await sharp(input)
    .resize(resize)
    .jpeg({ quality: jpegQuality, progressive: true })
    .toFile(path.join(outputDir, jpegName));
  const pngInfo = await sharp(input)
    .resize(resize)
    .png({ compressionLevel: 9, progressive: true, palette: false })
    .toFile(path.join(outputDir, pngName));
  const pngPath = path.join(outputDir, pngName);
  const avifPath = path.join(outputDir, avifName);
  const jxlPath = path.join(outputDir, jxlName);

  runImageEncoder(encoders.avifenc, [
    "--progressive",
    "--qcolor",
    String(jpegQuality),
    "--qalpha",
    "100",
    "--speed",
    "6",
    pngPath,
    avifPath,
  ]);
  runImageEncoder(encoders.cjxl, [
    pngPath,
    jxlPath,
    `--quality=${jpegQuality}`,
    "--effort=7",
    "--progressive",
  ]);
  const [avifStat, jxlStat] = await Promise.all([
    fs.stat(avifPath),
    fs.stat(jxlPath),
  ]);

  images.push({
    id: record.id,
    width: jpegInfo.width,
    height: jpegInfo.height,
    progressiveJpeg: {
      src: `./progressive-images/${jpegName}`,
      mimeType: "image/jpeg",
      bytes: jpegInfo.size,
    },
    interlacedPng: {
      src: `./progressive-images/${pngName}`,
      mimeType: "image/png",
      bytes: pngInfo.size,
    },
    progressiveAvif: {
      src: `./progressive-images/${avifName}`,
      mimeType: "image/avif",
      bytes: avifStat.size,
    },
    progressiveJxl: {
      src: `./progressive-images/${jxlName}`,
      mimeType: "image/jxl",
      bytes: jxlStat.size,
    },
  });
  console.log(`Generated progressive gallery assets for ${record.id}`);
}

await fs.writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    generatedBy: "generate-progressive-demo-assets",
    settings: {
      maxDimension,
      jpegQuality,
      avifenc: "1.4.2 --progressive",
      cjxl: "0.12.0 --progressive",
    },
    images,
  }, null, 2)}\n`,
);
console.log(`Wrote ${images.length} progressive image sets to progressive-images/`);
