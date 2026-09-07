/*
 * sdk/webexSdkClient.js — thin wrapper around the Webex Contact Center SDK.
 * This is the ONLY file that imports the SDK; it is only ever loaded inside
 * the offscreen document (see offscreen/offscreen.js), never in the widget
 * content-script bundle.
 *
 * Every method/event name below was VERIFIED against the shipped TypeScript
 * declarations in node_modules/@webex/contact-center/dist/types/{cc,
 * services/task/index,services/task/types,services/config/types}.d.ts
 * (package version 3.12.0, pulled in transitively via the `webex` dependency)
 * — not guessed from prose. Key facts from that source:
 *   - `new Webex({ credentials: 'ACCESS_TOKEN' })` (bare string), then
 *     `webex.cc` is the ContactCenter plugin instance.
 *   - `cc.register()` -> Promise<Profile> ({ teams: {teamId,teamName}[],
 *     loginVoiceOptions?: ('AGENT_DN'|'EXTENSION'|'BROWSER')[],
 *     idleCodes: Entity[], wrapupCodes: Entity[], agentId, ... }).
 *   - `cc.stationLogin({ teamId, loginOption, dialNumber? })`, then the agent
 *     is NOT automatically Available — call `cc.setAgentState({state:
 *     'Available', auxCodeId: '0'})` explicitly (shown in the SDK's own
 *     startOutdial() example).
 *   - `cc.startOutdial(destination, origin)` — `origin` is an outdial ANI in
 *     E.164 format, fetched via `cc.getOutdialAniEntries({...})`.
 *   - `cc.on('task:incoming', task => ...)`; per-task lifecycle events are
 *     then subscribed on the TASK object itself: 'task:assigned', 'task:hold',
 *     'task:resume', 'task:end', 'task:wrapup', 'task:wrappedup',
 *     'task:rejected'. Task methods: accept(), decline(), hold(mediaResourceId?),
 *     resume(mediaResourceId?), toggleMute() (single toggle, no separate
 *     mute/unmute), end(), wrapup({auxCodeId, wrapUpReason}).
 *   - ANI/customer number lives at `task.data.interaction
 *     .callProcessingDetails.ani` (NOT `callAssociatedDetails` as an earlier
 *     external sample suggested); queue name at `task.data.queueName`. VERIFIED
 *     live: for OUTBOUND tasks `.ani` is the AGENT's own outdial ANI (caller
 *     id) instead — the customer/dialed number there is `.dnis`. Direction
 *     itself is at `task.data.interaction.contactDirection.type`
 *     ('INBOUND'/'OUTBOUND').
 *   - CORRECTION of an earlier wrong assumption: Call-Associated-Data DOES
 *     exist, at `task.data.interaction.callAssociatedData` — a map keyed by
 *     variable name to `{name, displayName, value, agentViewable, isSecure,
 *     ...}` (VERIFIED live from an AgentOutboundFailed routing payload).
 *     `FC-DESKTOP-VIEW` is Desktop's own internal layout-config blob, not
 *     real business data — excluded from what we surface.
 */
import Webex from 'webex';
import { AGENT_STATUS, TASK_ACTION } from '../shared/constants.js';

// Every public event this SDK version emits, transcribed from its OWN enums:
//   node_modules/@webex/contact-center/dist/services/agent/types.js (AGENT_EVENTS)
//   node_modules/@webex/contact-center/dist/services/task/types.js  (TASK_EVENTS)
// Kept as local literals rather than imported from '@webex/contact-center'
// because this app depends on `webex`, which pulls that package in
// transitively — a direct import risks resolving a SECOND, differently
// versioned copy whose enum values need not match the instance we listen on.
//
// Emitter (verified in dist/services/task/TaskManager.js: `this.emit` vs
// `task.emit`): only INCOMING, HYDRATE, OFFER_CONTACT, MERGED and
// CAMPAIGN_PREVIEW_RESERVATION are emitted on the cc plugin; every other task
// event is emitted on the Task object itself, so it can only be observed after
// that task has been handed to us by one of the five above.
const AGENT_EVENT = {
  STATE_CHANGE: 'agent:stateChange',
  STATE_CHANGE_SUCCESS: 'agent:stateChangeSuccess',
  STATE_CHANGE_FAILED: 'agent:stateChangeFailed',
  STATION_LOGIN_SUCCESS: 'agent:stationLoginSuccess',
  STATION_LOGIN_FAILED: 'agent:stationLoginFailed',
  LOGOUT_SUCCESS: 'agent:logoutSuccess',
  LOGOUT_FAILED: 'agent:logoutFailed',
  RELOGIN_SUCCESS: 'agent:reloginSuccess',
  DN_REGISTERED: 'agent:dnRegistered',
  MULTI_LOGIN: 'agent:multiLogin',
};

const TASK_EVENT = {
  // cc-level (TaskManager.this.emit)
  INCOMING: 'task:incoming',
  HYDRATE: 'task:hydrate',
  OFFER_CONTACT: 'task:offerContact',
  MERGED: 'task:merged',
  CAMPAIGN_PREVIEW_RESERVATION: 'task:campaignPreviewReservation',
  // task-level (task.emit)
  MEDIA: 'task:media',
  ASSIGNED: 'task:assigned',
  AUTO_ANSWERED: 'task:autoAnswered',
  UNASSIGNED: 'task:unassigned',
  HOLD: 'task:hold',
  RESUME: 'task:resume',
  END: 'task:end',
  WRAPUP: 'task:wrapup',
  WRAPPEDUP: 'task:wrappedup',
  REJECT: 'task:rejected',
  OUTDIAL_FAILED: 'task:outdialFailed',
  POST_CALL_ACTIVITY: 'task:postCallActivity',
  RECORDING_PAUSED: 'task:recordingPaused',
  RECORDING_PAUSE_FAILED: 'task:recordingPauseFailed',
  RECORDING_RESUMED: 'task:recordingResumed',
  RECORDING_RESUME_FAILED: 'task:recordingResumeFailed',
  CONSULT_CREATED: 'task:consultCreated',
  OFFER_CONSULT: 'task:offerConsult',
  CONSULTING: 'task:consulting',
  CONSULT_ACCEPTED: 'task:consultAccepted',
  CONSULT_END: 'task:consultEnd',
  CONSULT_QUEUE_CANCELLED: 'task:consultQueueCancelled',
  CONSULT_QUEUE_FAILED: 'task:consultQueueFailed',
  CONFERENCE_ESTABLISHING: 'task:conferenceEstablishing',
  CONFERENCE_STARTED: 'task:conferenceStarted',
  CONFERENCE_ENDED: 'task:conferenceEnded',
  CONFERENCE_FAILED: 'task:conferenceFailed',
  CONFERENCE_END_FAILED: 'task:conferenceEndFailed',
  CONFERENCE_TRANSFERRED: 'task:conferenceTransferred',
  CONFERENCE_TRANSFER_FAILED: 'task:conferenceTransferFailed',
  PARTICIPANT_JOINED: 'task:participantJoined',
  PARTICIPANT_LEFT: 'task:participantLeft',
  PARTICIPANT_LEFT_FAILED: 'task:participantLeftFailed',
};

