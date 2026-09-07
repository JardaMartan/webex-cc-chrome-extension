/*
 * background/offscreenManager.js — creates (once) and talks to the extension's
 * offscreen document, which is where the persistent @webex/contact-center SDK
 * connection actually lives.
 *
 * WHY an offscreen document and not the service worker itself: MV3 service
 * workers are non-persistent (Chrome can and will kill them after ~30s idle)
 * and the Contact Center SDK needs a long-lived WebSocket + WebRTC (audio)
 * session. An offscreen document is a hidden, extension-owned page that is
 * NOT tied to any tab — so a CRM tab navigating/reloading (which tears down
 * and re-injects the content-script widget) never disturbs the agent's
 * login/registration or an active call.
 */
import { CMD, SOURCE } from '../shared/constants.js';
import { getSettings } from '../shared/storage.js';

const OFFSCREEN_URL = 'offscreen.html';

// An offscreen document may only use chrome.runtime — it cannot read
// chrome.storage itself — so its audio device choices have to be pushed in.
export async function pushAudioPreferences() {
  const { microphoneDeviceId, speakerDeviceId } = await getSettings();
  try {
    await chrome.runtime.sendMessage({
      source: SOURCE.BACKGROUND,
      type: CMD.SET_AUDIO_DEVICES,
      payload: { microphoneDeviceId: microphoneDeviceId || '', speakerDeviceId: speakerDeviceId || '' },
    });
  } catch (err) {
    /* no offscreen document open yet — it picks the values up when created */
  }
}

export async function ensureOffscreenDocument() {
  if (chrome.runtime.getContexts) {
    const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (existing.length > 0) return;
  }
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      // 'WEB_RTC' covers the persistent WebSocket + calling session;
      // 'USER_MEDIA' is required too — BROWSER (WebRTC) login answers a call
      // via getUserMedia({audio:true}) from this document. Declaring the
      // reason is necessary but NOT sufficient: a hidden document cannot show
      // a permission prompt, so microphone access must already be granted for
      // this extension's origin — see options/OptionsApp.jsx.
      // 'AUDIO_PLAYBACK' — this document also plays the remote party's audio
      // via an <audio> element (see sdk/webexSdkClient.js attachMediaHandler).
      reasons: ['WEB_RTC', 'USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification:
        'Hosts the persistent Webex Contact Center SDK connection (login session + active call, incl. WebRTC audio) so it survives CRM tab navigation.',
    });
  } catch (err) {
    // Race: another event already created it between our getContexts check and now.
    if (!String(err.message).includes('single offscreen document')) throw err;
  }
  await pushAudioPreferences();
}
