/*
 * shared/pkce.js — Proof Key for Code Exchange helpers (RFC 7636), used by
 * background/oauthBroker.js. Uses only Web Crypto (available in MV3 service
 * workers), no Node polyfills needed.
 */

function base64UrlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** RFC 7636 §4.1: 43-128 chars from [A-Za-z0-9-._~]. */
export function generateCodeVerifier() {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, 128);
}

/** code_challenge = BASE64URL(SHA256(code_verifier)), method S256. */
export async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

export function generateState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}
