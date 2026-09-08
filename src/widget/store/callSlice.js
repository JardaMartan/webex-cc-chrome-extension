/*
 * widget/store/callSlice.js — Redux Toolkit slice for the content-script
 * widget. Mirrors the task-management widget's convention: components only
 * dispatch thunks/read selectors; all messaging goes through
 * shared/messaging.js (the "pure API layer" here, since there is no
 * SDK/API call in-process — everything is delegated to the background
 * router / offscreen document).
 */
import { createSlice } from '@reduxjs/toolkit';
import { CMD, REG, SOURCE, AGENT_STATUS } from '../../shared/constants.js';
import { sendCommand } from '../../shared/messaging.js';

const initialState = {
  agentStatus: AGENT_STATUS.LOGGED_OUT,
  agent: null,
  teams: [],
  loginVoiceOptions: [],
  idleCodes: [],
  wrapupCodes: [],
  subStatus: null,
  auxCodeId: null,
  dn: null,
  teamId: null,
  loginOption: null,
  dialNumber: null,
  activeTask: null,
  held: false,
  recordingPaused: false,
  consultState: null,
  conferenceActive: false,
  error: null,
  loading: false,
  // Set when the agent asks to schedule a callback for a number on the page;
  // the widget opens its callback form for it.
  callbackDraft: null,
  // Mic health, refreshed periodically (see WidgetApp) rather than only at
  // login — a call answered in the hidden offscreen document degrades
  // silently (no audio) if the OS/browser revokes access mid-session, and
  // that only surfaces on the NEXT call unless it's actively re-checked.
  // null = not checked yet, so no warning flashes before the first result.
  micGranted: null,
  micMessage: null,
  // Last-applied snapshot sequence number from webexSdkClient (see its
  // `_seq`) — null until the first hydrate, so that one is never rejected.
  _seq: null,
  // Resolved UI locale (see shared/i18n/resolveLocale.js) — set once at mount
  // and on settings changes (widget/index.js), read by every component via
  // useT(). Lives in Redux (not React context) so the plain-DOM phone-popover
  // scanner can translate its own injected buttons too.
  locale: 'en',
};

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    hydrate(state, action) {
      // EVT_STATE_CHANGED broadcasts are independent messages; if one
      // carrying an OLDER snapshot (lower `_seq`) is ever delivered after a
      // newer one — a burst of state changes during login/wrap-up racing
      // through the background relay — applying it would clobber the newer
      // data (e.g. wrap-up codes reverting to empty) until a manual refresh.
      // Hand-rolled payloads (e.g. logout's) carry no `_seq` and always apply.
      const incomingSeq = action.payload?._seq;
      if (typeof incomingSeq === 'number' && typeof state._seq === 'number' && incomingSeq <= state._seq) {
        return state;
      }
      // NOTE: do not force error:null here — action.payload already carries
      // the authoritative `error` field from the offscreen SDK client's own
      // state (null when healthy, a message when init/register failed).
      // Overwriting it unconditionally silently discarded real failure
      // reasons, making a failed sign-in look like it did nothing.
      return { ...state, ...action.payload, loading: false };
    },
    setLoading(state, action) {
      state.loading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
      state.loading = false;
    },
    clearError(state) {
      state.error = null;
    },
    startCallbackDraft(state, action) {
      state.callbackDraft = { callbackNumber: action.payload || '' };
    },
    clearCallbackDraft(state) {
      state.callbackDraft = null;
    },
    setMicStatus(state, action) {
      state.micGranted = !!action.payload.granted;
      state.micMessage = action.payload.message || null;
    },
    setLocale(state, action) {
      state.locale = action.payload;
    },
  },
});

export const {
  hydrate,
  setLoading,
  setError,
  clearError,
  startCallbackDraft,
  clearCallbackDraft,
  setMicStatus,
  setLocale,
} = callSlice.actions;
export default callSlice.reducer;

// ---- Thunks -----------------------------------------------------------
// Every thunk fires a command and (optimistically) toggles `loading`; the
// authoritative state update always arrives later via the EVT_STATE_CHANGED
// broadcast handled in widget/index.js, not via the command's reply.

export const initWidget = () => async (dispatch) => {
  try {
    const state = await sendCommand(SOURCE.WIDGET, REG.WIDGET_READY);
    dispatch(hydrate(state));
  } catch (err) {
    dispatch(setError(err.message));
  }
};

export const login = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await sendCommand(SOURCE.WIDGET, CMD.START_LOGIN);
  } catch (err) {
    dispatch(setError(err.message));
  }
};

export const logout = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await sendCommand(SOURCE.WIDGET, CMD.LOGOUT);
    dispatch(hydrate({ agentStatus: AGENT_STATUS.LOGGED_OUT, agent: null, activeTask: null }));
  } catch (err) {
    dispatch(setError(err.message));
  }
};

export const stationLogin = (opts) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const state = await sendCommand(SOURCE.WIDGET, CMD.STATION_LOGIN, opts);
    dispatch(hydrate(state));
  } catch (err) {
    dispatch(setError(err.message));
  }
};

