import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAudioDevices, uploadLogs, logout, stationLogout, updateAgentProfile, clearError } from '../store/callSlice.js';
import { getSettings, setSettings } from '../../shared/storage.js';
import { AGENT_STATUS, COLOR_MODE } from '../../shared/constants.js';
import { SUPPORTED_LOCALES, NATIVE_NAMES, AUTO_LOCALE } from '../../shared/i18n/locales.js';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import TimePicker from '../ui/TimePicker.jsx';
import useT from '../i18n/useT.js';

const SYSTEM_DEFAULT = '__default__';

// Chrome's 'default'/'communications' entries are pseudo-devices that mirror
// the OS choice — that is what the explicit "System default" option means, so
// listing them again would just be a confusing duplicate.
function selectable(devices) {
  return (devices || [])
    .filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications')
    .map((d) => ({ id: d.deviceId, name: d.label }));
}

function systemDefaultName(t, devices, kindWord) {
  const label = (devices || []).find((d) => d.deviceId === 'default')?.label;
  const trimmed = label?.replace(/^Default\s*-\s*/i, '');
  return trimmed
    ? t('settingsPanel.systemDefaultWithLabel', { label: trimmed })
    : t('settingsPanel.systemDefaultKind', { kind: kindWord });
}

export default function SettingsPanel({ onClose }) {
  const t = useT();
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

  const COLOR_MODE_OPTIONS = [
    { id: COLOR_MODE.SYSTEM, label: t('settingsPanel.colorSystemLabel'), title: t('settingsPanel.colorSystemTitle') },
    { id: COLOR_MODE.PAGE, label: t('settingsPanel.colorPageLabel'), title: t('settingsPanel.colorPageTitle') },
    { id: COLOR_MODE.DEFAULT, label: t('settingsPanel.colorDefaultLabel'), title: t('settingsPanel.colorDefaultTitle') },
  ];

  const languageOptions = [
    { id: AUTO_LOCALE, name: t('settingsPanel.languageAuto') },
    ...SUPPORTED_LOCALES.map((code) => ({ id: code, name: NATIVE_NAMES[code] || code })),
  ];

  // @webex/contact-center ships two conflicting Team shapes ({teamId,teamName}
  // vs {id,name}) — read both so a real payload never renders blank.
  const teamOptions = (teams || [])
    .map((tm) => ({ id: tm.teamId ?? tm.id, name: tm.teamName ?? tm.name ?? tm.teamId ?? tm.id }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="ccc-panel__section ccc-settings">
      <div className="ccc-settings__row">
        <span className="ccc-settings__title">{t('settingsPanel.title')}</span>
        <Button size={28} ghost onClick={onClose}>
          {t('common.back')}
        </Button>
      </div>

      {error && (
        <div className="ccc-settings__error">
          <p className="ccc-settings__hint">{error}</p>
          <Button size={28} ghost onClick={() => dispatch(clearError())}>
            {t('settingsPanel.dismiss')}
          </Button>
        </div>
      )}

      {loginOption && (
        <>
          <label className="ccc-settings__label">{t('common.team')}</label>
          <SearchableSelect
            value={teamId || ''}
            onChange={(id) => id && id !== teamId && dispatch(updateAgentProfile({ teamId: id }))}
            options={teamOptions}
            placeholder={t('common.selectTeam')}
            ariaLabel={t('common.team')}
            disabled={loading}
          />
          <p className="ccc-muted ccc-settings__hint">{t('settingsPanel.teamSwitchHint')}</p>
        </>
      )}

      <label className="ccc-settings__label">{t('settingsPanel.microphoneLabel')}</label>
      <SearchableSelect
        value={settings?.microphoneDeviceId || SYSTEM_DEFAULT}
        onChange={(id) => applySetting({ microphoneDeviceId: id === SYSTEM_DEFAULT ? '' : id || '' })}
        options={[
          { id: SYSTEM_DEFAULT, name: systemDefaultName(t, devices.inputs, t('settingsPanel.microphoneWord')) },
          ...selectable(devices.inputs),
        ]}
        ariaLabel={t('settingsPanel.microphoneLabel')}
      />

      <label className="ccc-settings__label">{t('settingsPanel.speakerLabel')}</label>
      <SearchableSelect
        value={settings?.speakerDeviceId || SYSTEM_DEFAULT}
        onChange={(id) => applySetting({ speakerDeviceId: id === SYSTEM_DEFAULT ? '' : id || '' })}
        options={[
          { id: SYSTEM_DEFAULT, name: systemDefaultName(t, devices.outputs, t('settingsPanel.speakerWord')) },
          ...selectable(devices.outputs),
        ]}
        ariaLabel={t('settingsPanel.speakerLabel')}
      />
      {devices.inputs.length === 0 && <p className="ccc-muted ccc-settings__hint">{t('settingsPanel.noAudioDevices')}</p>}
      <p className="ccc-muted ccc-settings__hint">{t('settingsPanel.audioHint')}</p>

      <label className="ccc-settings__label">{t('settingsPanel.coloursLabel')}</label>
      <div className="ccc-seg" role="group" aria-label={t('settingsPanel.coloursLabel')}>
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

      <label className="ccc-settings__label">{t('settingsPanel.languageLabel')}</label>
      <SearchableSelect
        value={settings?.language || AUTO_LOCALE}
        onChange={(id) => applySetting({ language: id || AUTO_LOCALE })}
        options={languageOptions}
        ariaLabel={t('settingsPanel.languageLabel')}
      />

      <label className="ccc-settings__label">{t('settingsPanel.workingHoursLabel')}</label>
      <div className="ccc-settings__time-range">
        <TimePicker
          value={settings?.workingHoursStart || '08:00'}
          onChange={(val) => val && applySetting({ workingHoursStart: val })}
          ariaLabel={t('settingsPanel.workingHoursStart')}
        />
        <span className="ccc-timepicker__sep">–</span>
        <TimePicker
          value={settings?.workingHoursEnd || '17:00'}
          onChange={(val) => val && applySetting({ workingHoursEnd: val })}
          ariaLabel={t('settingsPanel.workingHoursEnd')}
        />
      </div>

      <div className="ccc-settings__divider" />

      <p className="ccc-muted ccc-settings__hint">
        {t('settingsPanel.signedInAs', { name: agent?.name || agent?.agentId || t('settingsPanel.unknownAgent') })}
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
        {logStatus === 'uploading' ? <Spinner size={14} /> : t('settingsPanel.sendLogs')}
      </Button>
      {logStatus?.startsWith('id:') && (
        <p className="ccc-muted ccc-settings__hint">{t('settingsPanel.logReference', { id: logStatus.slice(3) })}</p>
      )}
      {logStatus === 'failed' && <p className="ccc-muted ccc-settings__hint">{t('settingsPanel.logFailed')}</p>}

      <div className="ccc-settings__actions">
        {agentStatus === AGENT_STATUS.AVAILABLE && (
          <Button size={28} disabled={loading} onClick={() => dispatch(stationLogout())}>
            {t('settingsPanel.stationLogout')}
          </Button>
        )}
        <Button color="red" size={28} disabled={loading} onClick={() => dispatch(logout())}>
          {t('settingsPanel.signOut')}
        </Button>
      </div>
    </div>
  );
}
