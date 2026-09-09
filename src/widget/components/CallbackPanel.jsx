import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import warningIcon from '@momentum-ui/icons/svg/warning_16.svg';
import {
  clearCallbackDraft,
  deleteCallback,
  fetchScheduledCallbacks,
  fetchTransferQueues,
  rescheduleCallback,
  scheduleCallback,
} from '../store/callSlice.js';
import {
  buildCallbackRequest,
  localTimezone,
  windowMinutesBetween,
  MAX_DAYS_AHEAD,
} from '../callback/callbackRequest.js';
import { findCallbackConflict } from '../callback/timeOptions.js';
import { getSettings, onSettingsChanged } from '../../shared/storage.js';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import DatePicker from '../ui/DatePicker.jsx';
import TimePicker from '../ui/TimePicker.jsx';
import MomentumIcon from '../ui/MomentumIcon.jsx';
import useT from '../i18n/useT.js';

const ASSIGN_TO_QUEUE = 'queue';
const ASSIGN_TO_ME = 'agent';
// An existing callback may belong to a different agent; re-saving must not
// silently steal it, so that assignment is kept until the agent picks another.
const ASSIGN_TO_OTHER = 'other';

function formatWhen(cb) {
  return `${cb.scheduleDate || ''} ${(cb.startTime || '').slice(0, 5)}`.trim();
}

// The API stores the assignment as an agent id (or nothing, meaning queue).
function assignmentOf(callback, myAgentId) {
  if (!callback?.assigneeAgent) return ASSIGN_TO_QUEUE;
  return callback.assigneeAgent === myAgentId ? ASSIGN_TO_ME : ASSIGN_TO_OTHER;
}

