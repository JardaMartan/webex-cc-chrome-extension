/*
 * shared/injectCss.js — appends a <style> element with the given raw CSS text
 * into a root node (a ShadowRoot for the widget, or document.head for the
 * options/popup pages). CSS is imported via webpack's `asset/source` rule
 * (see webpack.config.js) so `cssText` is always a plain string at import time.
 */
export function injectCss(root, cssText, id) {
  const style = document.createElement('style');
  if (id) style.id = id;
  style.textContent = cssText;
  root.appendChild(style);
  return style;
}
