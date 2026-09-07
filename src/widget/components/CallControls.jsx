import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import { useDispatch, useSelector } from 'react-redux';
import micOnIcon from '@momentum-ui/icons/svg/microphone_16.svg';
import micMutedIcon from '@momentum-ui/icons/svg/microphone-muted_16.svg';
import holdIcon from '@momentum-ui/icons/svg/pause_16.svg';
import transferIcon from '@momentum-ui/icons/svg/call-forward_16.svg';
import endCallIcon from '@momentum-ui/icons/svg/cancel_16.svg';
import { taskAction } from '../store/callSlice.js';
import { AGENT_STATUS, TASK_ACTION } from '../../shared/constants.js';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import MomentumIcon from '../ui/MomentumIcon.jsx';
import TransferPanel from './TransferPanel.jsx';

export default function CallControls() {
  const dispatch = useDispatch();
  const { agentStatus, activeTask, wrapupCodes, held, recordingPaused, consultState, conferenceActive } = useSelector(
    (s) => s.call
  );
  const [muted, setMuted] = useState(false);
  const [wrapupCodeId, setWrapupCodeId] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  // This component stays mounted across the whole session (calls come and
  // go, it never unmounts), so without this the previous call's wrap-up pick
  // would still be selected the next time — letting the agent submit without
  // ever looking at it. Reset whenever the task identity changes, i.e. a new
  // call, not just a re-render.
  const taskId = activeTask?.taskId;
  useEffect(() => {
    setWrapupCodeId('');
  }, [taskId]);

  if (!activeTask) return null;
  const isRinging = agentStatus !== AGENT_STATUS.ON_CALL && agentStatus !== AGENT_STATUS.WRAP_UP;

  if (isRinging) {
    return (
      <div className="ccc-panel__section ccc-incoming">
        <p className="ccc-incoming__caller">Incoming call{activeTask.ani ? ` from ${activeTask.ani}` : ''}</p>
        <div className="ccc-incoming__actions">
          <Button color="green" size={28} onClick={() => dispatch(taskAction(taskId, TASK_ACTION.ACCEPT))}>
            Answer
          </Button>
          <Button color="red" size={28} ghost onClick={() => dispatch(taskAction(taskId, TASK_ACTION.DECLINE))}>
            Decline
          </Button>
        </div>
      </div>
    );
  }

  if (agentStatus === AGENT_STATUS.WRAP_UP) {
    const selected = (wrapupCodes || []).find((c) => c.id === wrapupCodeId);
    const hasCodes = (wrapupCodes || []).length > 0;
    return (
      <div className="ccc-panel__section ccc-wrapup">
        <p className="ccc-muted">Call ended — wrap-up required.</p>
        {hasCodes ? (
          <SearchableSelect
            value={wrapupCodeId}
            onChange={(id) => setWrapupCodeId(id || '')}
            options={(wrapupCodes || [])
              .slice()
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map((c) => ({ id: c.id, name: c.name }))}
            placeholder="Select wrap-up reason…"
            ariaLabel="Wrap-up reason"
          />
        ) : (
          // Without a code the API cannot be called at all, so say so rather
          // than leaving a disabled button the agent cannot get past.
          <p className="ccc-muted ccc-call-controls__status">
            No wrap-up codes are configured for this agent profile — the call must be wrapped up
            from Webex CC Desktop.
          </p>
        )}
        <Button
          color="blue"
          size={28}
          disabled={!wrapupCodeId}
          onClick={() =>
            dispatch(taskAction(taskId, TASK_ACTION.WRAPUP, { auxCodeId: wrapupCodeId, wrapUpReason: selected?.name }))
          }
        >
          Submit wrap-up
        </Button>
      </div>
    );
  }

  return (
    <div className="ccc-panel__section ccc-call-controls">
      <p className="ccc-call-controls__caller">{activeTask.ani || 'Active call'}</p>
      {/* Hold is deliberately absent — the Hold button's own colour already
          shows it, and an extra line here grows the panel mid-call. */}
      {(recordingPaused || consultState || conferenceActive) && (
        <p className="ccc-muted ccc-call-controls__status">
          {[
            consultState === 'offered' && 'Consult requested by another agent',
            consultState === 'requested' && 'Consult ringing',
            consultState === 'consulting' && 'Consulting',
            conferenceActive && 'In conference',
            recordingPaused && 'Recording paused',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {showTransfer ? (
        <TransferPanel taskId={taskId} onClose={() => setShowTransfer(false)} />
      ) : (
        <div className="ccc-call-controls__actions">
          <Button
            circle
            size={28}
            color={held ? 'orange' : 'dark-gray'}
            ariaLabel={held ? 'Resume call' : 'Hold call'}
            ariaPressed={held}
            title={held ? 'Resume' : 'Hold'}
            onClick={() => dispatch(taskAction(taskId, held ? TASK_ACTION.RESUME : TASK_ACTION.HOLD))}
          >
            <MomentumIcon src={holdIcon} />
          </Button>
          <Button
            circle
            size={28}
            color={muted ? 'red' : 'green'}
            ariaLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
            ariaPressed={muted}
            title={muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              dispatch(taskAction(taskId, muted ? TASK_ACTION.UNMUTE : TASK_ACTION.MUTE));
              setMuted(!muted);
            }}
          >
            <MomentumIcon src={muted ? micMutedIcon : micOnIcon} />
          </Button>
          <Button
            circle
            size={28}
            color="blue"
            ariaLabel="Transfer call"
            title="Transfer"
            onClick={() => setShowTransfer(true)}
          >
            <MomentumIcon src={transferIcon} />
          </Button>
          <Button
            circle
            size={28}
            color="red"
            ariaLabel="End call"
            title="End call"
            onClick={() => dispatch(taskAction(taskId, TASK_ACTION.END))}
          >
            <MomentumIcon src={endCallIcon} />
          </Button>
        </div>
      )}
    </div>
  );
}
