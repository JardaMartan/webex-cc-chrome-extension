/*
 * background/screenPop.js — on an incoming call, resolves the configured
 * screen-pop URL template and navigates the CRM tab (falls back to opening a
 * new tab only if none is open). See shared/urlTemplate.js for the
 * placeholder syntax and shared/urlMatch.js for how the CRM tab is found.
 */
import { resolveTemplate } from '../shared/urlTemplate.js';
import { matchesPattern } from '../shared/urlMatch.js';

export async function handleIncomingTask(task, settings, preferredTabId) {
  if (!settings.screenPopUrlTemplate) return null;
  const url = resolveTemplate(settings.screenPopUrlTemplate, task);
  if (!url) return null;

  // Always reuse the SAME browser tab for every screen-pop (never spawn
  // additional ones) — prefer the tab the caller already knows hosts the
  // widget/CRM page over re-querying/matching by URL pattern, which can miss
  // the tab (e.g. its current URL no longer matches crmUrlPattern) and fall
  // through to creating a new one every time.
  let target = null;
  if (preferredTabId != null) {
    try {
      target = await chrome.tabs.get(preferredTabId);
    } catch (err) {
      target = null; // tab was closed
    }
  }

  if (!target) {
    const tabs = await chrome.tabs.query({});
    target = tabs.find((t) => t.url && matchesPattern(t.url, settings.crmUrlPattern));
  }

  if (target) {
    await chrome.tabs.update(target.id, { url, active: true });
    if (target.windowId != null) {
      try {
        await chrome.windows.update(target.windowId, { focused: true });
      } catch (err) {
        /* window may have been closed between query and update */
      }
    }
    return { tabId: target.id, url, mode: 'navigated' };
  }

  const created = await chrome.tabs.create({ url });
  return { tabId: created.id, url, mode: 'created' };
}
