
import { decode } from "https://cdn.jsdelivr.net/npm/blurhash/+esm";

const blurhash =
  "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

function makeBlurhashCanvas(hash) {
  const pixels = decode(hash, 32, 32);

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;

  const ctx = canvas.getContext("2d");

  const imageData = ctx.createImageData(
    32,
    32
  );

  imageData.data.set(pixels);

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

const container =
  document.getElementById("container");

const canvas =
  makeBlurhashCanvas(blurhash);

container.appendChild(canvas);

const img = new Image();

img.onload = () => {
  canvas.replaceWith(img);
};

img.src = "./images/beach.jpg";
