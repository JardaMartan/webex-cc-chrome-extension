/*
 * offscreen/microphoneSelection.js — chooses WHICH microphone the SDK uses.
 *
 * The Contact Center SDK hard-codes its capture constraints when answering a
 * BROWSER/WebRTC call (services/task/index.js: `getUserMedia({audio: true})`)
 * and exposes no option, callback or setter to influence the device. With a
 * bare `audio: true` Chrome picks per its own remembered per-origin
 * preference, which is why calls could come up on a microphone that is NOT the
 * operating system's default.
 *
 * The only available hook is therefore navigator.mediaDevices.getUserMedia
 * itself. Patching a platform API is normally a smell, so to keep it honest:
 * the patch lives only in this offscreen document (our own page, the sole
 * place the SDK runs), it never changes a constraint the caller set
 * explicitly, and it falls back to the unmodified request if the chosen device
 * has gone away. Revisit if the SDK ever grows a real device-selection API.
 *
 * NOTE: the preference is PUSHED IN by the service worker rather than read
 * from chrome.storage here — chrome.runtime is the only extensions API an
 * offscreen document may use, and touching chrome.storage throws at load and
 * takes the whole document (and with it the SDK connection) down.
 */

// Chrome exposes a virtual input with deviceId 'default' that always tracks
// the OS default device — asking for it explicitly is what makes us follow the
// system setting instead of Chrome's remembered per-origin choice.
const SYSTEM_DEFAULT_DEVICE_ID = 'default';

let preferredDeviceId = '';

// Takes effect on the NEXT call: the SDK captures the stream at accept time.
export function setPreferredMicrophone(deviceId) {
  preferredDeviceId = deviceId || '';
}

// Enumerated HERE rather than in the widget or options page because device IDs
// are salted per origin: only the IDs this document sees can be handed back to
// getUserMedia/setSinkId in this document. Labels stay blank until microphone
// access has been granted, so warm the mic up first.
export async function listAudioDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const pick = (kind, fallbackLabel) =>
    devices
      .filter((d) => d.kind === kind && d.deviceId)
      .map((d) => ({ deviceId: d.deviceId, label: d.label || fallbackLabel }));
  return { inputs: pick('audioinput', 'Microphone'), outputs: pick('audiooutput', 'Speaker') };
}

function buildAudioConstraints(requested) {
  const base = requested === true || requested == null ? {} : { ...requested };
  if (base.deviceId) return base; // an explicit caller choice always wins
  // `exact`, not `ideal`, for BOTH branches: an ideal deviceId is advisory and
  // Chrome silently ignores it when it has its own remembered per-origin
  // device, which is exactly the bug this module exists to fix. Anything
  // unsatisfiable is caught below and retried unconstrained.
  return { ...base, deviceId: { exact: preferredDeviceId || SYSTEM_DEFAULT_DEVICE_ID } };
}

export function installMicrophonePreference() {
  const devices = navigator.mediaDevices;
  const nativeGetUserMedia = devices.getUserMedia.bind(devices);

  devices.getUserMedia = async (constraints = {}) => {
    if (!constraints.audio) return nativeGetUserMedia(constraints);
    const patched = { ...constraints, audio: buildAudioConstraints(constraints.audio) };
    try {
      const stream = await nativeGetUserMedia(patched);
      console.log(
        '[crm-call-companion] capturing from microphone:',
        stream.getAudioTracks()[0]?.label,
        preferredDeviceId ? `(pinned ${preferredDeviceId})` : '(system default)'
      );
      return stream;
    } catch (err) {
      // The selected microphone was unplugged/disabled since it was picked.
      // Never let that turn into a call with no audio at all.
      if (err?.name !== 'OverconstrainedError' && err?.name !== 'NotFoundError') throw err;
      console.warn(
        `[crm-call-companion] microphone constraint "${preferredDeviceId || SYSTEM_DEFAULT_DEVICE_ID}" unsatisfiable (${err.name}); letting the browser choose.`
      );
      return nativeGetUserMedia(constraints);
    }
  };
}
