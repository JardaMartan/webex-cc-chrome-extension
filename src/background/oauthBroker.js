/*
 * background/oauthBroker.js — Authorization Code + PKCE login against Webex,
 * using chrome.identity.launchWebAuthFlow for the interactive step.
 *
 * SECURITY: Webex's /v1/access_token endpoint requires client_id AND
 * client_secret even when PKCE is used (confirmed against
 * developer.webex.com/docs/login-with-webex — PKCE only ADDS code_verifier,
 * it does not remove the secret requirement). A client_secret must never ship
 * inside a browser extension (anyone can unpack it). So the actual code->token
 * and refresh->token exchanges are delegated to a small server-side "broker"
 * (see /broker) that holds the secret; this file only ever sends {code,
 * redirect_uri, code_verifier} or {refresh_token} to YOUR broker's URL
 * (configured in Options), never to webexapis.com directly with a secret.
 */
import { getSettings } from '../shared/storage.js';
import { getTokens, setTokens, clearTokens } from '../shared/storage.js';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../shared/pkce.js';

export const REFRESH_ALARM = 'crm-call-companion-token-refresh';

function launchWebAuthFlowPromise(url) {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (redirectedTo) => {
      if (chrome.runtime.lastError || !redirectedTo) {
        reject(new Error(chrome.runtime.lastError?.message || 'OAuth flow was cancelled.'));
        return;
      }
      resolve(redirectedTo);
    });
  });
}

async function exchangeCodeForTokens({ brokerUrl, code, redirectUri, verifier }) {
  const res = await fetch(`${brokerUrl.replace(/\/$/, '')}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier: verifier }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (HTTP ${res.status})`);
  return res.json();
}

function scheduleRefresh(expiresInSeconds) {
  // Refresh 5 min before expiry (never less than 1 min out). chrome.alarms is
  // used instead of setTimeout because MV3 service workers can be torn down
  // between tab events; an alarm survives that and wakes the worker on fire.
  const minutes = Math.max(1, Math.floor((expiresInSeconds || 3600) / 60) - 5);
  chrome.alarms.create(REFRESH_ALARM, { delayInMinutes: minutes });
}

export async function startLogin() {
  const settings = await getSettings();
  if (!settings.oauthClientId || !settings.brokerUrl) {
    throw new Error('OAuth is not configured yet — set Client ID and Broker URL in the extension Options page.');
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  const authUrl = new URL('https://webexapis.com/v1/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', settings.oauthClientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', settings.oauthScopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const resultUrl = await launchWebAuthFlowPromise(authUrl.toString());
  const params = new URL(resultUrl).searchParams;
  if (params.get('state') !== state) {
    throw new Error('OAuth state mismatch (possible CSRF) — login aborted.');
  }
  const code = params.get('code');
  if (!code) throw new Error('Webex did not return an authorization code (login was likely denied).');

  const tokens = await exchangeCodeForTokens({ brokerUrl: settings.brokerUrl, code, redirectUri, verifier });
  await setTokens({ ...tokens, obtainedAt: Date.now() });
  scheduleRefresh(tokens.expires_in);
  return tokens;
}

export async function refreshTokens() {
  const settings = await getSettings();
  const current = await getTokens();
  if (!current?.refresh_token) throw new Error('No refresh token on file — a full login is required.');
  if (!settings.brokerUrl) throw new Error('Broker URL is not configured.');

  const res = await fetch(`${settings.brokerUrl.replace(/\/$/, '')}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  });
  if (!res.ok) throw new Error(`Token refresh failed (HTTP ${res.status})`);
  const tokens = await res.json();
  await setTokens({ ...tokens, obtainedAt: Date.now() });
  scheduleRefresh(tokens.expires_in);
  return tokens;
}

export async function logout() {
  await clearTokens();
  chrome.alarms.clear(REFRESH_ALARM);
}

/** Call once from background.js's top level to react to the refresh alarm firing. */
export function registerTokenRefreshAlarm(onRefreshed, onError) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== REFRESH_ALARM) return;
    refreshTokens().then(onRefreshed).catch(onError);
  });
}
