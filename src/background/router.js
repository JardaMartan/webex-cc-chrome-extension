/*
 * background/router.js — the service worker's single chrome.runtime.onMessage
 * entry point. Routes:
 *   widget/popup/options  --CMD_*-->  offscreen document (the SDK client)
 *   offscreen document     --EVT_*-->  every registered widget tab + popup/options
 *
 * Login/logout are handled here (not forwarded blindly) because they own
 * chrome.storage token lifecycle + the offscreen document's create/init.
 */
import { CMD, EVT, REG, SOURCE, AGENT_STATUS } from '../shared/constants.js';
import { getSettings, getTokens } from '../shared/storage.js';
import { startLogin, logout as oauthLogout } from './oauthBroker.js';
import { ensureOffscreenDocument } from './offscreenManager.js';
import { handleIncomingTask } from './screenPop.js';

// Tabs that currently host a mounted widget (content script). Broadcast target
// for EVT_* messages coming from the offscreen document.
//
// PERSISTED in chrome.storage.session, not just kept in memory: an MV3
// service worker is non-persistent and Chrome evicts/restarts it after ~30s
// idle, which wipes any plain module-level Set/variable. Without persisting
// this registry, a restart silently orphans every widget tab from EVT_*
// broadcasts (state changes, incoming-call screen-pop) with no error and no
// recovery except a full page reload — exactly the "widget sat idle, then
// login/wrap-up never updated the UI" reports. chrome.storage.session
// survives a service-worker restart (cleared only when the browser fully
// closes), so it's the right lifetime here.
const widgetTabs = new Set();
let crmTabId = null; // the one tab every screen-pop navigation reuses
const WIDGET_REGISTRY_KEY = 'crmCallCompanionWidgetRegistry';

const widgetRegistryReady = chrome.storage.session.get(WIDGET_REGISTRY_KEY).then((res) => {
  const saved = res[WIDGET_REGISTRY_KEY];
  if (!saved) return;
  (saved.tabIds || []).forEach((id) => widgetTabs.add(id));
  crmTabId = saved.crmTabId ?? null;
});

function persistWidgetRegistry() {
  chrome.storage.session.set({ [WIDGET_REGISTRY_KEY]: { tabIds: [...widgetTabs], crmTabId } });
}

// Offscreen EVT_* messages arrive as independent onMessage calls; without
// this, two handleOffscreenEvent(...) calls fired back-to-back (e.g. a burst
// of state changes during login/wrap-up) run CONCURRENTLY, and their
// `chrome.tabs.sendMessage` broadcasts are not guaranteed to land in the same
// order they were sent — an older, incomplete snapshot arriving after a newer
// one clobbers it (state.js `hydrate` does a full-object merge). Chaining
// onto this promise forces strictly in-order processing.
let offscreenEventQueue = Promise.resolve();

chrome.tabs.onRemoved.addListener((tabId) => {
  widgetTabs.delete(tabId);
  if (crmTabId === tabId) crmTabId = null;
  persistWidgetRegistry();
});

function sendToOffscreen(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ source: SOURCE.BACKGROUND, type, payload }, (reply) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(reply);
    });
  });
}

async function broadcastToWidgets(msg) {
  for (const tabId of widgetTabs) {
    try {
      await chrome.tabs.sendMessage(tabId, msg);
    } catch (err) {
      // Tab navigated away / no listener yet — will re-hydrate via WIDGET_READY.
    }
  }
  // Popup/options windows aren't in widgetTabs; best-effort broadcast, ignore
  // "Could not establish connection" when nothing is listening.
  try {
    await chrome.runtime.sendMessage(msg);
  } catch (err) {
    /* no popup/options open */
  }
}

// Kicks off SDK registration inside the offscreen document without blocking
// the caller. Deliberately NOT awaited anywhere: cc.register() can take a
// while (or hang on a slow/misbehaving network) and its progress is reported
// separately via EVT_STATE_CHANGED broadcasts (CONNECTING -> REGISTERED/ERROR).
// Awaiting it would block the command response — and therefore the widget's
// login() thunk / button spinner — until registration finishes, turning any
// SDK hang into an indefinite, unexplained spinner.
// NOTE: offscreen.js catches its own errors and replies normally with
// `{error}` rather than rejecting the message channel, so a failure resolves
// here (doesn't reject) — check the resolved value too, not just .catch(), or
// this log never fires. The FULL trace is only in the offscreen document's
// own console (see offscreen.js).
function initSdkInBackground(accessToken) {
  sendToOffscreen('CMD_INIT_SDK', { accessToken })
    .then((reply) => {
      if (reply?.error) console.error('[crm-call-companion] SDK init failed:', reply.error);
    })
    .catch((err) => {
      console.error('[crm-call-companion] SDK init message failed', err);
    });
}

