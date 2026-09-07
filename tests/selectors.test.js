import { canPlaceCall, canScheduleCallback, isOnCall } from '../src/widget/store/selectors.js';
import { AGENT_STATUS } from '../src/shared/constants.js';

const dialable = { agentStatus: AGENT_STATUS.AVAILABLE, loginOption: 'BROWSER', activeTask: null };

describe('canPlaceCall', () => {
  it('allows dialling once the agent is station logged in with a device', () => {
    expect(canPlaceCall(dialable)).toBe(true);
  });

  it('requires a telephony device to be bound', () => {
    expect(canPlaceCall({ ...dialable, loginOption: null })).toBe(false);
  });

  it('blocks while a task is offered but not yet answered (reserved)', () => {
    expect(canPlaceCall({ ...dialable, activeTask: { taskId: 'a1' } })).toBe(false);
  });

  it('blocks while engaged on a call or wrapping one up', () => {
    expect(canPlaceCall({ ...dialable, agentStatus: AGENT_STATUS.ON_CALL })).toBe(false);
    expect(canPlaceCall({ ...dialable, agentStatus: AGENT_STATUS.WRAP_UP })).toBe(false);
  });

  it('blocks before the agent has a station session', () => {
    expect(canPlaceCall({ ...dialable, agentStatus: AGENT_STATUS.REGISTERED })).toBe(false);
    expect(canPlaceCall({ ...dialable, agentStatus: AGENT_STATUS.CONNECTING })).toBe(false);
    expect(canPlaceCall({ ...dialable, agentStatus: AGENT_STATUS.LOGGED_OUT })).toBe(false);
  });

  it('is safe to call with no state at all', () => {
    expect(canPlaceCall()).toBe(false);
    expect(canPlaceCall({})).toBe(false);
  });
});

describe('isOnCall', () => {
  it('distinguishes an engaged agent from one who merely cannot dial', () => {
    expect(isOnCall({ agentStatus: AGENT_STATUS.ON_CALL })).toBe(true);
    expect(isOnCall({ agentStatus: AGENT_STATUS.WRAP_UP })).toBe(false);
    expect(isOnCall()).toBe(false);
  });
});

describe('canScheduleCallback', () => {
  it('stays available in states that block dialling', () => {
    expect(canScheduleCallback({ agentStatus: AGENT_STATUS.ON_CALL })).toBe(true);
    expect(canScheduleCallback({ agentStatus: AGENT_STATUS.WRAP_UP })).toBe(true);
    expect(canScheduleCallback({ agentStatus: AGENT_STATUS.REGISTERED })).toBe(true);
  });

  it('needs a live session to reach the callback API', () => {
    expect(canScheduleCallback({ agentStatus: AGENT_STATUS.LOGGED_OUT })).toBe(false);
    expect(canScheduleCallback({ agentStatus: AGENT_STATUS.CONNECTING })).toBe(false);
    expect(canScheduleCallback({ agentStatus: AGENT_STATUS.ERROR })).toBe(false);
    expect(canScheduleCallback()).toBe(false);
  });
});
