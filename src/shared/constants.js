/*
 * shared/constants.js — message-type + storage-key constants shared by every
 * extension context (background, offscreen, widget content script, options,
 * popup). Keeping them in one file avoids typo'd string literals scattered
 * across postMessage/sendMessage call sites.
 */

// chrome.storage.local key holding the SettingsSchema (see shared/storage.js).
export const SETTINGS_KEY = 'crmCallCompanionSettings';

// chrome.storage.session key holding the current OAuth token set (never
// chrome.storage.local/sync — session storage is memory-only and is cleared
// when the browser fully closes, which is the right lifetime for a bearer token).
export const TOKEN_KEY = 'crmCallCompanionTokens';

// chrome.storage.local key holding purely cosmetic widget UI prefs (last
// dragged position, CAD panel fold state) — see shared/storage.js.
export const WIDGET_UI_KEY = 'crmCallCompanionWidgetUi';
export const DEFAULT_WIDGET_UI = {
  position: null, // { top, left } in px; null = default bottom-right corner
  cadCollapsed: false,
};

// ---- Commands: widget/popup/options -> background -> offscreen ----------
export const CMD = {
  START_LOGIN: 'CMD_START_LOGIN', // kicks off the OAuth (PKCE) flow
  LOGOUT: 'CMD_LOGOUT',
  STATION_LOGIN: 'CMD_STATION_LOGIN', // { teamId, loginOption, dialNumber }
  STATION_LOGOUT: 'CMD_STATION_LOGOUT',
  SET_AGENT_STATE: 'CMD_SET_AGENT_STATE', // { state: 'Available'|'Idle', auxCodeId }
  UPDATE_AGENT_PROFILE: 'CMD_UPDATE_AGENT_PROFILE', // { teamId?, loginOption?, dialNumber? } — no re-login needed
  GET_STATE: 'CMD_GET_STATE', // ask for a full state snapshot (initial hydrate)
  TASK_ACTION: 'CMD_TASK_ACTION', // { taskId, action, extra }
  OUTDIAL: 'CMD_OUTDIAL', // { phoneNumber }
  GET_TRANSFER_AGENTS: 'CMD_GET_TRANSFER_AGENTS', // -> [{id,name}] available agents
  GET_TRANSFER_QUEUES: 'CMD_GET_TRANSFER_QUEUES', // -> [{id,name}] telephony queues
  ENSURE_MICROPHONE: 'CMD_ENSURE_MICROPHONE', // -> { granted, message? } (offscreen mic warm-up)
  SET_AUDIO_DEVICES: 'CMD_SET_AUDIO_DEVICES', // { microphoneDeviceId, speakerDeviceId } pushed to offscreen (it can't read storage)
  LIST_AUDIO_DEVICES: 'CMD_LIST_AUDIO_DEVICES', // -> { inputs, outputs } as seen by the offscreen doc
  OPEN_OPTIONS: 'CMD_OPEN_OPTIONS', // opens the extension's options page (background-only; a content script cannot)
  UPLOAD_LOGS: 'CMD_UPLOAD_LOGS', // -> { feedbackId } for a Webex support ticket
  SCHEDULE_CALLBACK: 'CMD_SCHEDULE_CALLBACK', // ScheduleCallbackRequest -> CallbackSchedule
  UPDATE_CALLBACK: 'CMD_UPDATE_CALLBACK', // { id, request } -> CallbackSchedule (re-schedule)
  DELETE_CALLBACK: 'CMD_DELETE_CALLBACK', // { id } -> { deleted: true }
  GET_SCHEDULED_CALLBACKS: 'CMD_GET_SCHEDULED_CALLBACKS', // -> CallbackSchedule[]
};

// Task-control actions understood by CMD_TASK_ACTION / webexSdkClient.
export const TASK_ACTION = {
  ACCEPT: 'accept',
  DECLINE: 'decline',
  HOLD: 'hold',
  RESUME: 'resume',
  MUTE: 'mute',
  UNMUTE: 'unmute',
  END: 'end',
  WRAPUP: 'wrapup',
  TRANSFER: 'transfer', // extra: { to, destinationType: 'agent'|'queue' }
};

// SDK's DESTINATION_TYPE values relevant to a blind transfer.
export const TRANSFER_DESTINATION_TYPE = {
  AGENT: 'agent',
  QUEUE: 'queue',
};

// ---- Events: offscreen -> background -> widget/popup/options ------------
export const EVT = {
  STATE_CHANGED: 'EVT_STATE_CHANGED', // full state snapshot (source of truth lives in offscreen)
  INCOMING_TASK: 'EVT_INCOMING_TASK', // triggers the configurable screen-pop navigation
  ERROR: 'EVT_ERROR',
};

// ---- Registration: a widget instance (content script) announces itself so
// the background service worker knows which tabs to broadcast EVT_* to. ----
export const REG = {
  WIDGET_READY: 'REG_WIDGET_READY',
  WIDGET_CLOSED: 'REG_WIDGET_CLOSED',
};

// Message "source" tags so the background router can tell who sent what
// without relying on sender.tab / sender.url alone (offscreen documents and
// the extension's own popup/options pages have no sender.tab).
export const SOURCE = {
  WIDGET: 'widget',
  POPUP: 'popup',
  OPTIONS: 'options',
  OFFSCREEN: 'offscreen',
  BACKGROUND: 'background',
};

// How the widget picks its colour palette (settings.colorMode).
export const COLOR_MODE = {
  SYSTEM: 'system', // follow the OS/browser light-dark preference
  PAGE: 'page', // sample the host CRM page and blend in with it
  DEFAULT: 'default', // fixed Momentum light palette
};

export const AGENT_STATUS = {
  LOGGED_OUT: 'logged-out', // no access token
  CONNECTING: 'connecting', // registering the SDK
  REGISTERED: 'registered', // registered but not station-logged-in
  AVAILABLE: 'available', // station-logged-in, idle
  ON_CALL: 'on-call',
  WRAP_UP: 'wrap-up',
  ERROR: 'error',
};

export const DEFAULT_SETTINGS = {
  // URL pattern (substring or "*" glob) identifying the CRM tab the widget +
  // phone-number scanner should activate on. Empty/'*' = every page.
  crmUrlPattern: '',
  // Template resolved against the incoming task when a call arrives, then
  // used to navigate the matching CRM tab. Supports {ani}, {callerNumber},
  // {taskId}, {queueName}, and {cad.<name>} for any Desktop/CAD variable
  // exposed on the task (see shared/urlTemplate.js).
  screenPopUrlTemplate: '',
  // OAuth integration client id (public — safe to ship) + the URL of your
  // deployed token-exchange broker (see /broker). The client SECRET never
  // lives in this extension; see README "Security: why a broker?".
  oauthClientId: '',
  oauthScopes: 'cjp:user',
  brokerUrl: '',
  // Phone-number popover feature toggle.
  phoneDetectionEnabled: true,
  // MediaDeviceInfo.deviceId of the microphone to use for BROWSER/WebRTC
  // calls. Empty = follow the operating system's default input device.
  microphoneDeviceId: '',
  // MediaDeviceInfo.deviceId for call audio playback (ringtone + remote party).
  // Empty = follow the operating system's default output device.
  speakerDeviceId: '',
  // One of COLOR_MODE — how the widget derives its colour palette.
  colorMode: 'system',
  // 'auto' (follow the resolved page/browser language) or a supported
  // locale code from shared/i18n/locales.js.
  language: 'auto',
  // Working hours start/end in 24-hour format ("HH:mm") for the callback scheduler.
  workingHoursStart: '08:00',
  workingHoursEnd: '17:00',
};