async function handleWidgetOrUiCommand(msg, sender) {
  await widgetRegistryReady;
  const { type, payload } = msg;

  // Self-heal on EVERY widget-originated message, not just WIDGET_READY: if
  // the service worker was restarted and the persisted registry somehow
  // missed this tab, any subsequent command from it re-establishes the
  // registration rather than waiting for the widget to reload.
  if (msg.source === SOURCE.WIDGET && sender.tab?.id != null && !widgetTabs.has(sender.tab.id)) {
    widgetTabs.add(sender.tab.id);
    persistWidgetRegistry();
  }

  if (type === REG.WIDGET_READY) {
    if (sender.tab?.id != null) {
      widgetTabs.add(sender.tab.id);
      crmTabId = sender.tab.id;
      persistWidgetRegistry();
    }
    await ensureOffscreenDocument();
    const tokens = await getTokens();
    if (!tokens) return { agentStatus: AGENT_STATUS.LOGGED_OUT };
    try {
      const state = await sendToOffscreen(CMD.GET_STATE, {});
      // We still hold a valid token but the SDK in the offscreen document has
      // never registered — which is exactly what a browser restart or an
      // evicted/recreated offscreen document looks like. Without this the
      // widget showed a "Sign in with Webex" button to an already-signed-in
      // agent, and only an explicit re-login recovered. Register again in the
      // background and report CONNECTING so the UI is truthful meanwhile.
      if (state?.agentStatus === AGENT_STATUS.LOGGED_OUT && !state?.error) {
        initSdkInBackground(tokens.access_token);
        return { ...state, agentStatus: AGENT_STATUS.CONNECTING, error: null };
      }
      return state;
    } catch (err) {
      return { agentStatus: AGENT_STATUS.LOGGED_OUT };
    }
  }

  if (type === REG.WIDGET_CLOSED) {
    if (sender.tab?.id != null) {
      widgetTabs.delete(sender.tab.id);
      persistWidgetRegistry();
    }
    return { ok: true };
  }

  if (type === CMD.START_LOGIN) {
    const tokens = await startLogin();
    await ensureOffscreenDocument();
    initSdkInBackground(tokens.access_token);
    return { ok: true };
  }

  if (type === CMD.LOGOUT) {
    try {
      await sendToOffscreen('CMD_TEARDOWN_SDK', {});
    } catch (err) {
      /* offscreen may already be gone */
    }
    await oauthLogout();
    return { ok: true };
  }

  if (type === CMD.ENSURE_MICROPHONE) {
    await ensureOffscreenDocument();
    return sendToOffscreen(CMD.ENSURE_MICROPHONE, {});
  }

  if (type === CMD.OPEN_OPTIONS) {
    // chrome.runtime.openOptionsPage() only works from a background/extension
    // context — a content-script widget cannot call it directly.
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }

  // Everything else (station login/out, task actions, outdial, get-state) is a
  // thin pass-through to the offscreen document, which owns the SDK.
  await ensureOffscreenDocument();
  return sendToOffscreen(type, payload);
}

async function handleOffscreenEvent(msg) {
  await widgetRegistryReady;
  const { type, payload } = msg;
  await broadcastToWidgets(msg);
  if (type === EVT.INCOMING_TASK) {
    const settings = await getSettings();
    try {
      const result = await handleIncomingTask(payload, settings, crmTabId);
      if (result?.tabId != null) {
        crmTabId = result.tabId;
        persistWidgetRegistry();
      }
    } catch (err) {
      console.error('[crm-call-companion] screen-pop failed', err);
    }
  }
}

export function registerRouter() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.source) return undefined;

    if (msg.source === SOURCE.OFFSCREEN) {
      offscreenEventQueue = offscreenEventQueue
        .then(() => handleOffscreenEvent(msg))
        .catch((err) => console.error('[crm-call-companion] offscreen event handling failed', err));
      return undefined; // no reply expected
    }

    handleWidgetOrUiCommand(msg, sender)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep the message channel open for the async response
  });
}
