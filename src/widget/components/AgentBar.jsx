import React, { useMemo, useState } from 'react';
import readyIcon from '@momentum-ui/icons/svg/check-circle_16.svg';
import idleIcon from '@momentum-ui/icons/svg/pause-circle_16.svg';
import reservedIcon from '@momentum-ui/icons/svg/alert_16.svg';
import engagedIcon from '@momentum-ui/icons/svg/handset-active_16.svg';
import wrapUpIcon from '@momentum-ui/icons/svg/edit_16.svg';
import noStationIcon from '@momentum-ui/icons/svg/minus_16.svg';
import Button from '../ui/Button.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { stationLogin, setAgentState } from '../store/callSlice.js';
import { AGENT_STATUS } from '../../shared/constants.js';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Spinner from '../ui/Spinner.jsx';
import useT from '../i18n/useT.js';

function sortedByName(list) {
  return (list || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/*
 * The badge previously coloured itself off agentStatus alone, but AVAILABLE
 * only means "station logged in" — ready and not-ready both landed on the same
 * green. Every state now gets its own colour AND icon, so the two are never
 * distinguishable by colour alone (which also keeps it usable for colour-blind
 * agents and at a glance from across a desk).
 */
function describeStatus(t, { agentStatus, subStatus, activeTask, idleCodeName }) {
  if (agentStatus === AGENT_STATUS.WRAP_UP) {
    return { label: t('status.wrapUp'), color: 'orange', icon: wrapUpIcon };
  }
  if (agentStatus === AGENT_STATUS.ON_CALL) {
    return { label: t('status.onCall'), color: 'red', icon: engagedIcon };
  }
  // A task exists but the call has not been answered yet.
  if (activeTask) {
    return { label: t('status.reserved'), color: 'blue', icon: reservedIcon };
  }
  if (agentStatus === AGENT_STATUS.REGISTERED) {
    return { label: t('status.noStation'), color: 'gray', icon: noStationIcon };
  }
  if (subStatus === 'Idle') {
    return { label: idleCodeName || t('status.notReady'), color: 'yellow', icon: idleIcon };
  }
  return { label: t('status.available'), color: 'green', icon: readyIcon };
}

export default function AgentBar() {
  const t = useT();
  const AVAILABLE_OPTION = { id: 'available', name: t('status.available') };
  const dispatch = useDispatch();
  const { agentStatus, agent, teams, loginVoiceOptions, idleCodes, subStatus, auxCodeId, activeTask, loading } =
    useSelector((s) => s.call);
  const [teamId, setTeamId] = useState('');
  const [loginOption, setLoginOption] = useState('');
  const [dialNumber, setDialNumber] = useState('');
  const [pendingAux, setPendingAux] = useState('available');

  const isLoggedIntoStation = [AGENT_STATUS.AVAILABLE, AGENT_STATUS.ON_CALL, AGENT_STATUS.WRAP_UP].includes(agentStatus);
  // loginOption is one of the SDK's literal LoginOption values: 'AGENT_DN' |
  // 'EXTENSION' | 'BROWSER'. Only the first two need a dial-in number.
  const needsDialNumber = useMemo(() => loginOption === 'AGENT_DN' || loginOption === 'EXTENSION', [loginOption]);

  const currentIdleCodeName = (idleCodes || []).find((c) => c.id === auxCodeId)?.name;
  const status = describeStatus(t, { agentStatus, subStatus, activeTask, idleCodeName: currentIdleCodeName });

  return (
    <div className="ccc-panel__section ccc-agent-bar">
      <div className="ccc-agent-bar__row">
        <span className="ccc-agent-bar__name">{agent?.name || agent?.agentName || t('agentBar.agentFallback')}</span>
        <StatusBadge color={status.color} icon={status.icon}>
          {status.label}
        </StatusBadge>
      </div>

      {isLoggedIntoStation && agentStatus === AGENT_STATUS.AVAILABLE && (
        <div className="ccc-agent-bar__availability">
          <SearchableSelect
            value={pendingAux}
            onChange={(id) => setPendingAux(id || 'available')}
            options={[AVAILABLE_OPTION, ...sortedByName(idleCodes)]}
            ariaLabel={t('agentBar.availabilityLabel')}
          />
          <Button
            size={28}
            disabled={loading}
            onClick={() =>
              dispatch(
                setAgentState(
                  pendingAux === 'available' ? { state: 'Available', auxCodeId: '0' } : { state: 'Idle', auxCodeId: pendingAux }
                )
              )
            }
          >
            {t('agentBar.setButton')}
          </Button>
        </div>
      )}

      {!isLoggedIntoStation && (
        <div className="ccc-agent-bar__login">
          {/* @webex/contact-center ships TWO conflicting Team type declarations
              ({teamId,teamName} in Profile vs {id,name} elsewhere) — read both
              so a real runtime shape never renders as a blank option. */}
          <SearchableSelect
            value={teamId}
            onChange={(id) => setTeamId(id || '')}
            options={sortedByName(
              (teams || []).map((t2) => ({ id: t2.teamId ?? t2.id, name: t2.teamName ?? t2.name ?? t2.teamId ?? t2.id }))
            )}
            placeholder={t('common.selectTeam')}
            ariaLabel={t('common.team')}
          />
          <SearchableSelect
            value={loginOption}
            onChange={(id) => setLoginOption(id || '')}
            options={(loginVoiceOptions || [])
              .slice()
              .sort((a, b) => a.localeCompare(b))
              .map((opt) => ({ id: opt, name: opt }))}
            placeholder={t('agentBar.selectVoiceOption')}
            ariaLabel={t('agentBar.voiceOptionLabel')}
          />
          {needsDialNumber && (
            <input
              className="ccc-input"
              placeholder={t('agentBar.dialInNumber')}
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
            />
          )}
          <Button
            color="blue"
            size={28}
            disabled={loading || !teamId || !loginOption}
            onClick={() => dispatch(stationLogin({ teamId, loginOption, dialNumber }))}
          >
            {loading ? <Spinner size={14} /> : t('agentBar.stationLogin')}
          </Button>
        </div>
      )}
    </div>
  );
}
