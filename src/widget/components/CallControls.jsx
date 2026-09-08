import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import { useDispatch, useSelector } from 'react-redux';
import micOnIcon from '@momentum-ui/icons/svg/microphone_16.svg';
import micMutedIcon from '@momentum-ui/icons/svg/microphone-muted_16.svg';
import holdIcon from '@momentum-ui/icons/svg/pause_16.svg';
import transferIcon from '@momentum-ui/icons/svg/call-forward_16.svg';
import endCallIcon from '@momentum-ui/icons/svg/cancel_16.svg';
import calendarAddIcon from '@momentum-ui/icons/svg/calendar-add_16.svg';
import { taskAction, startCallbackDraft } from '../store/callSlice.js';
import { AGENT_STATUS, TASK_ACTION } from '../../shared/constants.js';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import MomentumIcon from '../ui/MomentumIcon.jsx';
import TransferPanel from './TransferPanel.jsx';
import { guessCustomerName } from '../callback/callbackRequest.js';
import useT from '../i18n/useT.js';

export default function CallControls() {
  const t = useT();
  const dispatch = useDispatch();
  const { agentStatus, activeTask, wrapupCodes, held, recordingPaused, consultState, conferenceActive } = useSelector(
    (s) => s.call
  );
  const [muted, setMuted] = useState(false);
  const [wrapupCodeId, setWrapupCodeId] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  // This component stays mounted across the whole session (calls come and
  // go, it never unmounts), so without this the previous call's wrap-up pick
  // — and mute state — would still apply to the next one. Reset whenever the
  // task identity changes, i.e. a new call, not just a re-render.
  const taskId = activeTask?.taskId;
  useEffect(() => {
    setWrapupCodeId('');
    setMuted(false);
  }, [taskId]);

  if (!activeTask) return null;
  const isRinging = agentStatus !== AGENT_STATUS.ON_CALL && agentStatus !== AGENT_STATUS.WRAP_UP;

  if (isRinging) {
    return (
      <div className="ccc-panel__section ccc-incoming">
        <p className="ccc-incoming__caller">
          {activeTask.ani ? t('callControls.incomingCallFrom', { ani: activeTask.ani }) : t('callControls.incomingCall')}
        </p>
        <div className="ccc-incoming__actions">
          <Button color="green" size={28} onClick={() => dispatch(taskAction(taskId, TASK_ACTION.ACCEPT))}>
            {t('callControls.answer')}
          </Button>
          <Button color="red" size={28} ghost onClick={() => dispatch(taskAction(taskId, TASK_ACTION.DECLINE))}>
            {t('callControls.decline')}
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
        <p className="ccc-muted">{t('callControls.wrapUpRequired')}</p>
        {hasCodes ? (
          <SearchableSelect
            value={wrapupCodeId}
            onChange={(id) => setWrapupCodeId(id || '')}
            options={(wrapupCodes || [])
              .slice()
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map((c) => ({ id: c.id, name: c.name }))}
            placeholder={t('callControls.selectWrapUpReason')}
            ariaLabel={t('callControls.wrapUpReasonLabel')}
          />
        ) : (
          // Without a code the API cannot be called at all, so say so rather
          // than leaving a disabled button the agent cannot get past.
          <p className="ccc-muted ccc-call-controls__status">{t('callControls.noWrapUpCodes')}</p>
        )}
        <Button
          color="blue"
          size={28}
          disabled={!wrapupCodeId}
          onClick={() =>
            dispatch(taskAction(taskId, TASK_ACTION.WRAPUP, { auxCodeId: wrapupCodeId, wrapUpReason: selected?.name }))
          }
        >
          {t('callControls.submitWrapUp')}
        </Button>
      </div>
    );
  }

  return (
    <div className="ccc-panel__section ccc-call-controls">
      <p className="ccc-call-controls__caller">{activeTask.ani || t('callControls.activeCallFallback')}</p>
      {/* Hold is deliberately absent — the Hold button's own colour already
          shows it, and an extra line here grows the panel mid-call. */}
      {(recordingPaused || consultState || conferenceActive) && (
        <p className="ccc-muted ccc-call-controls__status">
          {[
            consultState === 'offered' && t('callControls.consultOffered'),
            consultState === 'requested' && t('callControls.consultRequested'),
            consultState === 'consulting' && t('callControls.consulting'),
            conferenceActive && t('callControls.inConference'),
            recordingPaused && t('callControls.recordingPaused'),
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
            ariaLabel={held ? t('callControls.resumeCallAria') : t('callControls.holdCallAria')}
            ariaPressed={held}
            title={held ? t('callControls.resumeTitle') : t('callControls.holdTitle')}
            onClick={() => dispatch(taskAction(taskId, held ? TASK_ACTION.RESUME : TASK_ACTION.HOLD))}
          >
            <MomentumIcon src={holdIcon} />
          </Button>
          <Button
            circle
            size={28}
            color={muted ? 'red' : 'green'}
            ariaLabel={muted ? t('callControls.unmuteAria') : t('callControls.muteAria')}
            ariaPressed={muted}
            title={muted ? t('callControls.unmuteTitle') : t('callControls.muteTitle')}
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
            ariaLabel={t('callControls.transferAria')}
            title={t('callControls.transferTitle')}
            onClick={() => setShowTransfer(true)}
          >
            <MomentumIcon src={transferIcon} />
          </Button>
          <Button
            circle
            size={28}
            color="blue"
            ariaLabel={t('callback.scheduleTitle')}
            title={t('callback.scheduleTitle')}
            onClick={() =>
              dispatch(
                startCallbackDraft({ callbackNumber: activeTask.ani || '', customerName: guessCustomerName(activeTask.cad) })
              )
            }
          >
            <MomentumIcon src={calendarAddIcon} />
          </Button>
          <Button
            circle
            size={28}
            color="red"
            ariaLabel={t('callControls.endCallAria')}
            title={t('callControls.endCallAria')}
            onClick={() => dispatch(taskAction(taskId, TASK_ACTION.END))}
          >
            <MomentumIcon src={endCallIcon} />
          </Button>
        </div>
      )}
    </div>
  );
}
