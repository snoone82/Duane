// Rebuild the brand assets for the dark theme. The committed marks were
// navy-on-white; on the navy ground they'd render as white boxes (and the
// navy strokes would vanish even keyed). Standard dark-mode logo treatment:
//   white  -> transparent (alpha ramp off luminance, so anti-aliased edges
//             stay smooth)
//   navy   -> light ink (#e8edf6)
//   teal   -> kept as-is (classified by green/blue dominance over red)
// Favicon/app icons are re-composed on the navy ground so browser tabs
// match the app.
import sharp from "sharp";

const LIGHT = { r: 232, g: 237, b: 246 };
const BG = "#0b1220";

async function keyToDark(inPath, outPath) {
  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const tealness = (g + b) / 2 - r;
    if (tealness > 50) continue; // teal stroke — keep
    // Grayscale navy↔white ramp: dark = opaque light ink, white = transparent.
    const lum = (r + g + b) / 3;
    const alpha = Math.max(0, Math.min(255, Math.round(255 - (lum - 120) * 1.9)));
    data[i] = LIGHT.r;
    data[i + 1] = LIGHT.g;
    data[i + 2] = LIGHT.b;
    data[i + 3] = Math.min(data[i + 3], alpha);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(outPath);
}

async function iconOnNavy(markPath, size, markWidth, outPath) {
  const mark = await sharp(markPath).resize({ width: markWidth }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(outPath);
}

const tmpMark = "public/brand/icon-mark.dark.png";
const tmpLockup = "public/brand/logo-lockup.dark.png";

await keyToDark("public/brand/icon-mark.png", tmpMark);
await keyToDark("public/brand/logo-lockup.png", tmpLockup);

const { renameSync } = await import("node:fs");
renameSync(tmpMark, "public/brand/icon-mark.png");
renameSync(tmpLockup, "public/brand/logo-lockup.png");

await iconOnNavy("public/brand/icon-mark.png", 512, 340, "app/icon.png");
await iconOnNavy("public/brand/icon-mark.png", 180, 120, "app/apple-icon.png");

console.log("dark-theme assets written");
