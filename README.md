# Webex CC Client

A browser extension that injects a Webex Contact Center agent widget — login,
station login, answer/hold/mute/end calls, and click-to-dial — directly into
any CRM web page. Built as a fresh, standalone spin-off from the
`task-management` Webex CC widget in this workspace, reusing that project's
proven **MomentumUI integration patterns** and applying them to a **standalone
Webex Contact Center SDK** (no Webex CC Desktop host required).

## What it does

- Injects a small floating "Webex CC Client" panel (React + MomentumUI, in a
  Shadow DOM) into a CRM page you configure, letting an agent sign in with
  Webex, station-login, and take calls without ever opening Webex CC Desktop.
- Lets you configure, in the extension's Options page, **which page** the
  widget/scanner activates on, and a **screen-pop URL template** that opens
  when a call arrives (with `{ani}`, `{taskId}`, `{queueName}` or `{cad.any_desktop_variable}` placeholders).
- Adds a small "Call" pill that appears when you hover any phone-number-looking
  text on the configured page, to start an outbound call with one click.

## Architecture

```
┌───────────────────────────── CRM tab (any page) ───────────────────────────────┐
│  content.js  (dynamically registered against your configured URL pattern)      │
│    - mounts <WidgetApp/> (React+Redux+MomentumUI) in a Shadow DOM              │
│    - phone/phonePopover.js scans the DOM, injects hover "Call" pills           │
│    - talks to the background service worker via chrome.runtime messaging       │
└────────────────────────────────────────┬───────────────────────────────────────┘
                                         │ CMD_* / EVT_*
┌────────────────────────────────────────▼───────────────────────────────────────┐
│  background.js  (MV3 service worker — router.js, oauthBroker.js, screenPop.js) │
│    - routes commands to the offscreen document                                 │
│    - owns OAuth (PKCE) login + token storage (chrome.storage.session)          │
│    - resolves the screen-pop URL template and navigates the CRM tab            │
└────────────────────────────────────────┬───────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼───────────────────────────────────────┐
│  offscreen.js  (hidden, extension-owned document — chrome.offscreen)           │
│    - the ONLY place the Webex Contact Center SDK is loaded (sdk/webexSdkClient)│
│    - persists across CRM tab navigation/reload (see "Why an offscreen doc")    │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Why an offscreen document, not the content script itself?

A naive design would run the SDK directly in the CRM page's content script.
But navigating the CRM tab (which the configured screen-pop feature does on
purpose!) tears down and re-injects the content script — which would kill the
agent's login/registration and any active call. Instead, the actual
`webex.cc` SDK connection lives in a **Chrome offscreen document**: a hidden
page owned by the extension, independent of any tab, that survives CRM
navigation. The content-script widget is a thin UI that sends commands and
receives a full state snapshot broadcast — reopening/reloading the CRM page
just re-hydrates the same live session, no re-login needed.

## Security: why a broker?

Webex's `/v1/access_token` endpoint requires `client_id` **and**
`client_secret` even when using PKCE (verified against
[developer.webex.com/docs/login-with-webex](https://developer.webex.com/docs/login-with-webex)
— PKCE only adds `code_verifier`, it does not remove the secret requirement).
A `client_secret` must never ship inside a browser extension: anyone can
unpack the `.crx`/loaded folder and read it in plaintext.

So this project splits OAuth in two:
- The extension (`background/oauthBroker.js`) does the interactive part
  (`chrome.identity.launchWebAuthFlow`, PKCE `code_verifier`/`code_challenge`)
  and only ever sends `{code, redirect_uri, code_verifier}` or
  `{refresh_token}` to **your own broker URL**.
- **`/broker`** is a minimal Node/Express server that holds the real
  `client_secret` and performs the actual `POST /v1/access_token` call. Deploy
  it anywhere that can hold a secret env var (Cloud Run, a small VM, etc. — see
  the sibling `task-management` project's `relay-server/` for a deployment
  template). It only ever talks to `webexapis.com` and only accepts requests
  from your extension's origin (`ALLOWED_ORIGIN`).

## Setup

The extension ships with a **fixed, deterministic extension ID** —
`olckgckmelfihnkbibckgllpegijjeek` — via the `"key"` field in `manifest.json`
(generated once with a throwaway keypair, see `extension-private-key.pem`,
gitignored). This means the OAuth redirect URI and the broker's CORS origin
are known *before* you ever load the extension, and stay the same across
reloads/reinstalls on any machine that uses this same repo checkout.

- Redirect URI to register: `https://olckgckmelfihnkbibckgllpegijjeek.chromiumapp.org/`
- Extension origin (for the broker's `ALLOWED_ORIGIN`): `chrome-extension://olckgckmelfihnkbibckgllpegijjeek`

### 1. Broker — deploy your own

The token-exchange broker (`/broker`) is a minimal Node/Express server — deploy
it anywhere that can hold a secret env var. **Google Cloud Run** works well:

```bash
gcloud run deploy crm-call-companion-broker --source broker \
  --project=YOUR_GCP_PROJECT --region=YOUR_REGION --allow-unauthenticated
```

After the first deploy, note the service URL Cloud Run prints — you'll need it
for `brokerUrl` in Options (step 5) and `ALLOWED_ORIGIN` (step 3).

### 2. Create your Webex integration

1. [developer.webex.com/my-apps/new/integration](https://developer.webex.com/my-apps/new/integration)
2. Redirect URI: `https://olckgckmelfihnkbibckgllpegijjeek.chromiumapp.org/`
3. Scope: `cjp:user cjp:config_read spark:webrtc_calling`.
4. Copy the **Client ID** and **Client Secret**.

### 3. Put the real secret in Secret Manager (run this yourself — never share

the secret value in chat/logs):
```bash
printf '%s' 'YOUR_REAL_CLIENT_SECRET' | gcloud secrets versions add webex-client-secret \
  --project=YOUR_GCP_PROJECT --data-file=-
```
Then pick up the new version + set the real Client ID (Client ID is NOT
secret, this part is safe to run/share):
```bash
gcloud run services update crm-call-companion-broker \
  --project=YOUR_GCP_PROJECT --region=YOUR_REGION \
  --set-env-vars=WEBEX_CLIENT_ID=YOUR_REAL_CLIENT_ID \
  --update-secrets=WEBEX_CLIENT_SECRET=webex-client-secret:latest
```

### 4. Load the extension

`npm install && npm run build`, then Chrome/Edge → `chrome://extensions` →
Developer mode → **Load unpacked** → select the `dist/` folder. Confirm the ID
shown matches `olckgckmelfihnkbibckgllpegijjeek` (it will, thanks to the `key`).

### 5. Configure Options

Open the extension's Options page and set:
- **Target CRM page**: your CRM's domain, e.g. `crm.example.com`
- **Screen-pop URL template**: e.g. `https://crm.example.com/customers?phone={ani}`
- **Client ID**: from step 2
- **Scopes**: `cjp:user cjp:config_read spark:webrtc_calling`
- **Token broker URL**: the Cloud Run URL from step 1

Open your configured CRM page, click the floating call bubble, **Sign in with
Webex**.

## Project layout

| Path | Purpose |
|---|---|
| `manifest.json` | MV3 manifest — no static `content_scripts`; see `background/contentScriptRegistrar.js` |
| `src/background/` | Service worker: message router, OAuth, offscreen lifecycle, screen-pop, dynamic content-script registration |
| `src/offscreen/` | Hidden document hosting the persistent SDK connection |
| `src/sdk/webexSdkClient.js` | The only file that imports the Webex Contact Center SDK |
| `src/widget/` | The injected React+Redux+MomentumUI widget (content script) + phone-number popover scanner |
| `src/options/`, `src/popup/` | Extension UI pages |
| `src/shared/` | Pure, framework-free helpers reused everywhere: `constants.js`, `storage.js`, `messaging.js`, `urlTemplate.js`, `phoneMatcher.js`, `pkce.js`, `urlMatch.js`, `injectCss.js` |
| `broker/` | Minimal server-side OAuth token-exchange proxy (holds the client secret) |
| `tests/` | Jest unit tests for the pure helpers |

## MomentumUI usage (patterns reused from `task-management`)

- Only Momentum components verified to emit **no icon-font markup** are used
  (`Button`, `Badge`, `Spinner`, `AlertBanner`) — icon fonts render as broken
  glyphs in a Shadow DOM/standalone bundle unless the woff2 is inlined, which
  this project deliberately avoids by not using icon-emitting components.
- Custom "pill" controls (segmented toggle, dropdown, floating panel) are
  layered on Momentum **design tokens** (`--accent`, `--border`, `--text`,
  etc.), mirroring the `src-report` design system in the sibling project,
  rather than fighting Momentum's raw `ButtonGroup`/`Select` chrome.
- All CSS (including `@momentum-ui/core/css/momentum-ui.min.css`) is imported
  as a raw string (`asset/source`) and manually injected as a `<style>` tag
  into the widget's Shadow Root — required because normal `style-loader`
  injection targets `document.head`, which a Shadow DOM does not inherit from.

## Known limitations (read before production use)

- **Task API surface partly unverified at runtime**: method/event names in
  `sdk/webexSdkClient.js` were checked against the installed package's shipped
  TypeScript declarations (not guessed), but this has not been exercised
  against a live Webex Contact Center tenant. Verify `stationLogin`/
  `setAgentState`/`startOutdial`/task lifecycle events against your tenant's
  actual behavior — see the file's header comment for exact sources.
- **No Call Associated Data (CAD) exposed by this SDK version**: the
  `{cad.<name>}` screen-pop placeholder is implemented but currently always
  resolves to nothing — no custom flow variable field was found anywhere in
  the installed `@webex/contact-center` task types.
- **Outbound ANI (`origin`) auto-selection is best-effort**: `startOutdial`
  requires a configured outdial ANI; `webexSdkClient.outdial()` just takes the
  first one returned by `getOutdialAniEntries({})`. A multi-ANI tenant needs a
  picker UI (not built in v1).
- **Phone-number detection is heuristic**, not `libphonenumber`-based — tune
  `shared/phoneMatcher.js` for your CRM's number formats/locale.
- **Bundle size**: `offscreen.js` is ~5MB because the full `webex` npm package
  bundles many plugins (meetings, calling, mercury, etc.) beyond just Contact
  Center; this only affects the hidden offscreen document, not the injected
  widget (`content.js`, ~2MB, dominated by `webex` isn't pulled in there —
  only Momentum/React/Redux). Acceptable for an extension but worth trimming
  with a narrower entry point if Webex ever ships one.
- **Mute state, hold state** are tracked as local component state in
  `CallControls.jsx` (the SDK exposes `toggleMute()` as a single toggle, not a
  queryable state) — a page reload loses that local UI flag even though the
  underlying call is unaffected.

## Chrome Web Store submission checklist

- **Icons**: `icons/icon{16,32,48,128}.png` (procedurally generated by
  `scripts/generate-icons.js`, wired into `manifest.json` + `webpack.config.js`)
  are **placeholders** — a flat phone-handset glyph on Momentum blue-60, not a
  real logo. Replace them (re-run the script after editing it, or drop in your
  own PNGs of the same names) before publishing.
- **`"key"` in manifest.json is intentional, keep it**: it pins the extension's
  ID to `olckgckmelfihnkbibckgllpegijjeek` (see "Setup" above) both for local
  unpacked loads AND for the production Chrome Web Store listing — uploading
  a manifest with this `"key"` reproduces the same ID, so the OAuth redirect
  URI and the broker's `ALLOWED_ORIGIN` keep working unchanged after
  publishing. Do not remove it or let the dashboard generate a new one.
- **Production build**: `npm run build` (bumps the manifest version, builds
  with `mode=production`, which also drops source maps — see
  `webpack.config.js`). Zip the **contents** of `dist/` (manifest.json at the
  zip root, not inside a subfolder).
- **Privacy practices tab** (Developer Dashboard):
  - *Single purpose*: "Injects a Webex Contact Center agent widget into a
    user-configured CRM page, so a contact center agent can sign in and
    control calls without leaving that page."
  - *Permission justifications* (copy/adapt):
    - `storage` — persist the extension's own settings (target CRM URL,
      screen-pop template, OAuth client id, audio device choice) locally.
    - `tabs` — detect/track which tab hosts the configured CRM page, to relay
      call state and perform the configurable screen-pop navigation.
    - `scripting` — register the widget's content script only against the
      CRM URL pattern the user configures (not every page unconditionally).
    - `offscreen` — host the persistent Webex Contact Center SDK
      (WebSocket + WebRTC) connection outside any tab, so it survives CRM
      page navigation/reload.
    - `identity` — `chrome.identity.launchWebAuthFlow` for the Webex OAuth
      (PKCE) sign-in.
    - `alarms` — schedule the OAuth access-token refresh before it expires.
    - `host_permissions: <all_urls>` — the target CRM page is user-configured
      (any URL, set in Options), so the widget/content-script and phone-number
      scanner cannot be limited to a fixed origin ahead of time.
  - *Remote code*: "No, I am not using remote code" (MV3 forbids it anyway —
    see `README.md` "Bundling" notes... i.e. no CDN-loaded script anywhere).
  - *Data use*: discloses OAuth tokens (authentication info) and microphone
    audio (only during an active call, never recorded/stored) — see
    `PRIVACY.md`.
  - *Privacy policy URL*: host `PRIVACY.md` (fill in its `[DATE]`/`[ORG]`/
    contact placeholders first) somewhere public — e.g. GitHub Pages, or the
    same origin as your token broker — and link it here.
- **Store listing tab**: needs a 128x128 store icon (reuse `icons/icon128.png`
  or better artwork), 1–5 screenshots at 1280x800, and a short + detailed
  description. None of this ships in the extension package itself.

