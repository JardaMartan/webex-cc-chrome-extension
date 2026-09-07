/*
 * widget/theme/pageTheme.js — samples the host CRM page's own colours so the
 * widget can blend into it ("follow page" colour mode).
 *
 * Three inputs are read and everything else is derived from them (see
 * theme/palette.js):
 *   background — the page's surface, walking up from <body> until something
 *                opaque is found, because a transparent body is very common.
 *   text       — the body's computed text colour.
 *   accent     — the most saturated, readable colour used by the page's own
 *                links/buttons, which is in practice its brand colour.
 */
import { parseColor, flatten, contrastRatio, saturation, derivePalette } from './palette.js';

const WHITE = { r: 255, g: 255, b: 255, a: 1 };
// Enough to characterise a page without walking a huge DOM on every sample.
const ACCENT_SAMPLE_LIMIT = 60;

function firstOpaque(colors) {
  for (const value of colors) {
    const color = parseColor(value);
    if (color && color.a >= 1) return color;
  }
  return null;
}

function surfaceColor(doc, win) {
  const chain = [];
  for (let el = doc.body; el; el = el.parentElement) chain.push(win.getComputedStyle(el).backgroundColor);
  return firstOpaque(chain) || WHITE;
}

function detectAccent(doc, win, panel) {
  let best = null;
  let bestScore = 0;
  const nodes = doc.querySelectorAll('a[href], button, [role="button"]');
  const limit = Math.min(nodes.length, ACCENT_SAMPLE_LIMIT);
  for (let i = 0; i < limit; i += 1) {
    const el = nodes[i];
    if (!el.offsetParent) continue; // skip hidden/collapsed chrome
    const style = win.getComputedStyle(el);
    // A button's identity is its fill; a link's is its text colour.
    const raw = parseColor(style.backgroundColor)?.a >= 1 ? style.backgroundColor : style.color;
    const color = parseColor(raw);
    if (!color) continue;
    const flat = flatten(color, panel);
    const sat = saturation(flat);
    if (sat < 0.25) continue; // grey chrome, not a brand colour
    const contrast = contrastRatio(flat, panel);
    if (contrast < 2.5) continue;
    const score = sat * Math.min(contrast, 8);
    if (score > bestScore) {
      bestScore = score;
      best = flat;
    }
  }
  return best;
}

export function samplePageTheme(doc = document) {
  const win = doc.defaultView || window;
  if (!doc.body) return derivePalette({ background: WHITE, text: null, accent: null });
  const background = surfaceColor(doc, win);
  const text = parseColor(win.getComputedStyle(doc.body).color);
  return derivePalette({ background, text, accent: detectAccent(doc, win, background) });
}

/**
 * Re-samples when the page itself re-themes. Sites almost always do that by
 * toggling a class/attribute on <html> or <body> (e.g. `.dark`), so watching
 * those two attributes catches it without observing the whole document.
 */
export function observePageTheme(onChange, doc = document) {
  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(samplePageTheme(doc)), 250);
  };
  const observer = new MutationObserver(schedule);
  const options = { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] };
  observer.observe(doc.documentElement, options);
  if (doc.body) observer.observe(doc.body, options);
  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}
