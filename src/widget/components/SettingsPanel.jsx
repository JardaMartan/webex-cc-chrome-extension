import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAudioDevices, uploadLogs, logout, stationLogout, updateAgentProfile, clearError } from '../store/callSlice.js';
import { getSettings, setSettings } from '../../shared/storage.js';
import { AGENT_STATUS, COLOR_MODE } from '../../shared/constants.js';
import SearchableSelect from '../ui/SearchableSelect.jsx';

const SYSTEM_DEFAULT = '__default__';

const COLOR_MODE_OPTIONS = [
  { id: COLOR_MODE.SYSTEM, label: 'System', title: 'Follow the operating system light/dark setting' },
  { id: COLOR_MODE.PAGE, label: 'Page', title: 'Sample this page’s colours and blend in' },
  { id: COLOR_MODE.DEFAULT, label: 'Default', title: 'Always use the default light colours' },
];

// Chrome's 'default'/'communications' entries are pseudo-devices that mirror
// the OS choice — that is what the explicit "System default" option means, so
// listing them again would just be a confusing duplicate.
function selectable(devices) {
  return (devices || [])
    .filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications')
    .map((d) => ({ id: d.deviceId, name: d.label }));
}

function systemDefaultName(devices, kind) {
  const label = (devices || []).find((d) => d.deviceId === 'default')?.label;
  const trimmed = label?.replace(/^Default\s*-\s*/i, '');
  return trimmed ? `System default (${trimmed})` : `System default ${kind}`;
}

export default function SettingsPanel({ onClose }) {
  const dispatch = useDispatch();
  const { agent, dn, subStatus, teams, teamId, loginOption, loading, agentStatus, error } = useSelector((s) => s.call);
  const [devices, setDevices] = useState({ inputs: [], outputs: [] });
  const [settings, setLocalSettings] = useState(null);
  const [logStatus, setLogStatus] = useState(null); // null | 'uploading' | 'id:<feedbackId>' | 'failed'

  useEffect(() => {
    getSettings().then(setLocalSettings);
    dispatch(fetchAudioDevices()).then(setDevices);
  }, [dispatch]);

  const applySetting = async (patch) => {
    const next = await setSettings(patch);
    setLocalSettings(next);
  };

  // @webex/contact-center ships two conflicting Team shapes ({teamId,teamName}
  // vs {id,name}) — read both so a real payload never renders blank.
  const teamOptions = (teams || [])
    .map((t) => ({ id: t.teamId ?? t.id, name: t.teamName ?? t.name ?? t.teamId ?? t.id }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="ccc-panel__section ccc-settings">
      <div className="ccc-settings__row">
        <span className="ccc-settings__title">Settings</span>
        <Button size={28} ghost onClick={onClose}>
          Back
        </Button>
      </div>

      {error && (
        <div className="ccc-settings__error">
          <p className="ccc-settings__hint">{error}</p>
          <Button size={28} ghost onClick={() => dispatch(clearError())}>
            Dismiss
          </Button>
        </div>
      )}

      {loginOption && (
        <>
          <label className="ccc-settings__label">Team</label>
          <SearchableSelect
            value={teamId || ''}
            onChange={(id) => id && id !== teamId && dispatch(updateAgentProfile({ teamId: id }))}
            options={teamOptions}
            placeholder="Select team…"
            ariaLabel="Team"
            disabled={loading}
          />
          <p className="ccc-muted ccc-settings__hint">
            Switches team immediately, without signing out of your station.
          </p>
        </>
      )}

      <label className="ccc-settings__label">Microphone</label>
      <SearchableSelect
        value={settings?.microphoneDeviceId || SYSTEM_DEFAULT}
        onChange={(id) => applySetting({ microphoneDeviceId: id === SYSTEM_DEFAULT ? '' : id || '' })}
        options={[{ id: SYSTEM_DEFAULT, name: systemDefaultName(devices.inputs, 'microphone') }, ...selectable(devices.inputs)]}
        ariaLabel="Microphone"
      />

      <label className="ccc-settings__label">Speaker</label>
      <SearchableSelect
        value={settings?.speakerDeviceId || SYSTEM_DEFAULT}
        onChange={(id) => applySetting({ speakerDeviceId: id === SYSTEM_DEFAULT ? '' : id || '' })}
        options={[{ id: SYSTEM_DEFAULT, name: systemDefaultName(devices.outputs, 'speaker') }, ...selectable(devices.outputs)]}
        ariaLabel="Speaker"
      />
      {devices.inputs.length === 0 && (
        <p className="ccc-muted ccc-settings__hint">
          No audio devices listed — grant microphone access from the extension options page.
        </p>
      )}
      <p className="ccc-muted ccc-settings__hint">
        The microphone applies to the next call; the speaker takes effect immediately.
      </p>

      <label className="ccc-settings__label">Colours</label>
      <div className="ccc-seg" role="group" aria-label="Colour mode">
        {COLOR_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            title={opt.title}
            aria-pressed={(settings?.colorMode || COLOR_MODE.SYSTEM) === opt.id}
            className={`ccc-seg__btn${(settings?.colorMode || COLOR_MODE.SYSTEM) === opt.id ? ' is-active' : ''}`}
            onClick={() => applySetting({ colorMode: opt.id })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="ccc-settings__divider" />

      <p className="ccc-muted ccc-settings__hint">
        Signed in as {agent?.name || agent?.agentId || 'unknown agent'}
        {dn ? ` · ${dn}` : ''}
        {subStatus ? ` · ${subStatus}` : ''}
      </p>

      <Button
        size={28}
        disabled={logStatus === 'uploading'}
        onClick={() => {
          setLogStatus('uploading');
          dispatch(uploadLogs()).then((id) => setLogStatus(id ? `id:${id}` : 'failed'));
        }}
      >
        {logStatus === 'uploading' ? <Spinner size={14} /> : 'Send diagnostic logs to Webex'}
      </Button>
      {logStatus?.startsWith('id:') && (
        <p className="ccc-muted ccc-settings__hint">Reference for Cisco support: {logStatus.slice(3)}</p>
      )}
      {logStatus === 'failed' && <p className="ccc-muted ccc-settings__hint">Log upload failed.</p>}

      <div className="ccc-settings__actions">
        {agentStatus === AGENT_STATUS.AVAILABLE && (
          <Button size={28} disabled={loading} onClick={() => dispatch(stationLogout())}>
            Station logout
          </Button>
        )}
        <Button color="red" size={28} disabled={loading} onClick={() => dispatch(logout())}>
          Sign out of Webex
        </Button>
      </div>
    </div>
  );
}
