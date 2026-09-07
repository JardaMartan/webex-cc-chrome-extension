const { generateCodeVerifier, generateCodeChallenge, generateState } = require('../src/shared/pkce.js');

describe('pkce', () => {
  test('generateCodeVerifier produces a 43-128 char string using the RFC 7636 alphabet', () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  test('generateCodeVerifier is not deterministic', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  test('generateCodeChallenge is a deterministic function of the verifier (S256)', async () => {
    const verifier = 'forty_three_character_code_verifier_example_1234567890';
    const a = await generateCodeChallenge(verifier);
    const b = await generateCodeChallenge(verifier);
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9\-_]+$/); // base64url, no padding
  });

  test('generateState produces a random, URL-safe string', () => {
    const s = generateState();
    expect(s.length).toBeGreaterThan(10);
    expect(generateState()).not.toBe(s);
  });
});
