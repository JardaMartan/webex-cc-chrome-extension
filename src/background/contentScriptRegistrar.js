/*
 * background/contentScriptRegistrar.js — registers the widget content script
 * (dist/content.js) dynamically against the CRM URL pattern configured in
 * Options, instead of a static manifest `content_scripts` entry. This is what
 * makes "the web page URL is configurable in the browser plugin settings"
 * possible without shipping a new build every time an agent's CRM domain
 * changes.
 */
const SCRIPT_ID = 'crm-widget';

// Chrome match-pattern host rules are strict: the host segment may only be
// `*` (any host) or `*.<domain>` (that domain + subdomains) — a wildcard
// EMBEDDED anywhere else (e.g. `*smile-crm-finder.lovable.app*`) is rejected
// at registration time with "Invalid host wildcard". Path segments have no
// such restriction, so wildcards there are fine.
function sanitizeHost(host) {
  if (!host || host === '*') return '*';
  if (host.startsWith('*.')) return host; // valid subdomain wildcard, keep as-is
  return host.replace(/\*/g, ''); // strip any other embedded wildcard — invalid as a host
}

function sanitizePath(path) {
  if (!path) return '/*';
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash.endsWith('*') ? withSlash : `${withSlash}*`;
}

export function toMatchPatterns(pattern) {
  const p = (pattern || '').trim();
  if (!p || p === '*') return ['<all_urls>'];
  if (p.includes('://')) {
    const m = p.match(/^([a-zA-Z][\w+.-]*):\/\/([^/]*)(\/.*)?$/);
    if (!m) return ['<all_urls>']; // malformed input — fall back rather than register garbage
    const [, scheme, host, path] = m;
    return [`${scheme}://${sanitizeHost(host)}${sanitizePath(path)}`];
  }
  // Bare host/substring, e.g. "crm.example.com" or "example.com/accounts".
  const slashIdx = p.indexOf('/');
  const host = slashIdx === -1 ? p : p.slice(0, slashIdx);
  const path = slashIdx === -1 ? '' : p.slice(slashIdx);
  return [`*://${sanitizeHost(host)}${sanitizePath(path)}`];
}

export async function syncContentScriptRegistration(settings) {
  const matches = toMatchPatterns(settings.crmUrlPattern);
  const scripts = [
    {
      id: SCRIPT_ID,
      matches,
      js: ['content.js'],
      runAt: 'document_idle',
      persistAcrossSessions: true,
    },
  ];

  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (existing.length > 0) {
    await chrome.scripting.updateContentScripts(scripts);
  } else {
    await chrome.scripting.registerContentScripts(scripts);
  }
}
