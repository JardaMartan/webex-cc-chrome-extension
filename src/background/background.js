/*
 * background/background.js — MV3 service worker entry point. Wires up the
 * message router, dynamic content-script registration, and OAuth token
 * refresh alarm. No SDK/business logic lives here directly — see
 * background/router.js, contentScriptRegistrar.js, oauthBroker.js.
 */
import { getSettings, onSettingsChanged } from '../shared/storage.js';
import { syncContentScriptRegistration } from './contentScriptRegistrar.js';
import { pushAudioPreferences } from './offscreenManager.js';
import { registerTokenRefreshAlarm } from './oauthBroker.js';
import { registerRouter } from './router.js';

registerRouter();
registerTokenRefreshAlarm(
  () => console.log('[crm-call-companion] token refreshed'),
  (err) => console.error('[crm-call-companion] token refresh failed', err)
);

async function syncRegistration() {
  const settings = await getSettings();
  await syncContentScriptRegistration(settings);
}

chrome.runtime.onInstalled.addListener(syncRegistration);
chrome.runtime.onStartup.addListener(syncRegistration);
onSettingsChanged(() => {
  syncRegistration();
  pushAudioPreferences();
});
