const { resolveTemplate } = require('../src/shared/urlTemplate.js');

describe('resolveTemplate', () => {
  test('substitutes {ani}, {taskId}, {queueName}', () => {
    const url = resolveTemplate('https://crm.example.com/pop?phone={ani}&task={taskId}&q={queueName}', {
      ani: '+14155550134',
      taskId: 'abc-123',
      queueName: 'Sales EU',
    });
    expect(url).toBe('https://crm.example.com/pop?phone=%2B14155550134&task=abc-123&q=Sales%20EU');
  });

  test('the {callerNumber} alias resolves to the same value as {ani}', () => {
    const url = resolveTemplate('phone={callerNumber}', { ani: '+123' });
    expect(url).toBe('phone=%2B123');
  });

  test('resolves {cad.<name>} against the task cad map', () => {
    const url = resolveTemplate('case={cad.customerId}', { cad: { customerId: 'CUST-42' } });
    expect(url).toBe('case=CUST-42');
  });

  test('unresolved placeholders become empty strings, not left verbatim', () => {
    const url = resolveTemplate('a={missing}&b={cad.alsoMissing}', {});
    expect(url).toBe('a=&b=');
  });

  test('returns an empty string for a falsy template', () => {
    expect(resolveTemplate('', {})).toBe('');
    expect(resolveTemplate(null, {})).toBe('');
  });
});
