/*
 * scripts/package-zip.js — zips the built dist/ folder into a single
 * crm-call-companion-<version>.zip at the repo root, so the extension can be
 * handed to a colleague as one file (they unzip it and "Load unpacked").
 * manifest.json ends up at the zip ROOT, not inside a subfolder — required
 * both for "Load unpacked" and for a Chrome Web Store upload.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'));
const outFile = path.join(root, `crm-call-companion-${manifest.version}.zip`);

if (!fs.existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

fs.rmSync(outFile, { force: true });
execFileSync('zip', ['-r', '-X', outFile, '.', '-x', '.DS_Store'], { cwd: distDir, stdio: 'inherit' });
console.log(`\nWrote ${path.relative(root, outFile)}`);