export default function CallbackPanel() {
  const t = useT();
  const WINDOW_OPTIONS = [
    { id: '30', name: t('callback.window30') },
    { id: '60', name: t('callback.window1h') },
    { id: '120', name: t('callback.window2h') },
    { id: '240', name: t('callback.window4h') },
    { id: '480', name: t('callback.window8h') },
  ];
  const dispatch = useDispatch();
  const { callbackDraft, activeTask, agent } = useSelector((s) => s.call);
  const myAgentId = agent?.agentId;
  const [queues, setQueues] = useState([]);
  const [scheduled, setScheduled] = useState(null); // null = still loading
  // The existing callback for this number, if any — a number may hold only one.
  const [existing, setExisting] = useState(null);
  const [checking, setChecking] = useState(false);
  const [settings, setSettingsState] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [form, setForm] = useState({
    customerName: callbackDraft?.customerName || '',
    callbackNumber: callbackDraft?.callbackNumber || '',
    date: '',
    time: '',
    windowMinutes: '30',
    queueId: '',
    callbackReason: '',
    assignTo: ASSIGN_TO_QUEUE,
  });
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved' | 'deleting' | 'deleted' | 'error:<message>'

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const refreshScheduled = () => dispatch(fetchScheduledCallbacks()).then((list) => setScheduled(list || []));

  // Shared by "blur the number field onto a match" and "Edit from the list
  // below" — both just populate the form from an already-fetched callback.
  const loadExisting = (match) => {
    setExisting(match);
    setStatus(null);
    setForm((f) => ({
      ...f,
      callbackNumber: match.callbackNumber || f.callbackNumber,
      customerName: match.customerName || f.customerName,
      date: match.scheduleDate || f.date,
      time: (match.startTime || '').slice(0, 5) || f.time,
      windowMinutes: String(windowMinutesBetween(match.startTime, match.endTime)),
      queueId: match.queueId || f.queueId,
      callbackReason: match.callbackReason || f.callbackReason,
      assignTo: assignmentOf(match, myAgentId),
    }));
  };

  // The API allows one callback per number, so an existing one is loaded and
  // re-scheduled instead of failing as a duplicate. Matching is exact, which
  // is why this runs against the number exactly as typed.
  const checkExisting = (number) => {
    const callbackNumber = (number || '').trim();
    if (!callbackNumber) {
      setExisting(null);
      return;
    }
    setChecking(true);
    dispatch(fetchScheduledCallbacks({ callbackNumber }))
      .then((list) => {
        const match = (list || [])[0] || null;
        if (match) loadExisting(match);
        else {
          setExisting(null);
          setStatus(null);
        }
      })
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    getSettings().then(setSettingsState);
    return onSettingsChanged(setSettingsState);
  }, []);

  useEffect(() => {
    dispatch(fetchTransferQueues()).then((list) => setQueues(list || []));
    refreshScheduled();
    checkExisting(callbackDraft?.callbackNumber);
  }, [dispatch]);

  // Conflict checking: check the callback scheduling API for conflicts
  // when scheduled to Me and date/time are selected. In scheduling to Queue,
  // conflict checking is skipped.
  useEffect(() => {
    if (form.assignTo !== ASSIGN_TO_ME || !form.date || !form.time) {
      setConflict(null);
      return;
    }

    let cancelled = false;
    setCheckingConflict(true);

    dispatch(fetchScheduledCallbacks())
      .then((list) => {
        if (cancelled) return;
        const callbacks = list || [];
        setScheduled(callbacks);
        const found = findCallbackConflict(
          { date: form.date, time: form.time, windowMinutes: form.windowMinutes },
          callbacks,
          { excludeId: existing?.id, myAgentId }
        );
        setConflict(found);
      })
      .catch(() => {
        if (!cancelled) setConflict(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingConflict(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, form.assignTo, form.date, form.time, form.windowMinutes, existing?.id, myAgentId]);

  // A queue is mandatory even for a personal callback, so one is kept selected
  // behind the scenes while the picker is hidden.
  const queueName = queues.find((q) => q.id === form.queueId)?.name;
  useEffect(() => {
    if (!form.queueId && form.assignTo !== ASSIGN_TO_QUEUE && queues[0]) update({ queueId: queues[0].id });
  }, [form.assignTo, form.queueId, queues]);

  const assigneeFor = (assignTo) => {
    if (assignTo === ASSIGN_TO_ME) return myAgentId;
    if (assignTo === ASSIGN_TO_OTHER) return existing?.assigneeAgent;
    return undefined;
  };

  const submit = () => {
    let request;
    try {
      request = buildCallbackRequest({
        ...form,
        startsAt: form.date && form.time ? `${form.date}T${form.time}` : '',
        windowMinutes: Number(form.windowMinutes),
        timezone: localTimezone(),
        // Links the callback to the call it was requested during.
        sourceInteraction: activeTask?.taskId || undefined,
        assigneeAgent: assigneeFor(form.assignTo),
      });
    } catch (err) {
      setStatus(`error:${err.message}`);
      return;
    }
    setStatus('saving');
    const save = existing ? dispatch(rescheduleCallback(existing.id, request)) : dispatch(scheduleCallback(request));
    save
      .then((saved) => {
        setStatus('saved');
        if (saved?.id) setExisting(saved);
        refreshScheduled();
      })
      .catch((err) => setStatus(`error:${err.message}`));
  };

  const remove = (id) => {
    setStatus('deleting');
    dispatch(deleteCallback(id))
      .then(() => {
        setStatus('deleted');
        if (existing?.id === id) {
          setExisting(null);
          update({ date: '', time: '' });
        }
        refreshScheduled();
      })
      .catch((err) => setStatus(`error:${err.message}`));
  };

  const busy = status === 'saving' || status === 'deleting';

  return (
    <div className="ccc-panel__section ccc-settings">
      <div className="ccc-settings__row">
        <span className="ccc-settings__title">{existing ? t('callback.rescheduleTitle') : t('callback.scheduleTitle')}</span>
        <Button size={28} ghost onClick={() => dispatch(clearCallbackDraft())}>
          {t('common.back')}
        </Button>
      </div>

      <label className="ccc-settings__label">{t('callback.numberLabel')}</label>
      <input
        className="ccc-input"
        value={form.callbackNumber}
        onChange={(e) => update({ callbackNumber: e.target.value })}
        onBlur={(e) => checkExisting(e.target.value)}
      />
      {checking && <p className="ccc-muted ccc-settings__hint">{t('callback.checkingExisting')}</p>}
      {existing && (
        <div className="ccc-settings__row">
          <p className="ccc-muted ccc-settings__hint">
            {t('callback.alreadyScheduled', { when: formatWhen(existing) })}
          </p>
          <Button size={28} ghost color="red" disabled={busy} onClick={() => remove(existing.id)}>
            {t('common.delete')}
          </Button>
        </div>
      )}

      <label className="ccc-settings__label">{t('callback.customerNameLabel')}</label>
      <input
        className="ccc-input"
        value={form.customerName}
        maxLength={250}
        onChange={(e) => update({ customerName: e.target.value })}
      />

      <label className="ccc-settings__label">{t('callback.dateLabel')}</label>
      <DatePicker
        value={form.date}
        onChange={(date) => update({ date })}
        maxDaysAhead={MAX_DAYS_AHEAD}
        ariaLabel={t('callback.dateLabel')}
      />

      <label className="ccc-settings__label">{t('callback.startTimeLabel')}</label>
      <TimePicker
        date={form.date}
        value={form.time}
        onChange={(time) => update({ time })}
        workingHoursStart={settings?.workingHoursStart || '08:00'}
        workingHoursEnd={settings?.workingHoursEnd || '17:00'}
        ariaLabel={t('callback.startTimeLabel')}
      />

      <label className="ccc-settings__label">{t('callback.windowLabel')}</label>
      <SearchableSelect
        value={form.windowMinutes}
        onChange={(id) => update({ windowMinutes: id || '30' })}
        options={WINDOW_OPTIONS}
        ariaLabel={t('callback.windowLabel')}
      />

      <label className="ccc-settings__label">{t('callback.handledByLabel')}</label>
      <div className="ccc-seg" role="group" aria-label={t('callback.assignmentGroupLabel')}>
        <button
          type="button"
          className={`ccc-seg__btn${form.assignTo === ASSIGN_TO_QUEUE ? ' is-active' : ''}`}
          aria-pressed={form.assignTo === ASSIGN_TO_QUEUE}
          onClick={() => update({ assignTo: ASSIGN_TO_QUEUE })}
        >
          {t('common.queue')}
        </button>
        <button
          type="button"
          className={`ccc-seg__btn${form.assignTo === ASSIGN_TO_ME ? ' is-active' : ''}`}
          aria-pressed={form.assignTo === ASSIGN_TO_ME}
          onClick={() => update({ assignTo: ASSIGN_TO_ME })}
        >
          {t('callback.meOption')}
        </button>
      </div>
      {form.assignTo === ASSIGN_TO_OTHER && (
        <p className="ccc-muted ccc-settings__hint">{t('callback.assignedToOther')}</p>
      )}

      {form.assignTo === ASSIGN_TO_ME && checkingConflict && (
        <p className="ccc-muted ccc-settings__hint">{t('callback.checkingExisting')}</p>
      )}
      {form.assignTo === ASSIGN_TO_ME && conflict && (
        <div className="ccc-settings__conflict" role="alert">
          <MomentumIcon src={warningIcon} size={14} />
          <span>
            {conflict.customerName || conflict.callbackNumber
              ? t('callback.conflictWarningWithName', {
                  name: conflict.customerName || conflict.callbackNumber,
                  time: formatWhen(conflict),
                })
              : t('callback.conflictWarning', { time: formatWhen(conflict) })}
          </span>
        </div>
      )}

      {form.assignTo === ASSIGN_TO_QUEUE ? (
        <>
          <label className="ccc-settings__label">{t('common.queue')}</label>
          <SearchableSelect
            value={form.queueId}
            onChange={(id) => update({ queueId: id || '' })}
            options={queues}
            placeholder={t('common.selectQueue')}
            ariaLabel={t('common.queue')}
          />
        </>
      ) : (
        // The API demands a queue regardless, so the fallback is named rather
        // than sent invisibly.
        <p className="ccc-muted ccc-settings__hint">
          {t('callback.routesThrough', { queue: queueName || t('callback.firstAvailableQueue') })}
        </p>
      )}

      <label className="ccc-settings__label">{t('callback.reasonLabel')}</label>
      <input
        className="ccc-input"
        value={form.callbackReason}
        onChange={(e) => update({ callbackReason: e.target.value })}
      />

      <Button color="blue" size={28} disabled={busy} onClick={submit}>
        {status === 'saving' ? <Spinner size={14} /> : existing ? t('callback.rescheduleTitle') : t('callback.scheduleTitle')}
      </Button>
      {status === 'saved' && <p className="ccc-muted ccc-settings__hint">{t('callback.saved')}</p>}
      {status === 'deleted' && <p className="ccc-muted ccc-settings__hint">{t('callback.deleted')}</p>}
      {status?.startsWith('error:') && <p className="ccc-muted ccc-settings__hint">✗ {status.slice(6)}</p>}

      <div className="ccc-settings__divider" />

      {/* The list API needs an assignee or a number to filter on, so this can
          only show what is assigned to this agent. */}
      <label className="ccc-settings__label">{t('callback.assignedToYouLabel')}</label>
      {scheduled === null && <Spinner size={14} />}
      {scheduled?.length === 0 && <p className="ccc-muted ccc-settings__hint">{t('callback.noneScheduled')}</p>}
      {scheduled?.length > 0 && (
        <ul className="ccc-callbacks">
          {scheduled.map((cb) => (
            <li key={cb.id} className="ccc-callbacks__item">
              <span className="ccc-callbacks__when">{formatWhen(cb)}</span>
              <span className="ccc-callbacks__who">{cb.customerName || cb.callbackNumber}</span>
              <Button
                size={24}
                ghost
                disabled={busy}
                ariaLabel={t('callback.editAria', { who: cb.customerName || cb.callbackNumber })}
                onClick={() => loadExisting(cb)}
              >
                {t('common.edit')}
              </Button>
              <Button
                size={24}
                ghost
                color="red"
                disabled={busy}
                ariaLabel={t('callback.deleteAria', { who: cb.customerName || cb.callbackNumber })}
                onClick={() => remove(cb.id)}
              >
                {t('common.delete')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
