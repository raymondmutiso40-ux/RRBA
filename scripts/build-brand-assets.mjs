/**
 * Derives the app's brand assets from the academy's supplied logo file.
 *
 * The source is a single JPEG holding a stacked lockup on a white field: the
 * shield emblem on top, the "Runda Ridge Basketball Academy" wordmark beneath.
 * Neither half is usable as-is — at sidebar size the wordmark is illegible, and
 * a JPEG cannot sit on a coloured surface without dragging its white rectangle
 * along. So this script splits the two halves and lifts the background out.
 *
 * Background removal is a flood fill inward from the border rather than a
 * "make every white pixel transparent" pass. That distinction is the whole
 * point: the emblem contains white *inside* it — the BASKETBALL banner and the
 * net below it — and blanket keying would punch holes through both, leaving
 * black text on a transparent banner that vanishes against a dark surface.
 * Filling from the outside only reaches white the border can walk to.
 *
 *   npm run brand:build
 *
 * Outputs are committed. Re-run this only when the academy supplies new
 * artwork, then commit whatever changes.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "brand", "rrba-logo.jpeg");

/**
 * Luminance above which a pixel counts as background while flooding.
 *
 * Generous on purpose: JPEG compression leaves the white field slightly dirty
 * and faintly ringed around the black outline, so a strict threshold strands
 * an off-white halo the fill cannot cross.
 */
const BACKGROUND_LUMA = 232;

/** Breathing room around the artwork, as a fraction of the output's longest edge. */
const PADDING = 0.06;

async function loadPixels() {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height, channels: info.channels };
}

/**
 * Clears the outer white field to transparent, in place.
 *
 * An explicit stack rather than recursion — the field is well over a million
 * pixels and a depth-first recursion blows the call stack on the first row.
 */
function clearBackground({ data, width, height, channels }) {
  const seen = new Uint8Array(width * height);
  const stack = [];

  const isBackground = (pixel) => {
    const i = pixel * channels;
    // Rec. 601 luma. The field is neutral, so a plain average would do, but
    // weighting keeps the orange from being mistaken for background.
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] >= BACKGROUND_LUMA;
  };

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (seen[pixel]) return;
    seen[pixel] = 1;
    if (isBackground(pixel)) stack.push(pixel);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length > 0) {
    const pixel = stack.pop();
    const i = pixel * channels;
    data[i + 3] = 0;

    const x = pixel % width;
    const y = (pixel - x) / width;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
}

/**
 * The tightest box around everything still opaque within `region`.
 *
 * Cropping to measured content rather than to hardcoded offsets means new
 * artwork with the emblem sitting differently still comes out centred.
 */
function contentBounds({ data, width, channels }, region) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let y = region.top; y < region.top + region.height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX) throw new Error("Region is entirely transparent.");

  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Rows that hold artwork, as [start, end] pairs.
 *
 * Used to tell the emblem from the wordmark without hardcoding where the gap
 * between them falls. `minGap` ignores the small gaps between the wordmark's
 * own three lines, so the whole wordmark reads as one band.
 */
function rowBands({ data, width, height, channels }, minGap) {
  const bands = [];
  let start = null;
  let gap = 0;

  for (let y = 0; y < height; y++) {
    let occupied = false;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] !== 0) {
        occupied = true;
        break;
      }
    }

    if (occupied) {
      if (start === null) start = y;
      gap = 0;
    } else if (start !== null) {
      gap++;
      if (gap >= minGap) {
        bands.push([start, y - gap]);
        start = null;
      }
    }
  }

  if (start !== null) bands.push([start, height - 1]);
  return bands;
}

/**
 * Crops to `box` and renders it centred in a transparent canvas of exactly
 * `size`, undistorted and with a margin.
 *
 * The resize targets the canvas minus the margin, because sharp runs `extend`
 * *after* `resize` regardless of the order the calls are chained in — padding
 * first and resizing second would grow the output past `size`.
 */
function extractPadded(pixels, box, size) {
  const pad = Math.round(Math.max(size.width, size.height) * PADDING);
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

  return sharp(pixels.data, {
    raw: { width: pixels.width, height: pixels.height, channels: pixels.channels },
  })
    .extract(box)
    .resize({
      width: size.width - pad * 2,
      height: size.height - pad * 2,
      fit: "contain",
      background: transparent,
    })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: transparent })
    .png();
}

/** Flattens onto white — for icons, where transparency is unwanted. */
function onWhite(image, size) {
  return sharp({
    create: {
      width: size.width,
      height: size.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: image, gravity: "centre" }])
    .png();
}

async function write(path, image) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, await image.toBuffer());
  console.log(`  ${path}`);
}

async function main() {
  const pixels = await loadPixels();
  clearBackground(pixels);

  // A gap wider than the wordmark's own line spacing, so the emblem and the
  // wordmark separate but the wordmark's three lines stay together.
  const bands = rowBands(pixels, 24);
  if (bands.length < 2) {
    throw new Error(
      `Expected an emblem and a wordmark, found ${bands.length} band(s). ` +
        "The source artwork's layout has changed — check the crop logic.",
    );
  }

  // The first band is the emblem; everything below it is the wordmark, which
  // only the social card uses, and uses whole via `full`.
  const [emblemBand] = bands;

  const emblem = contentBounds(pixels, {
    top: emblemBand[0],
    height: emblemBand[1] - emblemBand[0] + 1,
  });
  const full = contentBounds(pixels, { top: 0, height: pixels.height });

  console.log("Writing brand assets:");

  /*
   * Only the emblem ships as a standalone asset. The wordmark is set in black
   * with no outline, so it disappears against a dark surface and would need a
   * second, inverted copy to be usable — whereas the academy's name is already
   * rendered as text beside the emblem everywhere it appears, which recolours
   * itself for the colour scheme and stays selectable and readable to a screen
   * reader. The emblem survives either scheme on its own: the orange ball and
   * the white banner carry the shape once the black outline stops registering.
   */
  await write(
    "public/brand/rrba-mark.png",
    extractPadded(pixels, emblem, { width: 1024, height: 1024 }),
  );

  // Opaque, for the places that render a bare file. A transparent favicon
  // loses its black outline against a dark tab strip, and Apple composites
  // touch icons onto black.
  const markFor = (size) =>
    extractPadded(pixels, emblem, { width: size, height: size });

  await write(
    "app/icon.png",
    onWhite(await markFor(512).toBuffer(), { width: 512, height: 512 }),
  );
  await write(
    "app/apple-icon.png",
    onWhite(await markFor(180).toBuffer(), { width: 180, height: 180 }),
  );
  await write(
    "app/opengraph-image.png",
    onWhite(await extractPadded(pixels, full, { width: 460, height: 560 }).toBuffer(), {
      width: 1200,
      height: 630,
    }),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
