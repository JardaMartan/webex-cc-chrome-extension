/*
 * scripts/generate-icons.js — generates placeholder toolbar/store icons
 * (icons/icon16.png, icon32.png, icon48.png, icon128.png).
 *
 * The Chrome Web Store REQUIRES a manifest "icons" set (and a 128x128 for the
 * listing itself) — this project shipped with none. These are a flat,
 * unbranded "phone handset" glyph on the same blue already used for the
 * widget's primary button (Momentum blue-60, #007AA3) so nothing new is
 * invented — replace with real artwork before publishing if you have a logo.
 *
 * Drawn procedurally (signed-distance shapes + supersampled anti-aliasing)
 * rather than checked in as binary art so the design is reviewable as code
 * and reproducible with `node scripts/generate-icons.js`.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SIZES = [16, 32, 48, 128];
const OUT_DIR = path.resolve(__dirname, '..', 'icons');
const SUPERSAMPLE = 4;

const BG = [0x00, 0x7a, 0xa3]; // Momentum blue-60 — matches ccc-btn--blue
const FG = [0xff, 0xff, 0xff];

// Distance from point to a line segment, minus a radius — a positive result
// is outside the "capsule" (segment thickened by `r`), negative is inside.
function sdCapsule(px, py, ax, ay, bx, by, r) {
  const abx = bx - ax;
  const aby = by - ay;
  const abLen2 = abx * abx + aby * aby;
  let t = ((px - ax) * abx + (py - ay) * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy) - r;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

// A minimalist handset glyph: a diagonal bar with two larger round "ear/
// mouthpiece" caps — every coordinate is a fraction of the icon size (0..1)
// so the same shape definition scales cleanly to every output size.
function handsetCoverage(u, v) {
  const bar = sdCapsule(u, v, 0.32, 0.32, 0.68, 0.68, 0.085);
  const capA = sdCircle(u, v, 0.28, 0.28, 0.15);
  const capB = sdCircle(u, v, 0.72, 0.72, 0.15);
  const d = Math.min(bar, capA, capB);
  return d <= 0 ? 1 : 0;
}

function renderIcon(size) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const u = (x + (sx + 0.5) / SUPERSAMPLE) / size;
          const v = (y + (sy + 0.5) / SUPERSAMPLE) / size;
          hits += handsetCoverage(u, v);
        }
      }
      const coverage = hits / (SUPERSAMPLE * SUPERSAMPLE);
      const idx = (size * y + x) << 2;
      for (let c = 0; c < 3; c += 1) {
        png.data[idx + c] = Math.round(BG[c] + (FG[c] - BG[c]) * coverage);
      }
      png.data[idx + 3] = 255; // fully opaque square — no rounded-corner mask needed
    }
  }
  return png;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = path.join(OUT_DIR, `icon${size}.png`);
  const png = renderIcon(size);
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
