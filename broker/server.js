/*
 * broker/server.js — the ONLY place the Webex integration's client_secret is
 * ever used. Webex's /v1/access_token endpoint requires client_id+
 * client_secret even for PKCE flows (see README "Security: why a broker?"),
 * and a secret must never be embedded in a browser extension (it is
 * trivially extractable from the unpacked bundle) — so the extension's
 * background/oauthBroker.js only ever talks to THIS server, sending the
 * authorization code / refresh token, never a secret.
 *
 * Deploy this anywhere that can hold a secret env var (Cloud Run, a Cloud
 * Function, a small VM, etc.) — see the sibling task-management project's
 * relay-server/ for a Cloud Run deployment template.
 */
const express = require('express');

const {
  WEBEX_CLIENT_ID,
  WEBEX_CLIENT_SECRET,
  ALLOWED_ORIGIN, // e.g. chrome-extension://<your-extension-id>
  PORT = 8787,
} = process.env;

if (!WEBEX_CLIENT_ID || !WEBEX_CLIENT_SECRET) {
  console.error('WEBEX_CLIENT_ID and WEBEX_CLIENT_SECRET env vars are required.');
  process.exit(1);
}

const TOKEN_ENDPOINT = 'https://webexapis.com/v1/access_token';

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  // Only ever allow the extension's own origin, not '*' — this endpoint mints
  // real bearer tokens, so it must not be an open CORS proxy.
  if (ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

async function postToWebex(params) {
  const body = new URLSearchParams({
    client_id: WEBEX_CLIENT_ID,
    client_secret: WEBEX_CLIENT_SECRET,
    ...params,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.message || `Webex token endpoint returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

app.post('/token', async (req, res) => {
  const { code, redirect_uri: redirectUri, code_verifier: verifier } = req.body || {};
  if (!code || !redirectUri) {
    return res.status(400).json({ error: 'code and redirect_uri are required' });
  }
  try {
    const tokens = await postToWebex({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    res.json(tokens);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/refresh', async (req, res) => {
  const { refresh_token: refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refresh_token is required' });
  try {
    const tokens = await postToWebex({ grant_type: 'refresh_token', refresh_token: refreshToken });
    res.json(tokens);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`token broker listening on :${PORT}`));