const TASK_METHOD_MAP = {
  [TASK_ACTION.ACCEPT]: 'accept',
  [TASK_ACTION.DECLINE]: 'decline',
  [TASK_ACTION.HOLD]: 'hold',
  [TASK_ACTION.RESUME]: 'resume',
  [TASK_ACTION.MUTE]: 'toggleMute',
  [TASK_ACTION.UNMUTE]: 'toggleMute', // same toggle method — the SDK has no separate mute/unmute
  [TASK_ACTION.END]: 'end',
  [TASK_ACTION.WRAPUP]: 'wrapup',
};

// Failure events carry the server's machine reason (e.g. AGENT_HAS_ASSIGNED_
// CONTACTS, RONA) plus an optional reasonCode — surface something readable.
function reasonText(payload, fallback) {
  if (typeof payload === 'string' && payload) return payload;
  return payload?.reason || payload?.message || payload?.reasonCode || fallback;
}

// This client is a telephony-only softphone: it answers calls over WebRTC and
// has no UI for chat/email/social interactions. WxCC agent state is a single
// SESSION-wide value — the SDK's setAgentState takes only {state, auxCodeId}
// and the agent service exposes just four endpoints (reload/login/logout/
// session/state), so there is no way for a client to be Available on
// telephony while Not Ready elsewhere. Per-channel eligibility is decided by
// the agent's Multimedia Profile in Control Hub instead. What we CAN do is
// refuse to take ownership of anything that is not a phone call, so a digital
// task routed to this agent is left untouched for whatever does handle it
// rather than being half-rendered here.
const MEDIA_CHANNEL_TELEPHONY = 'telephony';
function isTelephonyTask(task) {
  const mediaType = task?.data?.interaction?.mediaType;
  // Treat an absent mediaType as a call — never drop a real one on a guess.
  return !mediaType || mediaType === MEDIA_CHANNEL_TELEPHONY;
}

function serializeTask(task) {
  if (!task?.data) return null;
  const interaction = task.data.interaction || {};
  const cpd = interaction.callProcessingDetails || {};
  const direction = interaction.contactDirection?.type || null;
  // Outbound: cpd.ani is OUR OWN outdial ANI, not the customer — the number
  // we actually dialed (the customer) is cpd.dnis instead (see file header).
  const customerNumber = direction === 'OUTBOUND' ? cpd.dnis || cpd.ani : cpd.ani || cpd.displayAni;
  const cadEntries = Object.values(interaction.callAssociatedData || {})
    .filter((v) => v?.agentViewable && v.name !== 'FC-DESKTOP-VIEW')
    .map((v) => ({ name: v.name, displayName: v.displayName || v.name, value: v.value ?? '' }));
  const cad = {};
  cadEntries.forEach((e) => {
    cad[e.name] = e.value;
  });
  return {
    taskId: task.data.interactionId || null,
    ani: customerNumber || null,
    direction,
    queueName: task.data.queueName || cpd.virtualTeamName || null,
    // TaskManager sets this on every task:end-producing event; it is the only
    // trustworthy answer to "does this call still need a wrap-up code?".
    wrapUpRequired: !!task.data.wrapUpRequired,
    interactionState: interaction.state || null,
    cad, // flat name->value map, used by the {cad.<name>} screen-pop placeholder
    cadEntries, // [{name, displayName, value}], used by the widget's CAD panel
  };
}

