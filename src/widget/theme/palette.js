/*
 * widget/theme/palette.js — colour maths and palette derivation.
 *
 * Deliberately DOM-free so the algorithm can be unit-tested (see
 * tests/palette.test.js); the page sampling that feeds it lives in
 * theme/pageTheme.js.
 *
 * Token values below are Momentum palette entries (@momentum-ui/tokens
 * colors.json): gray-05 #F7F7F7, gray-40 #B2B2B2, gray-80 #3B3B3B,
 * gray-90 #292929, gray-95 #1C1C1C, blue-40 #07C1F5.
 */

export const LIGHT_PALETTE = {
  '--panel': '#ffffff',
  '--border': '#dbe3ec',
  '--text': '#0a2236',
  '--text2': '#5b6b7b',
  '--accent': '#0e7fc1',
  '--bg': '#f4f7fa',
  '--active': '#cfe0ee',
};

export const DARK_PALETTE = {
  '--panel': '#292929',
  '--border': '#3b3b3b',
  '--text': '#f7f7f7',
  '--text2': '#b2b2b2',
  '--accent': '#07c1f5',
  '--bg': '#1c1c1c',
  '--active': '#092d3b',
};

const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };
// Momentum blue-60 (light surfaces) / blue-40 (dark surfaces).
const FALLBACK_ACCENT_ON_LIGHT = { r: 0, g: 122, b: 163, a: 1 };
const FALLBACK_ACCENT_ON_DARK = { r: 7, g: 193, b: 245, a: 1 };

export function parseColor(value) {
  if (!value) return null;
  const text = String(value).trim();
  const fn = text.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const parts = fn[1]
      .split(/[,\s/]+/)
      .filter((p) => p !== '')
      .map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some((n) => Number.isNaN(n))) return null;
    const a = parts.length > 3 && !Number.isNaN(parts[3]) ? parts[3] : 1;
    return { r: parts[0], g: parts[1], b: parts[2], a };
  }
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const h = hex[1];
    const wide = h.length <= 4 ? h.split('').map((c) => c + c).join('') : h;
    const n = (i) => parseInt(wide.slice(i * 2, i * 2 + 2), 16);
    return { r: n(0), g: n(1), b: n(2), a: wide.length === 8 ? n(3) / 255 : 1 };
  }
  return null;
}

export function toCss({ r, g, b }) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

export function mix(from, to, ratio) {
  const t = Math.max(0, Math.min(1, ratio));
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
    a: 1,
  };
}

// Composites a translucent colour over an opaque backdrop.
export function flatten(color, backdrop) {
  if (!color) return backdrop;
  if (color.a >= 1) return { ...color, a: 1 };
  return mix(backdrop, color, color.a);
}

export function luminance({ r, g, b }) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Luminance at which white and black text have EQUAL contrast against a
// surface: solving (1.05)/(L+0.05) = (L+0.05)/0.05 gives L = 0.1791. Below it
// white text wins, above it black does — so this is exactly the right place to
// split "dark surface" from "light surface". (A naive 0.5 midpoint would call
// mid-grey dark and then put white text on it, which is the less readable
// choice.)
const DARK_SURFACE_LUMINANCE = 0.1791;

export function isDarkColor(color) {
  return luminance(color) < DARK_SURFACE_LUMINANCE;
}

// 0 = grey, 1 = fully saturated. Used to tell a real accent colour from the
// greys that make up most of a page's chrome.
export function saturation({ r, g, b }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/**
 * Builds the widget's seven CSS custom properties from three colours sampled
 * off the host page. Everything else in the widget resolves through these.
 */
export function derivePalette({ background, text, accent }) {
  const panel = flatten(background, WHITE);
  const dark = isDarkColor(panel);
  const readableText = text && contrastRatio(flatten(text, panel), panel) >= 4.5 ? flatten(text, panel) : dark ? WHITE : BLACK;

  const fallbackAccent = dark ? FALLBACK_ACCENT_ON_DARK : FALLBACK_ACCENT_ON_LIGHT;
  const candidate = accent ? flatten(accent, panel) : null;
  // An accent that disappears into the panel is worse than no accent at all.
  const usableAccent = candidate && contrastRatio(candidate, panel) >= 2.5 ? candidate : fallbackAccent;

  return {
    palette: {
      '--panel': toCss(panel),
      // A secondary surface, nudged toward the text colour so it reads as
      // "slightly recessed" on light pages and "slightly raised" on dark ones.
      '--bg': toCss(mix(panel, readableText, 0.06)),
      '--border': toCss(mix(panel, readableText, 0.18)),
      '--text': toCss(readableText),
      '--text2': toCss(mix(readableText, panel, 0.35)),
      '--accent': toCss(usableAccent),
      '--active': toCss(mix(panel, usableAccent, 0.18)),
    },
    isDark: dark,
  };
}
