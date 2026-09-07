import React, { useEffect, useState } from 'react';
import { getSettings, setSettings } from '../shared/storage.js';
import { sendCommand } from '../shared/messaging.js';
import { CMD, SOURCE } from '../shared/constants.js';

function redirectUri() {
  try {
    return chrome.identity.getRedirectURL();
  } catch (err) {
    return '(chrome.identity unavailable)';
  }
}

// The offscreen document that answers WebRTC calls is hidden and so can never
// show a permission prompt itself; an ungranted request there is auto-dismissed
// and the call connects with no outbound audio. Requesting getUserMedia HERE — a
// normal, visible extension page — shows the real prompt, and the grant is then
// shared with that document (same chrome-extension://<id> origin) and persists.
// chrome.contentSettings cannot automate this: its patterns reject the
// chrome-extension:// scheme outright ("Invalid scheme.").
async function checkMicrophoneAccess() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const label = stream.getAudioTracks()[0]?.label || null;
  stream.getTracks().forEach((t) => t.stop());
  // Confirms the grant actually reached the document that needs it.
  const result = await sendCommand(SOURCE.OPTIONS, CMD.ENSURE_MICROPHONE);
  if (result && result.granted === false) throw new Error(result.message || 'The background page still cannot use the microphone.');
  return result?.device || label;
}

export default function OptionsApp() {
  const [settings, setLocalSettings] = useState(null);
  const [saved, setSaved] = useState(false);
  const [micStatus, setMicStatus] = useState(null); // null | 'granted:<device>' | 'denied:<message>'

  useEffect(() => {
    getSettings().then(setLocalSettings);
  }, []);

  if (!settings) return React.createElement('p', null, 'Loading…');

  const update = (patch) => setLocalSettings((s) => ({ ...s, ...patch }));

  const save = async () => {
    await setSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="ccc-opts">
      <h1>Webex CC Client</h1>

      <section className="ccc-opts__card">
        <h2>Target CRM page</h2>
        <label>
          URL pattern (substring or glob, e.g. <code>crm.example.com/*</code>; empty = every page)
          <input
            className="ccc-opts__input"
            value={settings.crmUrlPattern}
            onChange={(e) => update({ crmUrlPattern: e.target.value })}
          />
        </label>
        <label className="ccc-opts__checkbox">
          <input
            type="checkbox"
            checked={settings.phoneDetectionEnabled}
            onChange={(e) => update({ phoneDetectionEnabled: e.target.checked })}
          />
          Show a click-to-call button when hovering over phone numbers on this page
        </label>
      </section>

      <section className="ccc-opts__card">
        <h2>Screen pop on incoming call</h2>
        <label>
          URL template — placeholders: <code>{'{ani}'}</code>, <code>{'{taskId}'}</code>,{' '}
          <code>{'{queueName}'}</code>, <code>{'{cad.customerId}'}</code> (any Desktop/CAD variable)
          <input
            className="ccc-opts__input"
            placeholder="https://crm.example.com/customers?phone={ani}&case={cad.customerId}"
            value={settings.screenPopUrlTemplate}
            onChange={(e) => update({ screenPopUrlTemplate: e.target.value })}
          />
        </label>
      </section>

      <section className="ccc-opts__card">
        <h2>Webex sign-in</h2>
        <p className="ccc-opts__hint">
          Create a Webex integration at{' '}
          <a href="https://developer.webex.com/my-apps/new/integration" target="_blank" rel="noreferrer">
            developer.webex.com/my-apps
          </a>{' '}
          and add this exact redirect URI:
        </p>
        <code className="ccc-opts__redirect">{redirectUri()}</code>
        <label>
          Client ID
          <input
            className="ccc-opts__input"
            value={settings.oauthClientId}
            onChange={(e) => update({ oauthClientId: e.target.value })}
          />
        </label>
        <label>
          Scopes
          <input
            className="ccc-opts__input"
            value={settings.oauthScopes}
            onChange={(e) => update({ oauthScopes: e.target.value })}
          />
        </label>
        <label>
          Token broker URL — see <code>/broker</code>; never put your client SECRET in this extension
          <input
            className="ccc-opts__input"
            placeholder="https://your-broker.example.com"
            value={settings.brokerUrl}
            onChange={(e) => update({ brokerUrl: e.target.value })}
          />
        </label>
      </section>

      <section className="ccc-opts__card">
        <h2>Microphone access (required for BROWSER/WebRTC calls)</h2>
        <p className="ccc-opts__hint">
          Calls are answered in a hidden background page that cannot show a permission prompt
          itself. Click below once on this page to grant microphone access — Chrome remembers it for
          this extension, and the background page uses the same grant. Re-run it if calls have no
          audio, or after changing your operating system&apos;s microphone privacy settings.
        </p>
        <button
          className="ccc-opts__save"
          onClick={() =>
            checkMicrophoneAccess()
              .then((device) => setMicStatus(`granted:${device || ''}`))
              .catch((err) => setMicStatus(`denied:${err.message}`))
          }
        >
          Grant / check microphone access
        </button>
        {micStatus?.startsWith('granted:') && (
          <p className="ccc-opts__hint">✓ Microphone access granted{micStatus.slice(8) ? ` (${micStatus.slice(8)})` : ''}.</p>
        )}
        {micStatus?.startsWith('denied:') && (
          <p className="ccc-opts__hint">✗ {micStatus.slice(7)} — check your OS/browser microphone permissions.</p>
        )}
        <p className="ccc-opts__hint">
          Pick which microphone and speaker calls use in the widget itself — the gear icon in its
          header.
        </p>
      </section>

      <button className="ccc-opts__save" onClick={save}>
        {saved ? 'Saved ✓' : 'Save settings'}
      </button>
    </div>
  );
}
