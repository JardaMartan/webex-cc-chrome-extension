/*
 * shared/urlTemplate.js — resolves the configurable screen-pop URL template
 * against an incoming task. Pure function, no chrome.* APIs, fully unit
 * testable (see tests/urlTemplate.test.js).
 *
 * Supported placeholders:
 *   {ani}          - caller number (also matched by the {callerNumber} alias)
 *   {taskId}       - the WxCC interaction id
 *   {queueName}    - the entry point / queue the call arrived on
 *   {cad.<name>}   - any Call Associated Data / Desktop variable, e.g. {cad.customerId}
 *
 * Unresolved placeholders are replaced with an empty string (never left
 * verbatim in the URL) and every substituted value is URI-encoded.
 */

const ALIASES = { callerNumber: 'ani' };

export function resolveTemplate(template, task) {
  if (!template || typeof template !== 'string') return '';
  const data = task || {};
  const cad = data.cad || {};

  return template.replace(/\{([\w.]+)\}/g, (match, rawKey) => {
    const key = ALIASES[rawKey] || rawKey;
    let value;
    if (key.startsWith('cad.')) {
      value = cad[key.slice(4)];
    } else {
      value = data[key];
    }
    if (value === undefined || value === null) return '';
    return encodeURIComponent(String(value));
  });
}
