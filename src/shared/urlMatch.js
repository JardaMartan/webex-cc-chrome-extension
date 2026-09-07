/*
 * shared/urlMatch.js — lightweight substring/glob matcher for comparing a
 * tab's URL against the user-configured crmUrlPattern. Kept separate from
 * background/contentScriptRegistrar.js's match-pattern conversion because
 * chrome.tabs results are plain strings, not Chrome "match pattern" syntax.
 */
export function matchesPattern(url, pattern) {
  const p = (pattern || '').trim();
  if (!p || p === '*') return true;
  if (p.includes('*')) {
    const re = new RegExp(
      `^${p
        .split('*')
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')}`
    );
    return re.test(url);
  }
  return url.indexOf(p) !== -1;
}
