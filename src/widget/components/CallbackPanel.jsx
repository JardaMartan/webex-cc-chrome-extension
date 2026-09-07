import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import CalendarPicker from '../ui/CalendarPicker.jsx';
import TimePicker from '../ui/TimePicker.jsx';

const WINDOW_OPTIONS = [
  { id: '30', name: '30 minutes' },
  { id: '60', name: '1 hour' },
  { id: '120', name: '2 hours' },
  { id: '240', name: '4 hours' },
  { id: '480', name: '8 hours' },
];

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
  const dispatch = useDispatch();
  const { callbackDraft, activeTask, agent } = useSelector((s) => s.call);
  const myAgentId = agent?.agentId;
  const [queues, setQueues] = useState([]);
  const [scheduled, setScheduled] = useState(null); // null = still loading
  // The existing callback for this number, if any — a number may hold only one.
  const [existing, setExisting] = useState(null);
  const [checking, setChecking] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
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
    dispatch(fetchTransferQueues()).then((list) => setQueues(list || []));
    refreshScheduled();
    checkExisting(callbackDraft?.callbackNumber);
  }, [dispatch]);

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
        <span className="ccc-settings__title">{existing ? 'Re-schedule callback' : 'Schedule callback'}</span>
        <Button size={28} ghost onClick={() => dispatch(clearCallbackDraft())}>
          Back
        </Button>
      </div>

      <label className="ccc-settings__label">Callback number</label>
      <input
        className="ccc-input"
        value={form.callbackNumber}
        onChange={(e) => update({ callbackNumber: e.target.value })}
        onBlur={(e) => checkExisting(e.target.value)}
      />
      {checking && <p className="ccc-muted ccc-settings__hint">Checking for an existing callback…</p>}
      {existing && (
        <div className="ccc-settings__row">
          <p className="ccc-muted ccc-settings__hint">
            Already scheduled for {formatWhen(existing)} — saving will move it.
          </p>
          <Button size={28} ghost color="red" disabled={busy} onClick={() => remove(existing.id)}>
            Delete
          </Button>
        </div>
      )}

      <label className="ccc-settings__label">Customer name</label>
      <input
        className="ccc-input"
        value={form.customerName}
        maxLength={250}
        onChange={(e) => update({ customerName: e.target.value })}
      />

      <label className="ccc-settings__label">Callback date</label>
      <CalendarPicker value={form.date} onChange={(date) => update({ date })} maxDaysAhead={MAX_DAYS_AHEAD} />

      <label className="ccc-settings__label">Start time</label>
      <TimePicker date={form.date} value={form.time} onChange={(time) => update({ time })} />

      <label className="ccc-settings__label">Callback window</label>
      <SearchableSelect
        value={form.windowMinutes}
        onChange={(id) => update({ windowMinutes: id || '30' })}
        options={WINDOW_OPTIONS}
        ariaLabel="Callback window"
      />

      <label className="ccc-settings__label">Handled by</label>
      <div className="ccc-seg" role="group" aria-label="Callback assignment">
        <button
          type="button"
          className={`ccc-seg__btn${form.assignTo === ASSIGN_TO_QUEUE ? ' is-active' : ''}`}
          aria-pressed={form.assignTo === ASSIGN_TO_QUEUE}
          onClick={() => update({ assignTo: ASSIGN_TO_QUEUE })}
        >
          Queue
        </button>
        <button
          type="button"
          className={`ccc-seg__btn${form.assignTo === ASSIGN_TO_ME ? ' is-active' : ''}`}
          aria-pressed={form.assignTo === ASSIGN_TO_ME}
          onClick={() => update({ assignTo: ASSIGN_TO_ME })}
        >
          Me
        </button>
      </div>
      {form.assignTo === ASSIGN_TO_OTHER && (
        <p className="ccc-muted ccc-settings__hint">
          Currently assigned to another agent — it stays with them unless you pick Queue or Me.
        </p>
      )}

      {form.assignTo === ASSIGN_TO_QUEUE ? (
        <>
          <label className="ccc-settings__label">Queue</label>
          <SearchableSelect
            value={form.queueId}
            onChange={(id) => update({ queueId: id || '' })}
            options={queues}
            placeholder="Select queue…"
            ariaLabel="Queue"
          />
        </>
      ) : (
        // The API demands a queue regardless, so the fallback is named rather
        // than sent invisibly.
        <p className="ccc-muted ccc-settings__hint">
          Routes through {queueName || 'the first available queue'} if the callback cannot be taken personally.
        </p>
      )}

      <label className="ccc-settings__label">Reason (optional)</label>
      <input
        className="ccc-input"
        value={form.callbackReason}
        onChange={(e) => update({ callbackReason: e.target.value })}
      />

      <Button color="blue" size={28} disabled={busy} onClick={submit}>
        {status === 'saving' ? <Spinner size={14} /> : existing ? 'Re-schedule callback' : 'Schedule callback'}
      </Button>
      {status === 'saved' && <p className="ccc-muted ccc-settings__hint">✓ Callback saved.</p>}
      {status === 'deleted' && <p className="ccc-muted ccc-settings__hint">✓ Callback deleted.</p>}
      {status?.startsWith('error:') && <p className="ccc-muted ccc-settings__hint">✗ {status.slice(6)}</p>}

      <div className="ccc-settings__divider" />

      {/* The list API needs an assignee or a number to filter on, so this can
          only show what is assigned to this agent. */}
      <label className="ccc-settings__label">Callbacks assigned to you</label>
      {scheduled === null && <Spinner size={14} />}
      {scheduled?.length === 0 && <p className="ccc-muted ccc-settings__hint">None scheduled.</p>}
      {scheduled?.length > 0 && (
        <ul className="ccc-callbacks">
          {scheduled.map((cb) => (
            <li key={cb.id} className="ccc-callbacks__item">
              <span className="ccc-callbacks__when">{formatWhen(cb)}</span>
              <span className="ccc-callbacks__who">{cb.customerName || cb.callbackNumber}</span>
              <Button size={24} ghost disabled={busy} ariaLabel={`Edit callback for ${cb.customerName || cb.callbackNumber}`} onClick={() => loadExisting(cb)}>
                Edit
              </Button>
              <Button size={24} ghost color="red" disabled={busy} ariaLabel={`Delete callback for ${cb.customerName || cb.callbackNumber}`} onClick={() => remove(cb.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
