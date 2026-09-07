/*
 * shared/messaging.js — thin promisified wrapper around chrome.runtime
 * messaging, used by every context (widget content script, popup, options)
 * to talk to the background service worker. Pure message plumbing only — no
 * business logic, mirrors the api.js/storage.js "pure I/O layer" convention.
 */

/** Send a one-off command to the background router; resolves with its reply. */
export function sendCommand(source, type, payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ source, type, payload }, (reply) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(reply);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/** Subscribe to broadcast events (EVT_*) relayed by the background router. */
export function onEvent(cb) {
  const listener = (msg) => {
    if (!msg || !msg.type) return;
    cb(msg);
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
