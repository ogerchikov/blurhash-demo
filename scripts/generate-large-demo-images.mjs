import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.resolve(__dirname, "..", "images");

const WIDTH = 6000;
const HEIGHT = 4000;
const TARGET_BYTES = 10 * 1024 * 1024;
const MIN_QUALITY = 65;
const MAX_QUALITY = 100;

function svg(content, definitions = "") {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 1500 1000">
      <defs>${definitions}</defs>
      ${content}
    </svg>
  `);
}

function orbitalObservatory() {
  return svg(
    `
      <rect width="1500" height="1000" fill="url(#sky)"/>
      <circle cx="1160" cy="210" r="128" fill="url(#planet)"/>
      <ellipse cx="1160" cy="222" rx="210" ry="52" fill="none" stroke="#efd9a7" stroke-width="18" opacity=".75" transform="rotate(-12 1160 222)"/>
      <g fill="#fff">
        <circle cx="170" cy="145" r="4"/><circle cx="310" cy="260" r="3"/><circle cx="520" cy="105" r="5"/>
        <circle cx="760" cy="230" r="4"/><circle cx="910" cy="90" r="3"/><circle cx="1340" cy="420" r="5"/>
        <circle cx="1040" cy="470" r="3"/><circle cx="430" cy="410" r="4"/><circle cx="95" cy="375" r="3"/>
      </g>
      <path d="M0 760 Q250 630 470 735 T900 700 T1500 720 V1000 H0Z" fill="#17233b"/>
      <path d="M0 835 Q270 720 550 815 T1060 780 T1500 810 V1000 H0Z" fill="#0a1224"/>
      <g transform="translate(420 420)">
        <rect x="240" y="250" width="340" height="165" rx="22" fill="#dce7ed"/>
        <rect x="275" y="286" width="96" height="64" rx="8" fill="#37b7d7"/>
        <rect x="394" y="286" width="150" height="64" rx="8" fill="#18384f"/>
        <rect x="290" y="415" width="30" height="170" fill="#899ba8"/>
        <rect x="500" y="415" width="30" height="170" fill="#899ba8"/>
        <path d="M240 275 L35 105 L78 62 L330 250Z" fill="#b7c8d0"/>
        <ellipse cx="78" cy="70" rx="125" ry="42" fill="#edf4f5" transform="rotate(37 78 70)"/>
        <ellipse cx="78" cy="70" rx="78" ry="23" fill="#4fc3dc" transform="rotate(37 78 70)"/>
        <path d="M580 285 L770 180 L798 230 L580 350Z" fill="#c5d4da"/>
        <rect x="650" y="180" width="225" height="130" rx="8" fill="#275b94"/>
        <path d="M650 223 H875 M650 267 H875 M705 180 V310 M760 180 V310 M815 180 V310" stroke="#77d0ee" stroke-width="5"/>
        <circle cx="410" cy="390" r="28" fill="#f5a623"/>
      </g>
      <text x="750" y="925" fill="#dce7ed" font-family="Arial, sans-serif" font-size="42" font-weight="700" text-anchor="middle" letter-spacing="12">ORBITAL RESEARCH STATION</text>
    `,
    `
      <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#07091f"/><stop offset=".55" stop-color="#182957"/><stop offset="1" stop-color="#a24972"/></linearGradient>
      <radialGradient id="planet" cx=".35" cy=".3"><stop stop-color="#ffd58a"/><stop offset=".58" stop-color="#d76b58"/><stop offset="1" stop-color="#62304f"/></radialGradient>
    `,
  );
}

function alpineExpress() {
  return svg(
    `
      <rect width="1500" height="1000" fill="url(#alpineSky)"/>
      <circle cx="1220" cy="150" r="82" fill="#fff3c4" opacity=".9"/>
      <path d="M0 610 L255 245 L445 520 L650 145 L905 570 L1115 280 L1500 620 V1000 H0Z" fill="#7e95a5"/>
      <path d="M410 520 L650 145 L905 570 L760 445 L650 315 L555 450Z" fill="#eef6f7"/>
      <path d="M900 570 L1115 280 L1500 620 L1260 500 L1110 420Z" fill="#dfecee"/>
      <path d="M0 660 Q310 570 570 690 T1080 640 T1500 650 V1000 H0Z" fill="#3f704f"/>
      <path d="M0 790 Q300 675 600 785 T1150 750 T1500 765 V1000 H0Z" fill="#23472f"/>
      <path d="M0 915 C390 735 930 755 1500 900" fill="none" stroke="#c9beb0" stroke-width="120"/>
      <path d="M0 900 C390 720 930 740 1500 885" fill="none" stroke="#3a3533" stroke-width="16"/>
      <path d="M0 943 C390 763 930 783 1500 928" fill="none" stroke="#3a3533" stroke-width="16"/>
      <g transform="translate(420 615)">
        <path d="M0 90 Q20 5 115 0 H755 Q825 5 855 80 L885 190 H0Z" fill="#d84635"/>
        <path d="M105 18 H690 Q750 20 775 83 H80 Q86 43 105 18Z" fill="#eef5f6"/>
        <path d="M121 35 H252 V75 H105Z M275 35 H405 V75 H275Z M428 35 H558 V75 H428Z M581 35 H690 Q724 38 743 75 H581Z" fill="#407086"/>
        <rect x="20" y="105" width="825" height="55" fill="#f2c14e"/>
        <circle cx="150" cy="190" r="48" fill="#24282c"/><circle cx="150" cy="190" r="21" fill="#acb7bd"/>
        <circle cx="710" cy="190" r="48" fill="#24282c"/><circle cx="710" cy="190" r="21" fill="#acb7bd"/>
        <path d="M855 80 L930 122 L885 190 H845Z" fill="#a92e2c"/>
        <circle cx="45" cy="135" r="16" fill="#fff4bc"/>
      </g>
      <g fill="#173d2a">
        <path d="M170 680 l-62 140 h124Z"/><path d="M1250 610 l-85 195 h170Z"/>
        <path d="M1340 650 l-65 150 h130Z"/><path d="M310 620 l-72 165 h144Z"/>
      </g>
      <text x="750" y="120" fill="#173748" font-family="Arial, sans-serif" font-size="54" font-weight="800" text-anchor="middle" letter-spacing="9">ALPINE EXPRESS</text>
    `,
    `<linearGradient id="alpineSky" x2="0" y2="1"><stop stop-color="#72c9e8"/><stop offset=".65" stop-color="#d9f0ed"/><stop offset="1" stop-color="#f8d99c"/></linearGradient>`,
  );
}

function coralReef() {
  return svg(
    `
      <rect width="1500" height="1000" fill="url(#ocean)"/>
      <path d="M0 0 H1500 L1320 820 H1300 L1390 0Z" fill="#b6f4ee" opacity=".12"/>
      <path d="M310 0 L520 780 H590 L410 0Z" fill="#d5fff5" opacity=".11"/>
      <g fill="none" stroke="#d5fff5" opacity=".35">
        <circle cx="1180" cy="190" r="16" stroke-width="5"/><circle cx="1210" cy="145" r="9" stroke-width="4"/>
        <circle cx="250" cy="300" r="12" stroke-width="4"/><circle cx="275" cy="260" r="7" stroke-width="3"/>
      </g>
      <g transform="translate(680 250)">
        <ellipse cx="0" cy="0" rx="250" ry="105" fill="#f4b544"/>
        <path d="M-230 -28 Q-360 -145 -345 15 Q-350 145 -225 48Z" fill="#ef704e"/>
        <path d="M-15 -100 Q55 -200 115 -88Z" fill="#ef704e"/>
        <path d="M-20 98 Q55 185 120 82Z" fill="#ef704e"/>
        <path d="M-135 -88 Q-95 0 -135 88 M-45 -103 Q-5 0 -45 103 M50 -100 Q92 0 50 100 M145 -72 Q178 0 145 72" fill="none" stroke="#70374b" stroke-width="20"/>
        <circle cx="178" cy="-20" r="20" fill="#fff"/><circle cx="183" cy="-20" r="9" fill="#152b44"/>
        <path d="M218 22 Q245 35 260 18" fill="none" stroke="#70374b" stroke-width="8"/>
      </g>
      <g transform="translate(260 510) scale(.58)">
        <ellipse cx="0" cy="0" rx="250" ry="105" fill="#6ad2c8"/>
        <path d="M-230 -28 Q-360 -145 -345 15 Q-350 145 -225 48Z" fill="#267f9c"/>
        <path d="M-25 -100 Q50 -195 115 -82Z" fill="#267f9c"/>
        <circle cx="178" cy="-20" r="20" fill="#fff"/><circle cx="183" cy="-20" r="9" fill="#152b44"/>
      </g>
      <g transform="translate(1200 470) scale(.42)">
        <ellipse cx="0" cy="0" rx="250" ry="105" fill="#e96275"/>
        <path d="M-230 -28 Q-360 -145 -345 15 Q-350 145 -225 48Z" fill="#823c86"/>
        <circle cx="178" cy="-20" r="20" fill="#fff"/><circle cx="183" cy="-20" r="9" fill="#152b44"/>
      </g>
      <path d="M0 810 Q160 740 315 825 T650 805 T980 820 T1280 790 T1500 820 V1000 H0Z" fill="#e1b66f"/>
      <g stroke-linecap="round" fill="none">
        <path d="M145 910 Q85 770 150 680 M150 845 Q215 775 210 710 M125 825 Q70 780 65 720" stroke="#e65f6d" stroke-width="30"/>
        <path d="M1120 925 Q1080 720 1140 610 M1130 790 Q1210 720 1230 630 M1110 835 Q1040 770 1030 690" stroke="#f08a62" stroke-width="34"/>
        <path d="M430 940 Q400 810 445 740 M445 860 Q510 820 530 755" stroke="#7c4d9e" stroke-width="28"/>
      </g>
      <g fill="#f0d45c">
        <ellipse cx="720" cy="900" rx="100" ry="65"/><ellipse cx="805" cy="870" rx="80" ry="55"/>
        <ellipse cx="915" cy="925" rx="105" ry="60"/>
      </g>
      <text x="750" y="110" fill="#d9fffa" font-family="Arial, sans-serif" font-size="48" font-weight="700" text-anchor="middle" letter-spacing="11">CORAL REEF SANCTUARY</text>
    `,
    `<linearGradient id="ocean" x2="0" y2="1"><stop stop-color="#0bb6bd"/><stop offset=".45" stop-color="#08758f"/><stop offset="1" stop-color="#082f55"/></linearGradient>`,
  );
}

const images = [
  { name: "large-orbital-observatory.jpg", artwork: orbitalObservatory(), seed: 1103 },
  { name: "large-alpine-express.jpg", artwork: alpineExpress(), seed: 2207 },
  { name: "large-coral-reef.jpg", artwork: coralReef(), seed: 3301 },
];

function noiseAt(index, seed) {
  let value = Math.imul(index + seed, 374761393);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

async function createPixels({ artwork, seed }) {
  const { data, info } = await sharp(artwork, { density: 96 })
    .resize(WIDTH, HEIGHT)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += 1) {
    const grain = Math.round((noiseAt(offset, seed) - 0.5) * 22);
    data[offset] = Math.max(0, Math.min(255, data[offset] + grain));
  }

  return { data, info };
}

async function encodeNearTarget(pixels, info) {
  const source = sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  });
  let low = MIN_QUALITY;
  let high = MAX_QUALITY;
  let closest;

  while (low <= high) {
    const quality = Math.floor((low + high) / 2);
    const data = await source
      .clone()
      .jpeg({ quality, chromaSubsampling: "4:2:0", mozjpeg: true })
      .toBuffer();
    const candidate = { data, quality };

    if (!closest || Math.abs(data.length - TARGET_BYTES) < Math.abs(closest.data.length - TARGET_BYTES)) {
      closest = candidate;
    }

    if (data.length < TARGET_BYTES) {
      low = quality + 1;
    } else {
      high = quality - 1;
    }
  }

  return closest;
}

for (const image of images) {
  const { data: pixels, info } = await createPixels(image);
  const { data, quality } = await encodeNearTarget(pixels, info);
  await fs.writeFile(path.join(imagesDir, image.name), data);
  console.log(
    `Wrote ${image.name}: ${(data.length / 1024 / 1024).toFixed(2)} MiB at JPEG quality ${quality}`,
  );
}
