/*
 * offscreen/offscreen.js — the offscreen document's entry point. Owns the
 * single webexSdkClient instance (the real, persistent SDK connection) and
 * relays commands/events to/from the background router.
 */
import { CMD, EVT, SOURCE } from '../shared/constants.js';
import { createWebexSdkClient } from '../sdk/webexSdkClient.js';
import { installMicrophonePreference, setPreferredMicrophone, listAudioDevices } from './microphoneSelection.js';

function emit(type, payload) {
  chrome.runtime.sendMessage({ source: SOURCE.OFFSCREEN, type, payload });
}

// Must run before any getUserMedia call in this document, including the
// warm-up below and every call the SDK later answers.
installMicrophonePreference();

const client = createWebexSdkClient({
  onStateChange: (state) => emit(EVT.STATE_CHANGED, state),
  onIncomingTask: (task) => emit(EVT.INCOMING_TASK, task),
});

// The SDK answers BROWSER/WebRTC calls with getUserMedia({audio:true}) from
// THIS hidden document, which has no visible surface Chrome could show a
// permission prompt on — an ungranted request is auto-dismissed and the call
// then connects with no outbound audio at all. The grant must therefore have
// been made once from the visible options page (same extension origin);
// acquiring the mic here proves it is in place and surfaces a block
// immediately instead of on the agent's first call.
let micReady = null;
function ensureMicrophone() {
  if (!micReady) {
    micReady = navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // A non-empty device label is only exposed once mic access is really
        // granted — useful for telling "allowed" from "allowed but muted".
        const label = stream.getAudioTracks()[0]?.label || null;
        stream.getTracks().forEach((t) => t.stop());
        return { granted: true, device: label };
      })
      .catch((err) => {
        micReady = null; // allow a later retry (e.g. user fixed OS permissions)
        const message =
          err?.name === 'NotAllowedError'
            ? 'Chrome has not granted microphone access to this extension. Open the extension options and click "Grant / check microphone access".'
            : err?.name === 'NotFoundError'
              ? 'No microphone input device was found.'
              : err?.message || String(err);
        console.error('[crm-call-companion] microphone unavailable in offscreen document:', err);
        emit(EVT.ERROR, { message: `Microphone unavailable — calls will have no audio. ${message}` });
        return { granted: false, message };
      });
  }
  return micReady;
}
ensureMicrophone();

async function handle(type, payload) {
  switch (type) {
    case CMD.ENSURE_MICROPHONE:
      return ensureMicrophone();
    case CMD.SET_AUDIO_DEVICES:
      setPreferredMicrophone(payload.microphoneDeviceId);
      await client.setAudioOutput(payload.speakerDeviceId);
      return { ok: true };
    case CMD.LIST_AUDIO_DEVICES:
      await ensureMicrophone(); // labels stay blank until access is granted
      return listAudioDevices();
    case CMD.UPLOAD_LOGS:
      return client.uploadLogs();
    case CMD.SCHEDULE_CALLBACK:
      return client.scheduleCallback(payload);
    case CMD.UPDATE_CALLBACK:
      return client.updateScheduledCallback(payload.id, payload.request);
    case CMD.DELETE_CALLBACK:
      return client.deleteScheduledCallback(payload.id);
    case CMD.GET_SCHEDULED_CALLBACKS:
      return { callbacks: await client.getScheduledCallbacks(payload) };
    case 'CMD_INIT_SDK':
      // Make sure the mic is live before the agent can ever be made
      // Available, so the first inbound call never races the grant.
      await ensureMicrophone();
      return client.init(payload.accessToken);
    case 'CMD_TEARDOWN_SDK':
      await client.teardown();
      return { ok: true };
    case CMD.STATION_LOGIN:
      return client.stationLogin(payload);
    case CMD.STATION_LOGOUT:
      return client.stationLogout();
    case CMD.SET_AGENT_STATE:
      return client.setAgentState(payload);
    case CMD.UPDATE_AGENT_PROFILE:
      return client.updateAgentProfile(payload);
    case CMD.TASK_ACTION:
      return client.taskAction(payload.taskId, payload.action, payload.extra);
    case CMD.OUTDIAL:
      return client.outdial(payload.phoneNumber);
    case CMD.GET_TRANSFER_AGENTS:
      return client.getTransferAgents();
    case CMD.GET_TRANSFER_QUEUES:
      return client.getTransferQueues();
    case CMD.GET_STATE:
      return client.getState();
    default:
      throw new Error(`offscreen: unknown command "${type}"`);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.source !== SOURCE.BACKGROUND) return undefined;
  handle(msg.type, msg.payload || {})
    .then(sendResponse)
    .catch((err) => {
      // Visible ONLY in this offscreen document's own DevTools console
      // (chrome://extensions -> this extension -> "Inspect views:
      // offscreen.html") — not the background service worker or page console.
      console.error(`[crm-call-companion] offscreen command "${msg.type}" failed:`, err);
      const message = (err && err.message) || String(err) || 'Unknown error';
      emit(EVT.ERROR, { message });
      sendResponse({ error: message });
    });
  return true;
});
