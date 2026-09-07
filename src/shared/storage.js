/*
 * shared/storage.js — thin wrapper around chrome.storage. Pure I/O, no
 * business logic (mirrors the api.js convention from the task-management
 * widget: this layer only reads/writes; callers own what to do with it).
 */
import { SETTINGS_KEY, TOKEN_KEY, DEFAULT_SETTINGS, WIDGET_UI_KEY, DEFAULT_WIDGET_UI } from './constants.js';

export async function getSettings() {
  const res = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}) };
}

// A pasted client ID/URL/scope list commonly carries stray leading/trailing
// whitespace (copied from a browser address bar, a Slack message, etc.) that
// silently breaks equality checks (redirect URI matching, exact `<all_urls>`
// substrings) with no visible symptom — trim every string field once here,
// at the single write path, rather than fixing it up in each read site.
function trimStrings(obj) {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (typeof out[key] === 'string') out[key] = out[key].trim();
  }
  return out;
}

export async function setSettings(patch) {
  const current = await getSettings();
  const next = trimStrings({ ...current, ...patch });
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export function onSettingsChanged(cb) {
  const listener = (changes, area) => {
    if (area !== 'local' || !changes[SETTINGS_KEY]) return;
    cb(changes[SETTINGS_KEY].newValue || DEFAULT_SETTINGS);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// Tokens live in chrome.storage.session: in-memory only, per-browser-session,
// never persisted to disk — the right lifetime for a bearer/refresh token pair.
export async function getTokens() {
  const res = await chrome.storage.session.get(TOKEN_KEY);
  return res[TOKEN_KEY] || null;
}

export async function setTokens(tokens) {
  await chrome.storage.session.set({ [TOKEN_KEY]: tokens });
}

export async function clearTokens() {
  await chrome.storage.session.remove(TOKEN_KEY);
}

export async function getWidgetUi() {
  const res = await chrome.storage.local.get(WIDGET_UI_KEY);
  return { ...DEFAULT_WIDGET_UI, ...(res[WIDGET_UI_KEY] || {}) };
}

export async function setWidgetUi(patch) {
  const current = await getWidgetUi();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [WIDGET_UI_KEY]: next });
  return next;
}