function safeStringify(value) {
  try {
    const s = JSON.stringify(value);
    return s && s !== '{}' ? s : null;
  } catch (err) {
    return null;
  }
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// webex.ready flips true (and fires 'ready' once) only after every plugin —
// including the cc plugin's own internal setup — has finished initializing.
function waitForReady(webexInstance) {
  if (webexInstance.ready) return Promise.resolve();
  return new Promise((resolve) => webexInstance.once('ready', resolve));
}

const MULTI_LOGIN_MESSAGE =
  'Another active Webex Contact Center session was detected for this agent (multiLogin). ' +
  'Sign out of Webex CC Desktop / any other browser tab or device using this agent, then try again.';

// VERIFIED (services/core/websocket/WebSocketManager.js): on receiving a
// server "AGENT_MULTI_LOGIN" message the SDK itself closes the websocket
// (this.close(false, 'multiLogin')) WITHOUT rejecting register()'s promise —
// left alone this just hangs until our own timeout fires with a generic,
// unhelpful message. cc.js re-emits this publicly as 'agent:multiLogin', so
// we race register() against it to fail fast with an actionable message.
function waitForMultiLoginRejection(ccInstance) {
  return new Promise((_, reject) => {
    ccInstance.once('agent:multiLogin', () => reject(new Error(MULTI_LOGIN_MESSAGE)));
  });
}

// NOTE: deliberately a SINGLE attempt, not an automatic retry. Calling
// register() a second time on the SAME cc instance while its first,
// already-failed call may still be settling internally is unverified/risky
// SDK territory, and a failed attempt is now always properly deregistered
// (see init()'s catch block) — so a plain user retry (click "Sign in" again)
// is both simpler and safer than us guessing at re-entrant SDK behaviour.
function registerOnce(ccInstance) {
  return Promise.race([ccInstance.register(), waitForMultiLoginRejection(ccInstance)]);
}

// The server's way of saying "this agent has no station session" — VERIFIED
// live as `AGENT_NOT_FOUND` coming back from setAgentState() while the widget
// happily displayed "Available" (see the agent:reloginSuccess note in init()).
// Any of these means our cached agentStatus is a lie and must fall back to
// REGISTERED so the team/voice-option picker is offered again.
const STATION_SESSION_MISSING_RE = /AGENT_NOT_FOUND|AGENT_NOT_LOGGED_IN|AGENT_SESSION_NOT_FOUND/i;
function isStationSessionMissing(err) {
  const message = (err && (err.message || err.reason || err.error)) || (typeof err === 'string' ? err : '');
  return STATION_SESSION_MISSING_RE.test(String(message));
}

export function createWebexSdkClient({ onStateChange, onIncomingTask }) {
  let webex = null;
  let currentTask = null;
  let outdialAniId = null; // profile.outdialANIId, captured in init() — see outdial()
  let agentProfileId = null; // profile.agentProfileId, captured in init() — see getTransferAgents()
  let orgId = null; // profile.orgId — needed by the callback-schedule REST API

  // Every snapshot is stamped with an ever-increasing counter so the widget
  // can detect (and drop) one that arrives out of order — see `_seq` below.
  let seq = 0;

  let state = {
    agentStatus: AGENT_STATUS.LOGGED_OUT,
    agent: null,
    teams: [],
    loginVoiceOptions: [],
    idleCodes: [],
    wrapupCodes: [],
    subStatus: null, // 'Available' | 'Idle' | null (not station-logged-in)
    auxCodeId: null,
    dn: null, // dial number/device registered for the chosen login option
    teamId: null, // team the agent is currently signed in to
    loginOption: null, // 'BROWSER' | 'EXTENSION' | 'AGENT_DN'
    dialNumber: null, // required again whenever loginOption is EXTENSION/AGENT_DN
    activeTask: null,
    held: false,
    recordingPaused: false,
    consultState: null, // null | 'requested' | 'offered' | 'consulting'
    conferenceActive: false,
    error: null,
    _seq: 0,
  };

  function setState(patch) {
    seq += 1;
    state = { ...state, ...patch, _seq: seq };
    onStateChange(state);
  }

  function getState() {
    return state;
  }

  // Drops back to "registered but not station-logged-in" after the server has
  // told us the station session doesn't exist, so the widget immediately shows
  // the team/voice-option picker instead of staying stuck on a phantom
  // "Available" until the agent thinks to reload the page.
  function fallBackToRegistered(message) {
    if (state.agentStatus === AGENT_STATUS.LOGGED_OUT || state.agentStatus === AGENT_STATUS.CONNECTING) return;
    setState({
      agentStatus: AGENT_STATUS.REGISTERED,
      subStatus: null,
      auxCodeId: null,
      activeTask: null,
      held: false,
      recordingPaused: false,
      consultState: null,
      conferenceActive: false,
      error: message,
    });
  }

  // Releases the CURRENT webex instance's server-side registration/listeners
  // (if any) before it is discarded. Used both by the public teardown()
  // (explicit logout) and internally at the top of init() (a fresh sign-in
  // must not leave the previous instance dangling — see init()'s comment).
  async function disposeSession() {
    if (!webex) return;
    const old = webex;
    webex = null;
    outdialAniId = null;
    agentProfileId = null;
    currentTask = null;
    stopRingtone();
    try {
      // stationLogout() requires a payload object (logoutReason is optional
      // but `data` itself must exist, else the SDK crashes reading
      // `data.logoutReason` off undefined) — verified live.
      await old.cc?.stationLogout?.({ logoutReason: 'User requested logout' });
    } catch (err) {
      /* best-effort */
    }
    try {
      await old.cc?.deregister?.();
    } catch (err) {
      /* best-effort */
    }
  }

  // The SDK hands us the raw remote audio MediaStreamTrack via 'task:media'
  // (verified live: the call fully connects over WebRTC — ICE, ROAP OK,
  // peerConnectionState=connected — but nothing plays it) instead of playing
  // it itself; the consuming app owns routing it to an <audio> element. This
  // element lives in the offscreen document (the only place this WebRTC
  // session runs) and is reused across calls.
  let remoteAudioEl = null;
  let speakerDeviceId = '';
  function applySpeaker(target) {
    // setSinkId is the only way to steer playback at a non-default output;
    // it needs microphone permission to have been granted for the origin.
    if (!target?.setSinkId) return Promise.resolve();
    return target.setSinkId(speakerDeviceId || 'default').catch((err) => {
      console.error('[crm-call-companion] could not route audio to the selected speaker:', err);
    });
  }
  function getRemoteAudioElement() {
    if (!remoteAudioEl) {
      remoteAudioEl = document.createElement('audio');
      remoteAudioEl.autoplay = true;
      document.body.appendChild(remoteAudioEl);
      applySpeaker(remoteAudioEl);
    }
    return remoteAudioEl;
  }

  // Applies to the ringtone's AudioContext too where supported (Chrome 110+),
  // so an incoming call rings on the same device the call will be heard on.
  function setAudioOutput(deviceId) {
    speakerDeviceId = deviceId || '';
    return Promise.all([applySpeaker(remoteAudioEl), applySpeaker(ringCtx)]);
  }

  // Registered as soon as we have a task reference (not just after
  // task:assigned) since with auto-answer enabled the whole accept+media
  // sequence can complete before a later listener would ever attach.
  //
  // This is the ONE place task-level events are subscribed, and it subscribes
  // to ALL of them (see TASK_EVENT above). Previously they were split across
  // three functions chained off task:assigned, so anything that happened to a
  // task that was never assigned — or any state the SDK reports out-of-band
  // (supervisor hold, recording pause, consult/conference, RONA) — silently
  // never reached the UI.
  const handledTasks = new WeakSet();
  function attachTaskHandlers(task) {
    if (!task?.on || handledTasks.has(task)) return;
    handledTasks.add(task);

    // task:incoming and task:hydrate can both deliver the same interaction,
    // and a NEW call replaces currentTask — every handler below must therefore
    // ignore events from a task that is no longer the one on screen.
    const isCurrent = () => currentTask === task;
    const sync = (patch) => {
      if (!isCurrent()) return;
      setState({ activeTask: serializeTask(task), ...patch });
    };
    const detachAudio = () => {
      stopRingtone();
      if (remoteAudioEl) remoteAudioEl.srcObject = null;
    };
    const CALL_FLAGS_RESET = { held: false, recordingPaused: false, consultState: null, conferenceActive: false };
    // A call ending must not drag the agent back to "Available" if they have
    // meanwhile been signed out of their station or the SDK entirely.
    const idleStatus = () =>
      state.agentStatus === AGENT_STATUS.ON_CALL || state.agentStatus === AGENT_STATUS.WRAP_UP
        ? AGENT_STATUS.AVAILABLE
        : state.agentStatus;

    task.on(TASK_EVENT.MEDIA, (track) => {
      const audioEl = getRemoteAudioElement();
      audioEl.srcObject = new MediaStream([track]);
      audioEl.play().catch((err) => console.error('[crm-call-companion] remote audio play() failed:', err));
    });

    const onAnswered = () => {
      stopRingtone();
      sync({ agentStatus: AGENT_STATUS.ON_CALL });
    };
    task.on(TASK_EVENT.ASSIGNED, onAnswered);
    task.on(TASK_EVENT.AUTO_ANSWERED, onAnswered);

    // Hold/resume are reported by the server for ANY cause (our own click, a
    // supervisor, a consult starting) — the widget's Hold/Resume button now
    // reflects this instead of a local guess that desynced on every failure.
    task.on(TASK_EVENT.HOLD, () => sync({ held: true }));
    task.on(TASK_EVENT.RESUME, () => sync({ held: false }));

    task.on(TASK_EVENT.RECORDING_PAUSED, () => sync({ recordingPaused: true }));
    task.on(TASK_EVENT.RECORDING_RESUMED, () => sync({ recordingPaused: false }));
    task.on(TASK_EVENT.RECORDING_PAUSE_FAILED, () => sync({ recordingPaused: false, error: 'Pausing the call recording failed.' }));
    task.on(TASK_EVENT.RECORDING_RESUME_FAILED, () => sync({ recordingPaused: true, error: 'Resuming the call recording failed.' }));

    task.on(TASK_EVENT.CONSULT_CREATED, () => sync({ consultState: 'requested' }));
    task.on(TASK_EVENT.OFFER_CONSULT, () => sync({ consultState: 'offered' }));
    task.on(TASK_EVENT.CONSULTING, () => sync({ consultState: 'consulting' }));
    task.on(TASK_EVENT.CONSULT_ACCEPTED, () => sync({ consultState: 'consulting' }));
    task.on(TASK_EVENT.CONSULT_END, () => sync({ consultState: null }));
    task.on(TASK_EVENT.CONSULT_QUEUE_CANCELLED, () => sync({ consultState: null }));
    task.on(TASK_EVENT.CONSULT_QUEUE_FAILED, () => sync({ consultState: null, error: 'Consult to queue failed.' }));

    task.on(TASK_EVENT.CONFERENCE_ESTABLISHING, () => sync({ conferenceActive: true }));
    task.on(TASK_EVENT.CONFERENCE_STARTED, () => sync({ conferenceActive: true }));
    task.on(TASK_EVENT.CONFERENCE_ENDED, () => sync({ conferenceActive: false }));
    task.on(TASK_EVENT.CONFERENCE_TRANSFERRED, () => sync({ conferenceActive: false }));
    task.on(TASK_EVENT.CONFERENCE_FAILED, () => sync({ conferenceActive: false, error: 'Starting the conference failed.' }));
    task.on(TASK_EVENT.CONFERENCE_END_FAILED, () => sync({ error: 'Ending the conference failed.' }));
    task.on(TASK_EVENT.CONFERENCE_TRANSFER_FAILED, () => sync({ error: 'Conference transfer failed.' }));
    task.on(TASK_EVENT.PARTICIPANT_JOINED, () => sync());
    task.on(TASK_EVENT.PARTICIPANT_LEFT, () => sync());
    task.on(TASK_EVENT.PARTICIPANT_LEFT_FAILED, () => sync({ error: 'Removing the participant from the conference failed.' }));
    task.on(TASK_EVENT.POST_CALL_ACTIVITY, () => sync());

    // Any of these means the call is over for this agent. It ALWAYS goes to
    // wrap-up: `task.data.wrapUpRequired` looks like a better signal but is not
    // safe to gate on — TaskManager.handleTaskCleanup() deletes the task from
    // its collection when ContactEnded arrives without this agent in
    // `agentsPendingWrapUp`, and once it is gone the later AgentWrapup event
    // can no longer resolve a task to emit on, so a "wrapUpRequired: true"
    // correction never arrives and the agent is left with no wrap-up form.
    // task:wrappedup is what returns us to Available.
    const onEnded = () => {
      if (!isCurrent()) return;
      detachAudio();
      sync({ agentStatus: AGENT_STATUS.WRAP_UP, ...CALL_FLAGS_RESET });
    };
    task.on(TASK_EVENT.END, onEnded);
    task.on(TASK_EVENT.UNASSIGNED, onEnded);
    task.on(TASK_EVENT.WRAPUP, () => sync({ agentStatus: AGENT_STATUS.WRAP_UP, ...CALL_FLAGS_RESET }));

    const release = (patch) => {
      if (!isCurrent()) return;
      detachAudio();
      currentTask = null;
      setState({ agentStatus: idleStatus(), activeTask: null, ...CALL_FLAGS_RESET, ...patch });
    };
    task.on(TASK_EVENT.WRAPPEDUP, () => release());
    // Fires for RONA (offer timed out), assign-failed and invite-failed; the
    // payload is the server's reason string. This also covers a caller who
    // hangs up while the call is still just being presented.
    task.on(TASK_EVENT.REJECT, (reason) => {
      const text = reasonText(reason, null);
      release({ error: text ? `Call not connected: ${text}` : null });
    });
    task.on(TASK_EVENT.OUTDIAL_FAILED, (reason) =>
      release({ error: `Outbound call failed: ${reasonText(reason, 'unknown reason')}` })
    );
  }

  // Shared entry point for every way a task can reach us (task:incoming,
  // task:hydrate, task:offerContact, task:merged, campaign preview).
  function adoptTask(task, { ring } = {}) {
    if (!task) return null;
    if (!isTelephonyTask(task)) {
      console.log(
        '[crm-call-companion] ignoring non-telephony task:',
        task.data?.interaction?.mediaType,
        task.data?.interactionId
      );
      return null;
    }
    currentTask = task;
    const serialized = serializeTask(task);
    const interactionState = task.data?.interaction?.state;
    const inWrapUp = interactionState === 'wrapUp' || !!task.data?.wrapUpRequired;
    const connected = interactionState === 'connected' || interactionState === 'consult';
    attachTaskHandlers(task);
    setState({
      activeTask: serialized,
      held: false,
      recordingPaused: false,
      consultState: null,
      conferenceActive: false,
      ...(inWrapUp
        ? { agentStatus: AGENT_STATUS.WRAP_UP }
        : connected
          ? { agentStatus: AGENT_STATUS.ON_CALL }
          : {}),
    });
    if (ring && !inWrapUp && !connected) startRingtone();
    return serialized;
  }

  // Synthesized ring cue (no audio asset needed) so the agent notices an
  // incoming call even if the widget panel isn't in view — the SDK itself
  // never plays any sound for an offered task, that's entirely on the app.
  // Lives in this offscreen document since it's the one page already proven
  // (via the real call's remote <audio>) to be allowed to play audio here.
  let ringCtx = null;
  let ringNodes = null;
  function startRingtone() {
    if (ringNodes) return;
    try {
      ringCtx = ringCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ringCtx;
      applySpeaker(ctx);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = 440;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 480;
      osc1.connect(gain);
      osc2.connect(gain);
      osc1.start();
      osc2.start();
      let on = false;
      const tick = () => {
        on = !on;
        gain.gain.setValueAtTime(on ? 0.18 : 0, ctx.currentTime);
      };
      tick();
      const intervalId = setInterval(tick, 1000);
      ringNodes = { osc1, osc2, gain, intervalId };
    } catch (err) {
      console.error('[crm-call-companion] ringtone start failed:', err);
    }
  }
  function stopRingtone() {
    if (!ringNodes) return;
    clearInterval(ringNodes.intervalId);
    try {
      ringNodes.osc1.stop();
      ringNodes.osc2.stop();
      ringNodes.gain.disconnect();
    } catch (err) {
      /* already stopped */
    }
    ringNodes = null;
  }

  async function runInit(accessToken) {
    // Release any previous session FIRST. Without this, clicking sign-in
    // again (or re-running CMD_INIT_SDK after a failed attempt) left the
    // prior Webex instance's websocket/listeners alive (visible as
    // "Possible EventEmitter memory leak... N task:incoming listeners" in
    // the console) and — more importantly — its server-side registration
    // never released, so a fresh cc.register() call could conflict with the
    // still-registered stale session and fail every time after the first.
    await disposeSession();
    setState({ agentStatus: AGENT_STATUS.CONNECTING, error: null });
    try {
      webex = new Webex({ credentials: accessToken });

      // VERIFIED root cause of the "Cannot read properties of undefined
      // (reading 'trackEvent')" crash: webex-core.js only sets `webex.ready`
      // / fires 'ready' once ALL plugins finish initializing, and cc.js's own
      // constructor defers ALL of its setup (metricsManager, services,
      // taskManager, ...) to a `this.$webex.once('ready', ...)` callback. We
      // were calling webex.cc.register() immediately after `new Webex()`,
      // before that callback had run, so cc's internals were still
      // undefined — register() failed, then its own catch-block error
      // handler crashed trying to report the failure via the not-yet-created
      // metricsManager, masking the real error underneath.
      await withTimeout(waitForReady(webex), 15000, 'Timed out waiting for the Webex SDK to become ready (15s).');

      webex.cc.on(TASK_EVENT.INCOMING, (task) => {
        const serialized = adoptTask(task, { ring: true });
        // Screen-pop is for calls the AGENT didn't already know were coming —
        // for an outbound call the agent just placed it themselves (typically
        // from the very CRM record they want to stay on), so never navigate.
        if (serialized?.direction !== 'OUTBOUND') onIncomingTask(serialized);
      });

      // VERIFIED live: a task left in wrap-up from a PRIOR session (agent
      // never submitted a wrap-up reason before the offscreen doc/tab was
      // torn down) comes back on the NEXT register() as a 'task:hydrate'
      // event (cc.d.ts: "Task data has been updated"), NOT 'task:incoming' —
      // we previously only listened for the latter, so this stuck task was
      // invisible to the widget, silently occupying the agent's channel and
      // causing every subsequent outdial to fail with
      // NO_MATCHING_AGENT_CHANNEL_FOUND until the agent completed its
      // wrap-up from Desktop instead.
      webex.cc.on(TASK_EVENT.HYDRATE, (task) => {
        // A hydrated task is one already in flight (connected, on hold, in
        // wrap-up); adoptTask() derives the right status from its interaction
        // state, so no ring and no screen-pop — the agent is already on it.
        adoptTask(task);
      });

      // Emitted when the offered contact is formally presented to us (the
      // point auto-answer kicks in). Same task object as task:incoming, so
      // adoptTask() is idempotent — it just refreshes the payload/handlers.
      webex.cc.on(TASK_EVENT.OFFER_CONTACT, (task) => adoptTask(task, { ring: true }));

      // Two interactions merged into one (e.g. after a conference): the task
      // we hold is replaced by a new object carrying the merged interaction.
      webex.cc.on(TASK_EVENT.MERGED, (task) => adoptTask(task));

      // Outbound campaign preview reservation offered to this agent.
      webex.cc.on(TASK_EVENT.CAMPAIGN_PREVIEW_RESERVATION, (task) => {
        const serialized = adoptTask(task, { ring: true });
        if (serialized) onIncomingTask(serialized);
      });

      // register() can itself silently restore a PRE-EXISTING active station
      // session (Cisco's own logs call this "silentRelogin", confirmed live:
      // "Silent relogin process completed successfully with login Option:
      // BROWSER teamId: ...").
      //
      // CORRECTION (verified live): 'agent:reloginSuccess' is NOT trustworthy
      // as the sole "we are logged in" signal. After a stationLogout that
      // failed with AGENT_HAS_ASSIGNED_CONTACTS, the very next register()
      // still fired reloginSuccess — so the widget jumped straight to
      // "Available" while every setAgentState() came back AGENT_NOT_FOUND,
      // and only a page reload (which re-registered and showed the team +
      // voice-option picker) recovered. The authoritative answer is
      // `profile.isAgentLoggedIn`, applied after register() resolves below;
      // this event now only contributes subStatus/auxCodeId detail, plus
      // handles a genuine relogin that happens LATER (connection recovery),
      // which is why it still sets state when we're merely REGISTERED.
      let reloginData = null;
      webex.cc.on(AGENT_EVENT.RELOGIN_SUCCESS, (data) => {
        reloginData = data || {};
        if (state.agentStatus === AGENT_STATUS.REGISTERED) {
          setState({
            agentStatus: AGENT_STATUS.AVAILABLE,
            subStatus: reloginData.subStatus || 'Available',
            auxCodeId: reloginData.auxCodeId ?? null,
            teamId: reloginData.teamId ?? state.teamId,
            loginOption: reloginData.deviceType ?? state.loginOption,
            dialNumber: reloginData.dialNumber ?? state.dialNumber,
          });
        }
      });

      // Station login/logout can be driven from OUTSIDE this widget too (a
      // supervisor signing the agent out, Webex Desktop in another tab, the
      // SDK's own silent relogin) — mirroring these events is what keeps the
      // header badge and the team picker in sync with reality.
      webex.cc.on(AGENT_EVENT.STATION_LOGIN_SUCCESS, (data) => {
        setState({
          agentStatus: AGENT_STATUS.AVAILABLE,
          subStatus: data?.subStatus || 'Available',
          auxCodeId: data?.auxCodeId ?? null,
          teamId: data?.teamId ?? state.teamId,
          loginOption: data?.deviceType ?? state.loginOption,
          dialNumber: data?.dialNumber ?? state.dialNumber,
          error: null,
        });
      });
      webex.cc.on(AGENT_EVENT.STATION_LOGIN_FAILED, (data) => {
        fallBackToRegistered(`Station login failed: ${reasonText(data, 'unknown reason')}`);
      });
      webex.cc.on(AGENT_EVENT.LOGOUT_SUCCESS, (data) => {
        const by = data?.loggedOutBy;
        fallBackToRegistered(by ? `You were signed out of your station by ${by}.` : null);
      });
      webex.cc.on(AGENT_EVENT.LOGOUT_FAILED, (data) => {
        setState({ error: `Station logout failed: ${reasonText(data, 'unknown reason')}` });
      });
      // Fires once the agent's dial number/device is registered for the chosen
      // login option — the point BROWSER/EXTENSION calling is actually usable.
      webex.cc.on(AGENT_EVENT.DN_REGISTERED, (data) => {
        setState({ dn: data?.dn || data?.dialNumber || null });
      });

      // Both state-change events: 'agent:stateChange' is emitted for remote
      // changes too (supervisor, RONA auto-idle), 'agent:stateChangeSuccess'
      // for confirmed ones. Keeping subStatus/auxCodeId truthful after ANY of
      // them is what stops the badge from claiming Available while the server
      // has moved the agent to an idle/RONA code.
      const applyAgentState = (data) => {
        if (!data) return;
        setState({ subStatus: data.subStatus || data.status, auxCodeId: data.auxCodeId ?? null });
      };
      webex.cc.on(AGENT_EVENT.STATE_CHANGE, applyAgentState);
      webex.cc.on(AGENT_EVENT.STATE_CHANGE_SUCCESS, applyAgentState);
      webex.cc.on(AGENT_EVENT.STATE_CHANGE_FAILED, (data) => {
        const message = `Agent state change failed: ${reasonText(data, 'unknown reason')}`;
        if (isStationSessionMissing(data?.reason)) fallBackToRegistered(message);
        else setState({ error: message });
      });

      // The SDK closes the websocket by itself on multiLogin without ever
      // rejecting anything post-register — left unobserved the widget keeps
      // showing a live session that receives no further events at all.
      webex.cc.on(AGENT_EVENT.MULTI_LOGIN, () => {
        if (state.agentStatus === AGENT_STATUS.CONNECTING) return; // registerOnce() owns this case
        disposeSession().finally(() =>
          setState({
            agentStatus: AGENT_STATUS.LOGGED_OUT,
            agent: null,
            activeTask: null,
            subStatus: null,
            auxCodeId: null,
            error: MULTI_LOGIN_MESSAGE,
          })
        );
      });

      // register() talks to Webex over a WebSocket and has no built-in
      // timeout on our side — a bad token/network/tenant config can leave it
      // pending forever, which previously showed as a permanent "Connecting…"
      // spinner with no explanation. Race it against a hard timeout instead.
      const profile = await withTimeout(registerOnce(webex.cc), 25000, 'Timed out registering with Webex Contact Center (25s).');
      // @webex/contact-center's shipped .d.ts disagree with each other on
      // field names in places (Team is {teamId,teamName} in one file, {id,name}
      // in another) — log the raw shape once so a future mismatch is a lookup,
      // not another guessing round. Visible in the offscreen document console.
      console.log('[crm-call-companion] register() profile:', profile);
      // The agent's configured outbound ANI reference — same field WxCC Desktop
      // itself uses (verified: outdial worked from Desktop for this same agent).
      // Required as the (confusingly-named) `outdialANI` param to
      // getOutdialAniEntries() — see outdial() below.
      outdialAniId = profile.outdialANIId || null;
      // Required by getBuddyAgents() for the transfer-to-agent picker.
      agentProfileId = profile.agentProfileId || null;
      orgId = profile.orgId || null;
      // Authoritative station-login state (see the agent:reloginSuccess note
      // above). `isAgentLoggedIn` is optional in the shipped types, so fall
      // back to the relogin event only when the profile omits it entirely.
      const stationLoggedIn =
        profile.isAgentLoggedIn === undefined ? !!reloginData : profile.isAgentLoggedIn === true;
      // auxCodeId '0' is WxCC's reserved "Available" code; anything else is an
      // idle reason, which is what the badge/idle-code picker keys off.
      const restoredAuxCodeId = reloginData?.auxCodeId ?? profile.lastStateAuxCodeId ?? null;
      // A task can arrive DURING register() — verified live: a task left in
      // wrap-up fires task:hydrate ~700ms before register() resolves. Its
      // handler has already put the widget in WRAP_UP/ON_CALL, so this write
      // must not stamp AVAILABLE over it or the agent loses the wrap-up form.
      const taskOwnsStatus = !!currentTask;
      // Some tenants mark every wrap-up code isSystem; filtering them all out
      // leaves the agent in wrap-up with an empty picker and no way to finish.
      const wrapupCodes = profile.wrapupCodes || [];
      const selectableWrapupCodes = wrapupCodes.filter((c) => !c.isSystem);
      setState({
        ...(taskOwnsStatus
          ? {}
          : {
              agentStatus: stationLoggedIn ? AGENT_STATUS.AVAILABLE : AGENT_STATUS.REGISTERED,
            }),
        subStatus: stationLoggedIn
          ? reloginData?.subStatus || (restoredAuxCodeId && restoredAuxCodeId !== '0' ? 'Idle' : 'Available')
          : null,
        auxCodeId: stationLoggedIn ? restoredAuxCodeId : null,
        teamId: reloginData?.teamId || profile.currentTeamId || null,
        loginOption: reloginData?.deviceType || profile.deviceType || null,
        dialNumber: reloginData?.dialNumber || null,
        agent: { agentId: profile.agentId, name: profile.agentName },
        teams: profile.teams || [],
        loginVoiceOptions: profile.loginVoiceOptions || [],
        idleCodes: (profile.idleCodes || []).filter((c) => !c.isSystem),
        wrapupCodes: selectableWrapupCodes.length ? selectableWrapupCodes : wrapupCodes,
      });
      return getState();
    } catch (err) {
      // Reset all the way back to logged-out (rather than leaving
      // agentStatus stuck on CONNECTING) so the widget shows the sign-in
      // screen again with the error visible, instead of an inexplicable
      // permanent spinner.
      //
      // CRITICAL: must properly deregister the failed instance (disposeSession,
      // not a bare `webex = null`) — otherwise a failed attempt (e.g. a
      // multiLogin conflict) leaves ITS OWN half-registered session dangling
      // server-side, which then becomes the reason the NEXT attempt ALSO gets
      // a multiLogin conflict — a self-inflicted, ever-repeating loop.
      await disposeSession();
      console.error('[crm-call-companion] webexSdkClient.init failed:', err);
      const message =
        (err && (err.message || err.reason || err.error)) ||
        (typeof err === 'string' ? err : null) ||
        safeStringify(err) ||
        'Unknown error while registering with Webex Contact Center — see the offscreen document console.';
      setState({ agentStatus: AGENT_STATUS.LOGGED_OUT, error: message });
      throw err;
    }
  }

  async function stationLogin({ teamId, loginOption, dialNumber }) {
    if (!webex) throw new Error('SDK not initialized — login first.');
    let assumedExistingSession = false;
    try {
      await webex.cc.stationLogin({ teamId, loginOption, dialNumber });
    } catch (err) {
      // register()'s own silentRelogin can win a race against this call (the
      // widget's team/option picker rendered before the relogin event
      // arrived) — the agent ends up already logged in, so this specific
      // failure isn't a real error, just a redundant request.
      if (!/AGENT_SESSION_ALREADY_EXISTS/.test(err.message || '')) throw err;
      assumedExistingSession = true;
    }
    // stationLogin alone does not make the agent Available (verified against
    // the SDK's own startOutdial() example, which calls setAgentState next).
    try {
      await webex.cc.setAgentState({ state: 'Available', auxCodeId: '0' });
    } catch (err) {
      // The "already exists" session we just trusted turned out to be stale
      // (same lie as agent:reloginSuccess — see init()). Do the real station
      // login once rather than leaving the agent half-logged-in.
      if (!assumedExistingSession || !isStationSessionMissing(err)) throw err;
      await webex.cc.stationLogin({ teamId, loginOption, dialNumber });
      await webex.cc.setAgentState({ state: 'Available', auxCodeId: '0' });
    }
    setState({
      agentStatus: AGENT_STATUS.AVAILABLE,
      subStatus: 'Available',
      auxCodeId: '0',
      teamId,
      loginOption,
      dialNumber: dialNumber || null,
      error: null,
    });
    return getState();
  }

  // Switches team (and/or device type) WITHOUT a station logout — the SDK
  // requires the full triple even when only one field changes, so anything the
  // caller omits is filled in from the session we are already in.
  async function updateAgentProfile(patch) {
    if (!webex) throw new Error('SDK not initialized — login first.');
    const loginOption = patch.loginOption || state.loginOption;
    if (!loginOption) throw new Error('Cannot change team: this agent is not signed in to a station yet.');
    const dialNumber = patch.dialNumber ?? state.dialNumber;
    if ((loginOption === 'EXTENSION' || loginOption === 'AGENT_DN') && !dialNumber) {
      throw new Error(`A dial number is required for the ${loginOption} login option.`);
    }
    const teamId = patch.teamId || state.teamId;
    await webex.cc.updateAgentProfile({ teamId, loginOption, ...(dialNumber ? { dialNumber } : {}) });
    setState({ teamId, loginOption, dialNumber: dialNumber || null, error: null });
    return getState();
  }

  async function setAgentState({ state: desiredState, auxCodeId }) {
    if (!webex) throw new Error('SDK not initialized — login first.');
    const resolvedAuxCodeId = desiredState === 'Available' ? '0' : auxCodeId;
    try {
      await webex.cc.setAgentState({ state: desiredState, auxCodeId: resolvedAuxCodeId });
    } catch (err) {
      if (isStationSessionMissing(err)) {
        fallBackToRegistered('Your station session is no longer active on the server — select a team and sign in to your station again.');
      }
      throw err;
    }
    setState({ subStatus: desiredState, auxCodeId: resolvedAuxCodeId, error: null });
    return getState();
  }

  async function stationLogout() {
    if (!webex) return getState();
    // logoutReason is optional, but `data` itself must be passed — the SDK
    // crashes reading `.logoutReason` off undefined otherwise (verified live).
    try {
      await webex.cc.stationLogout({ logoutReason: 'User requested logout' });
    } catch (err) {
      // Already gone server-side is exactly the state we were asking for.
      if (!isStationSessionMissing(err)) throw err;
    }
    setState({ agentStatus: AGENT_STATUS.REGISTERED, subStatus: null, auxCodeId: null, activeTask: null });
    return getState();
  }

  async function taskAction(taskId, action, extra) {
    if (!currentTask) throw new Error(`No active task to ${action}.`);
    if (action === TASK_ACTION.WRAPUP) {
      return currentTask.wrapup({ auxCodeId: extra?.auxCodeId, wrapUpReason: extra?.wrapUpReason || extra });
    }
    if (action === TASK_ACTION.TRANSFER) {
      // Blind transfer (task.transfer, NOT the consult+consultTransfer flow —
      // matches "transfer to an available agent or a queue" as asked, no
      // talk-first step). Hands the task off immediately, same as End, so it
      // needs the same deterministic state transition (see END below) rather
      // than waiting on an SDK event echo back to the transferring agent.
      const result = await currentTask.transfer({ to: extra?.to, destinationType: extra?.destinationType });
      setState({ agentStatus: AGENT_STATUS.WRAP_UP });
      return result;
    }
    const method = TASK_METHOD_MAP[action];
    if (!method || typeof currentTask[method] !== 'function') {
      throw new Error(`Unsupported task action "${action}" (method "${method}" not found on task).`);
    }
    const result = await currentTask[method]();
    if (action === TASK_ACTION.END) {
      // VERIFIED live: waiting for the SDK to echo 'task:end' back to us
      // after OUR OWN end() call succeeds is unreliable — the widget stayed
      // on the Hold/Mute/End controls after a successful hangup (SDK log
      // confirmed "Task ended successfully"), so the agent kept clicking End
      // and every further click legitimately failed ("task already ended").
      // Transition state deterministically on our own success instead of
      // depending on that echo (attachTaskLifecycleHandlers' own 'task:end'
      // listener still covers the OTHER party hanging up first).
      setState({ agentStatus: AGENT_STATUS.WRAP_UP });
    }
    return result;
  }

  async function getTransferAgents() {
    if (!webex) throw new Error('SDK not initialized — login first.');
    if (!agentProfileId) return [];
    const response = await webex.cc.getBuddyAgents({ agentProfileId, mediaType: 'telephony', state: 'Available' });
    const list = response?.data?.agentList || [];
    // Per the shipped types, BuddyDetails is {agentId,state,teamId,dn,
    // agentName,siteId} — but getBuddyAgents()'s OWN doc example instead
    // shows firstName/lastName/teamName (another docs-vs-types mismatch like
    // the earlier outdial ANI/Team ones) — NOT YET LIVE-VERIFIED which shape
    // actually comes back; read both so neither renders as a blank option.
    return list.map((a) => ({
      id: a.agentId,
      name: a.agentName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.agentId,
    }));
  }

  async function getTransferQueues() {
    if (!webex) throw new Error('SDK not initialized — login first.');
    const response = await webex.cc.getQueues({ pageSize: 200 });
    const list = response?.data || [];
    return list
      .filter((q) => q.active && q.channelType === 'TELEPHONY')
      .map((q) => ({ id: q.id, name: q.name }));
  }

  // Ships the SDK's own rolling log buffer to Webex; the returned feedbackId
  // is what Cisco support needs to find this agent's session.
  async function uploadLogs() {
    if (!webex) throw new Error('SDK not initialized — login first.');
    const response = await webex.cc.uploadLogs();
    return { feedbackId: response?.feedbackId || response?.trackingid || null };
  }

  // ---- Callback scheduling -------------------------------------------
  // NOT part of @webex/contact-center (its task service exposes only accept/
  // hold/consult/conference/transfer/end/wrapup). These call the Contact
  // Center REST API directly, through webex.request so the SDK still resolves
  // the tenant's regional wcc-api-gateway host and attaches the bearer token —
  // the same 'cjp:user' scope this extension already requests.
  // Docs: developer.webex.com → Contact Center → Callback Schedule.
  async function callbackResource(query) {
    const org = orgId || (await webex.credentials?.getOrgId?.());
    if (!org) throw new Error('Could not determine the Webex organisation ID for this agent.');
    return `/v1/callbacks/organization/${org}/scheduled-callback${query ? `?${query}` : ''}`;
  }

  async function scheduleCallback(request) {
    if (!webex) throw new Error('SDK not initialized — login first.');
    const response = await webex.request({
      service: 'wcc-api-gateway',
      resource: await callbackResource(),
      method: 'POST',
      body: request,
    });
    return response?.body || null;
  }

  // A number can hold only one scheduled callback, so an existing one is
  // re-scheduled rather than duplicated. The body is the schedule payload plus
  // the id, which the API requires in BOTH the path and the body.
  async function updateScheduledCallback(id, request) {
    if (!webex) throw new Error('SDK not initialized — login first.');
    const base = await callbackResource();
    const response = await webex.request({
      service: 'wcc-api-gateway',
      resource: `${base}/${id}`,
      method: 'PUT',
      body: { ...request, id },
    });
    return response?.body || null;
  }

  // 204 No Content on success, so there is nothing to return.
  async function deleteScheduledCallback(id) {
    if (!webex) throw new Error('SDK not initialized — login first.');
    const base = await callbackResource();
    await webex.request({
      service: 'wcc-api-gateway',
      resource: `${base}/${id}`,
      method: 'DELETE',
    });
    return { deleted: true };
  }

  async function getScheduledCallbacks({ callbackNumber, pageSize = 50 } = {}) {
    if (!webex) throw new Error('SDK not initialized — login first.');
    // The API requires assigneeAgent or callbackNumber; without a number we
    // list what is assigned to this agent.
    const query = new URLSearchParams({ pageSize: String(pageSize), sortBy: 'scheduledTime', sortOrder: 'asc' });
    if (callbackNumber) query.set('callbackNumber', callbackNumber);
    else if (state.agent?.agentId) query.set('assigneeAgent', state.agent.agentId);
    else throw new Error('No agent id available to list callbacks for.');
    const response = await webex.request({
      service: 'wcc-api-gateway',
      resource: await callbackResource(query.toString()),
      method: 'GET',
    });
    return response?.body?.data || [];
  }

  async function outdial(phoneNumber, originAni) {
    if (!webex) throw new Error('SDK not initialized — login first.');
    const cleaned = String(phoneNumber).replace(/[^\d+]/g, '');
    let origin = originAni;
    if (!origin) {
      // VERIFIED live: OutdialAniParams.outdialANI is a REQUIRED id ("Outdial
      // ANI ID from agent profile") — calling with {} omits it and the API
      // logs "ANI ID undefined", and OutdialAniEntry's phone number field is
      // `.number`, NOT `.outdialANI`/`.value` (both wrong guesses previously
      // made this always throw even though the API call succeeded). Use the
      // agent's own configured outdialANIId (captured from the profile in
      // init(), the same one WxCC Desktop uses) to look up the actual number.
      if (!outdialAniId) throw new Error('No outdial ANI configured for this agent/tenant.');
      const anis = await webex.cc.getOutdialAniEntries({ outdialANI: outdialAniId });
      origin = anis?.find((a) => a.id === outdialAniId)?.number || anis?.[0]?.number;
      if (!origin) throw new Error('No outdial ANI configured for this agent/tenant.');
    }
    console.log('[crm-call-companion] outdial() dialing:', cleaned, 'via ANI:', origin);
    const result = await webex.cc.startOutdial(cleaned, origin);
    // VERIFIED live: the resolved value here is NOT the live Task instance
    // (no .on method — calling attachMediaHandler/attachTaskLifecycleHandlers
    // on it crashed with "e.on is not a function"). The real Task for this
    // call arrives separately through the already-registered 'task:incoming'
    // handler above (which itself calls attachMediaHandler + wires
    // task:assigned -> attachTaskLifecycleHandlers) — in practice it arrives
    // BEFORE this promise even resolves, so the call itself is unaffected;
    // this crash only made CMD_OUTDIAL wrongly report failure to the widget
    // UI for an outdial that actually succeeded.
    return result;
  }

  function teardown() {
    return disposeSession().then(() =>
      setState({
        agentStatus: AGENT_STATUS.LOGGED_OUT,
        agent: null,
        teams: [],
        loginVoiceOptions: [],
        idleCodes: [],
        wrapupCodes: [],
        subStatus: null,
        auxCodeId: null,
        dn: null,
        activeTask: null,
        held: false,
        recordingPaused: false,
        consultState: null,
        conferenceActive: false,
        error: null,
      })
    );
  }

  // Serializes concurrent init() calls onto ONE registration attempt. Both the
  // OAuth flow and the widget's "token exists but this (recreated) offscreen
  // document has never registered" re-init path can fire at nearly the same
  // moment; running two register() flows against the same agent produces
  // exactly the multiLogin/stale-session conflicts we work so hard to avoid.
  let initInFlight = null;
  function init(accessToken) {
    if (!initInFlight) {
      initInFlight = runInit(accessToken).finally(() => {
        initInFlight = null;
      });
    }
    return initInFlight;
  }

  return {
    init,
    stationLogin,
    stationLogout,
    setAgentState,
    updateAgentProfile,
    taskAction,
    outdial,
    getTransferAgents,
    getTransferQueues,
    uploadLogs,
    scheduleCallback,
    updateScheduledCallback,
    deleteScheduledCallback,
    getScheduledCallbacks,
    setAudioOutput,
    teardown,
    getState,
  };
}