export const stationLogout = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const state = await sendCommand(SOURCE.WIDGET, CMD.STATION_LOGOUT);
    dispatch(hydrate(state));
  } catch (err) {
    dispatch(setError(err.message));
  }
};

export const setAgentState = (opts) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const state = await sendCommand(SOURCE.WIDGET, CMD.SET_AGENT_STATE, opts);
    dispatch(hydrate(state));
  } catch (err) {
    dispatch(setError(err.message));
  }
};

export const updateAgentProfile = (opts) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const state = await sendCommand(SOURCE.WIDGET, CMD.UPDATE_AGENT_PROFILE, opts);
    if (state?.error && !state.agentStatus) throw new Error(state.error);
    dispatch(hydrate(state));
  } catch (err) {
    dispatch(setError(err.message));
  }
};

export const taskAction = (taskId, action, extra) => async (dispatch) => {
  try {
    await sendCommand(SOURCE.WIDGET, CMD.TASK_ACTION, { taskId, action, extra });
  } catch (err) {
    dispatch(setError(err.message));
  }
};

export const outdial = (phoneNumber) => async (dispatch) => {
  try {
    await sendCommand(SOURCE.WIDGET, CMD.OUTDIAL, { phoneNumber });
  } catch (err) {
    dispatch(setError(err.message));
  }
};

// Plain data fetches for the transfer picker — return the list to the caller
// rather than touching call state (taskAction(..., TRANSFER, ...) is what
// actually performs the transfer, same command as Accept/Hold/End/etc.).
export const fetchTransferAgents = () => async (dispatch) => {
  try {
    return await sendCommand(SOURCE.WIDGET, CMD.GET_TRANSFER_AGENTS);
  } catch (err) {
    dispatch(setError(err.message));
    return [];
  }
};

export const fetchTransferQueues = () => async (dispatch) => {
  try {
    return await sendCommand(SOURCE.WIDGET, CMD.GET_TRANSFER_QUEUES);
  } catch (err) {
    dispatch(setError(err.message));
    return [];
  }
};

// Device IDs are salted per origin, so the list must come from the offscreen
// document — the one that actually opens the mic and plays the call audio.
export const fetchAudioDevices = () => async (dispatch) => {
  try {
    const result = await sendCommand(SOURCE.WIDGET, CMD.LIST_AUDIO_DEVICES);
    if (result?.error) throw new Error(result.error);
    return { inputs: result?.inputs || [], outputs: result?.outputs || [] };
  } catch (err) {
    dispatch(setError(err.message));
    return { inputs: [], outputs: [] };
  }
};

export const uploadLogs = () => async (dispatch) => {
  try {
    const result = await sendCommand(SOURCE.WIDGET, CMD.UPLOAD_LOGS);
    if (result?.error) throw new Error(result.error);
    return result?.feedbackId || null;
  } catch (err) {
    dispatch(setError(err.message));
    return null;
  }
};

// Deliberately does NOT dispatch setError on a block — that banner is meant
// for unexpected failures, and a mic block is common/expected (a fresh
// install, a revoked OS permission) with its own dedicated warning + fix-it
// button (see WidgetApp), so surfacing it twice would be redundant.
export const checkMicrophone = () => async (dispatch) => {
  try {
    const result = await sendCommand(SOURCE.WIDGET, CMD.ENSURE_MICROPHONE);
    dispatch(setMicStatus({ granted: !!result?.granted, message: result?.message || null }));
  } catch (err) {
    dispatch(setMicStatus({ granted: false, message: err.message }));
  }
};

// Routed through the background service worker: chrome.runtime.openOptionsPage()
// is not usable from a content script.
export const openExtensionOptions = () => async () => {
  await sendCommand(SOURCE.WIDGET, CMD.OPEN_OPTIONS);
};


// Resolves to the created CallbackSchedule, or throws so the form can show the
// failure inline next to the fields the agent just filled in.
export const scheduleCallback = (request) => async () => {
  const result = await sendCommand(SOURCE.WIDGET, CMD.SCHEDULE_CALLBACK, request);
  if (result?.error) throw new Error(result.error);
  return result;
};

export const rescheduleCallback = (id, request) => async () => {
  const result = await sendCommand(SOURCE.WIDGET, CMD.UPDATE_CALLBACK, { id, request });
  if (result?.error) throw new Error(result.error);
  return result;
};

export const deleteCallback = (id) => async () => {
  const result = await sendCommand(SOURCE.WIDGET, CMD.DELETE_CALLBACK, { id });
  if (result?.error) throw new Error(result.error);
  return true;
};

export const fetchScheduledCallbacks = (params) => async (dispatch) => {
  try {
    const result = await sendCommand(SOURCE.WIDGET, CMD.GET_SCHEDULED_CALLBACKS, params);
    if (result?.error) throw new Error(result.error);
    return result?.callbacks || [];
  } catch (err) {
    dispatch(setError(err.message));
    return [];
  }
};
