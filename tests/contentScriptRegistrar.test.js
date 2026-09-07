const { toMatchPatterns } = require('../src/background/contentScriptRegistrar.js');

describe('toMatchPatterns', () => {
  test('empty/"*" pattern matches every URL', () => {
    expect(toMatchPatterns('')).toEqual(['<all_urls>']);
    expect(toMatchPatterns('*')).toEqual(['<all_urls>']);
  });

  test('a bare hostname becomes an exact-host pattern (regression: no embedded host wildcard)', () => {
    expect(toMatchPatterns('smile-crm-finder.lovable.app')).toEqual([
      '*://smile-crm-finder.lovable.app/*',
    ]);
  });

  test('a hostname with a path keeps the path as a wildcard suffix', () => {
    expect(toMatchPatterns('crm.example.com/accounts')).toEqual(['*://crm.example.com/accounts*']);
  });

  test('an explicit subdomain wildcard host is preserved', () => {
    expect(toMatchPatterns('*.example.com')).toEqual(['*://*.example.com/*']);
  });

  test('a full scheme://host/path pattern is sanitized the same way', () => {
    expect(toMatchPatterns('https://crm.example.com')).toEqual(['https://crm.example.com/*']);
    expect(toMatchPatterns('https://crm.example.com/*')).toEqual(['https://crm.example.com/*']);
  });

  test('a stray "*" embedded in the host is stripped, never left in the match pattern', () => {
    expect(toMatchPatterns('*crm.example.com*')).toEqual(['*://crm.example.com/*']);
  });
});
