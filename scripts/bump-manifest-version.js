/*
 * scripts/bump-manifest-version.js — auto-increments manifest.json's patch
 * version before every production build (wired as npm's "prebuild" hook), so
 * chrome://extensions visibly shows a new Version number after each reload —
 * otherwise there is no on-disk signal that a `Load unpacked` reload actually
 * picked up fresh code (Chrome reloads unconditionally regardless of version,
 * but a human staring at the same "0.1.0" has no way to tell that happened).
 */
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const parts = manifest.version.split('.').map(Number);
parts[2] = (parts[2] || 0) + 1;
manifest.version = parts.join('.');

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json version bumped -> ${manifest.version}`);
