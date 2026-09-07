import { AGENT_STATUS } from '../../shared/constants.js';

/**
 * Whether the agent can start an outbound call right now.
 *
 * AGENT_STATUS.AVAILABLE means "station logged in" — the ON_CALL and WRAP_UP
 * states are separate, so this single check already excludes an engaged agent
 * as well as one who is only registered, connecting or signed out.
 * `loginOption` is the device the station login bound to (BROWSER / EXTENSION /
 * AGENT_DN); without it there is nothing to place the call on.
 * `activeTask` catches the reserved case: a task is offered but not answered.
 */
export function canPlaceCall({ agentStatus, loginOption, activeTask } = {}) {
  return agentStatus === AGENT_STATUS.AVAILABLE && !!loginOption && !activeTask;
}

/** True while the agent is on a call (as opposed to merely unable to dial). */
export function isOnCall({ agentStatus } = {}) {
  return agentStatus === AGENT_STATUS.ON_CALL;
}

/**
 * Whether a callback can be scheduled — unlike dialling this needs no device
 * and no free agent, only a live SDK session to reach the callback API with.
 */
export function canScheduleCallback({ agentStatus } = {}) {
  return (
    agentStatus !== AGENT_STATUS.LOGGED_OUT &&
    agentStatus !== AGENT_STATUS.CONNECTING &&
    agentStatus !== AGENT_STATUS.ERROR &&
    !!agentStatus
  );
}
