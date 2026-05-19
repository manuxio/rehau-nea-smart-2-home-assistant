// Rasterises the master icon into every PNG the app + HA addon needs.
//
// Source resolution order:
//   1. public/icon-source.png  — preferred when an artist hands over PNG art
//   2. public/icon-source.svg  — vector fallback (committed default)
//
// Outputs (all in apps/web/public/, then copied into the bundle by Vite):
//   icon-32.png            – favicon
//   icon-192.png           – PWA Android (manifest)
//   icon-512.png           – PWA Android (manifest, splash basis)
//   icon-maskable-512.png  – PWA maskable variant (same art, 20% safe pad)
//   apple-touch-icon.png   – iOS home-screen (180×180)
//   icon-128.png           – Home Assistant addon icon
//   logo-250x100.png       – HA addon logo card (centred glyph on bg)
//
// The HA-specific PNGs are also dropped at apps/web/public/ha-icon.png and
// apps/web/public/ha-logo.png so the addon deploy step can copy them next
// to `config.yaml` without duplicating sizing logic.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, "..", "public");

const pngSource = resolve(pub, "icon-source.png");
const svgSource = resolve(pub, "icon-source.svg");

const source = existsSync(pngSource)
  ? pngSource
  : existsSync(svgSource)
    ? svgSource
    : null;
if (!source) {
  throw new Error(`No icon source found. Provide ${pngSource} or ${svgSource}.`);
}
console.log(`icons: using source ${source}`);

// Load once; sharp resamples internally.
const data = readFileSync(source);

const targets = [
  { out: "icon-32.png", size: 32 },
  { out: "icon-192.png", size: 192 },
  { out: "icon-512.png", size: 512 },
  { out: "apple-touch-icon.png", size: 180 },
  { out: "icon-128.png", size: 128 },
  { out: "ha-icon.png", size: 128 },
];

for (const { out, size } of targets) {
  const dest = resolve(pub, out);
  await sharp(data, { density: 600 }) // high density so SVG rasterises crisp
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(dest);
  console.log(`icons: wrote ${out} (${size}×${size})`);
}

// Maskable: same art but laid on a solid background with 20% safe padding so
// Android can crop it into any shape without clipping. The source SVG already
// has the right background colour, so we just scale to 80% inside a 512 frame.
const maskableSize = 512;
const innerSize = Math.round(maskableSize * 0.8);
const innerOffset = Math.round((maskableSize - innerSize) / 2);
const innerPng = await sharp(data, { density: 600 })
  .resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp({
  create: {
    width: maskableSize,
    height: maskableSize,
    channels: 4,
    background: "#16101C",
  },
})
  .composite([{ input: innerPng, left: innerOffset, top: innerOffset }])
  .png({ compressionLevel: 9 })
  .toFile(resolve(pub, "icon-maskable-512.png"));
console.log(`icons: wrote icon-maskable-512.png (${maskableSize}×${maskableSize}, 20% safe pad)`);

// HA addon logo card: 250×100 with the icon centred over the brand bg.
const logoW = 250;
const logoH = 100;
const logoIconSize = 72;
const logoIconBuf = await sharp(data, { density: 600 })
  .resize(logoIconSize, logoIconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp({
  create: {
    width: logoW,
    height: logoH,
    channels: 4,
    background: "#16101C",
  },
})
  .composite([
    {
      input: logoIconBuf,
      left: Math.round((logoW - logoIconSize) / 2),
      top: Math.round((logoH - logoIconSize) / 2),
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile(resolve(pub, "ha-logo.png"));
console.log(`icons: wrote ha-logo.png (${logoW}×${logoH})`);

console.log("icons: done");
