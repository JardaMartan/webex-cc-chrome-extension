# Privacy Policy — Webex CC Client

_Draft for the developer to review, adapt, and host at a public URL before
submitting to the Chrome Web Store (Privacy practices tab requires a live
Privacy policy link). Replace the placeholders in brackets before publishing._

**Last updated:** [DATE]

Webex CC Client ("the extension") is a browser extension that injects a Webex
Contact Center agent widget into a CRM web page you configure, so an agent can
sign in, take calls, and click-to-dial without leaving that page.

## What data the extension handles

- **Webex sign-in (OAuth) tokens** — obtained via `chrome.identity.launchWebAuthFlow`
  when you click "Sign in with Webex". Access/refresh tokens are kept only in
  `chrome.storage.session` (in-memory, cleared when the browser fully closes)
  and are sent only to Webex's own APIs (`webexapis.com`) and to the token
  broker you configure (see below) — never to any other third party.
- **Microphone audio** — captured only while you are on an active call
  (`getUserMedia`), to send your voice through the Webex Contact Center call.
  Audio is streamed directly to the call (via the Webex SDK/WebRTC) and is
  never recorded, stored, or sent anywhere by the extension itself.
- **Phone numbers / customer names you enter or click** — used only to place
  outbound calls and schedule callbacks through Webex Contact Center APIs;
  not stored by the extension beyond what's needed to show your own scheduled
  callbacks, and not sent anywhere except Webex's APIs.
- **Extension settings** (target CRM URL pattern, screen-pop template, your
  OAuth client ID, chosen microphone/speaker, color theme) — stored locally via
  `chrome.storage.local` on your own device and never transmitted anywhere.
- **Page content** — the extension scans text on the CRM page you configure it
  for, only to detect phone-number-looking text and show a "Call" button next
  to it. This scanning happens locally in your browser; page content is never
  sent anywhere.

## Third parties

- **Webex (webexapis.com)** — receives your OAuth authorization and API calls
  needed to sign in, register as an agent, and control calls/callbacks. Governed
  by [Cisco's privacy policy](https://www.cisco.com/c/en/us/about/legal/privacy-full.html).
- **Your own token-exchange broker** (`brokerUrl` in Options — see the `/broker`
  folder in this repository) — receives only the OAuth authorization code (or
  refresh token) needed to complete sign-in, and returns access/refresh tokens.
  It never sees your call/customer data. [Describe who operates your broker
  deployment and where it is hosted, e.g. "operated by ORG_NAME on Google Cloud
  Run in region us-central1."]

## Data retention & deletion

- Tokens live only in `chrome.storage.session` and are cleared automatically
  when the browser closes, or immediately on Sign out / Station logout.
- Settings live in `chrome.storage.local` until you uninstall the extension or
  clear it from the Options page / `chrome://extensions`.
- The extension does not operate any server-side database of its own; there is
  nothing to request deletion of beyond uninstalling the extension.

## Contact

[Your name/organization] — [support email or URL].
