/*
 * widget/ui/momentumSvg.js — normalises a Momentum SVG asset for inline use.
 *
 * Momentum ships its icons both as a font (unusable inside our shadow root —
 * the @font-face never applies and every glyph renders as a padlock) and as
 * raw SVG. These are the SVGs, recoloured to a single `currentColor` so the
 * surrounding element's state drives the glyph.
 *
 * Source is always a build-time import from node_modules — static, trusted
 * markup that never contains user input.
 */
export function toInlineSvg(source, size) {
  return source
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/\sfill="[^"]*"/g, '')
    .replace(/^<svg/, `<svg fill="currentColor" focusable="false"`)
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`);
}
