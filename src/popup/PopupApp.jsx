import React, { useEffect, useState } from 'react';
import { sendCommand, onEvent } from '../shared/messaging.js';
import { CMD, EVT, SOURCE, AGENT_STATUS } from '../shared/constants.js';

export default function PopupApp() {
  const [state, setState] = useState({ agentStatus: AGENT_STATUS.LOGGED_OUT });

  useEffect(() => {
    sendCommand(SOURCE.POPUP, CMD.GET_STATE).then(setState).catch(() => {});
    return onEvent((msg) => {
      if (msg.type === EVT.STATE_CHANGED) setState((s) => ({ ...s, ...msg.payload }));
    });
  }, []);

  const loggedIn = state.agentStatus !== AGENT_STATUS.LOGGED_OUT;

  return (
    <div style={{ padding: 16, fontSize: 13, color: 'var(--text)' }}>
      <strong>Webex CC Client</strong>
      <p style={{ color: 'var(--text2)' }}>Status: {state.agentStatus}</p>
      {!loggedIn && (
        <button onClick={() => sendCommand(SOURCE.POPUP, CMD.START_LOGIN)}>Sign in with Webex</button>
      )}
      {loggedIn && <button onClick={() => sendCommand(SOURCE.POPUP, CMD.LOGOUT)}>Sign out</button>}
      <div style={{ marginTop: 10 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); }}>
          Open settings
        </a>
      </div>
    </div>
  );
}
