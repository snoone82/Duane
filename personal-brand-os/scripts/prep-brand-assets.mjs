// One-off script to prep the Aligned Media brand assets Duane provided
// (wide JPGs on a white background) into web-ready files: a sidebar-sized
// icon, a full lockup for the login screen, and square, padded favicon/
// app-icon PNGs (JPEGs can't have transparency, and app chrome here is pure
// white throughout, so keeping the white background rather than trying to
// chroma-key it out of a JPEG is the safe choice — no matting artifacts on
// the teal/navy edges).
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SOURCE_DIR = "C:\\Users\\steven.Noone\\Downloads";
const ICON_SRC = `${SOURCE_DIR}\\Aligned Media Icon.jpg`;
const LOGO_SRC = `${SOURCE_DIR}\\Aligned Media Logo 2.jpg`;

mkdirSync("public/brand", { recursive: true });

async function run() {
  // Sidebar icon — trimmed tight, modest size, no forced square.
  await sharp(ICON_SRC).trim({ threshold: 10 }).resize({ height: 200 }).png().toFile("public/brand/icon-mark.png");

  // Full lockup — for the login screen.
  await sharp(LOGO_SRC).trim({ threshold: 10 }).resize({ height: 400 }).png().toFile("public/brand/logo-lockup.png");

  // Favicon / app icon — square canvas, mark trimmed then contained with
  // padding so it isn't squished into a non-square favicon slot.
  const trimmedIcon = await sharp(ICON_SRC).trim({ threshold: 10 }).toBuffer();

  await sharp(trimmedIcon)
    .resize({ width: 420, height: 420, fit: "contain", background: "#ffffff" })
    .extend({ top: 46, bottom: 46, left: 46, right: 46, background: "#ffffff" })
    .png()
    .toFile("app/icon.png");

  await sharp(trimmedIcon)
    .resize({ width: 150, height: 150, fit: "contain", background: "#ffffff" })
    .extend({ top: 15, bottom: 15, left: 15, right: 15, background: "#ffffff" })
    .png()
    .toFile("app/apple-icon.png");

  console.log("done");
}

run();
