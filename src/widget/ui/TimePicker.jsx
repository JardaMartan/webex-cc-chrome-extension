import React, { useEffect, useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect.jsx';
import { timeOptions } from '../callback/timeOptions.js';
import useT from '../i18n/useT.js';

/*
 * widget/ui/TimePicker.jsx — hour/minute selector for the callback form.
 *
 * Built from the widget's canonical SearchableSelect (Momentum-token pill
 * dropdowns) rather than @momentum-ui/react's TimePicker: that package was
 * removed from this bundle because its components re-enter their own barrel
 * and drag moment.js in with them.
 *
 * Hour and minute are held HERE rather than derived from `value`: the parent
 * only has a complete "HH:mm", so deriving from it discarded a freshly picked
 * hour (there was no minute yet, so value stayed empty and the hour reset).
 *
 * Options are filtered so a time before the API's 30-minute lead time cannot
 * be picked at all on the earliest selectable day.
 */
export default function TimePicker({ date, value, onChange, now = new Date() }) {
  const t = useT();
  const { hours, minutesFor } = useMemo(() => timeOptions(date, now), [date, now]);
  const [hour, setHour] = useState(() => (value ? value.split(':')[0] : ''));
  const [minute, setMinute] = useState(() => (value ? value.split(':')[1] : ''));

  const apply = (nextHour, nextMinute) => {
    setHour(nextHour);
    setMinute(nextMinute);
    onChange(nextHour && nextMinute ? `${nextHour}:${nextMinute}` : '');
  };

  // Changing the day can invalidate the current pick (e.g. moving from
  // tomorrow back to today drops the early hours), so drop only what no longer
  // fits rather than submitting something the API would reject.
  useEffect(() => {
    if (!hour) return;
    if (!hours.includes(hour)) apply('', '');
    else if (minute && !minutesFor(hour).includes(minute)) apply(hour, '');
  }, [date]);

  // `value` can change out from under this component (e.g. an existing
  // callback loads asynchronously after mount), so re-sync local hour/minute
  // whenever it no longer matches what they'd combine to — but only then, so
  // an in-progress pick (hour set, minute not yet) isn't clobbered.
  useEffect(() => {
    const current = hour && minute ? `${hour}:${minute}` : '';
    if (value === current) return;
    setHour(value ? value.split(':')[0] : '');
    setMinute(value ? value.split(':')[1] : '');
  }, [value]);

  return (
    <div className="ccc-timepicker">
      <SearchableSelect
        value={hour}
        onChange={(h) => apply(h || '', h && minutesFor(h).includes(minute) ? minute : '')}
        options={hours.map((h) => ({ id: h, name: h }))}
        placeholder={t('time.hourPlaceholder')}
        ariaLabel={t('time.hourLabel')}
      />
      <span className="ccc-timepicker__sep">:</span>
      <SearchableSelect
        value={minute}
        onChange={(m) => apply(hour, m || '')}
        options={minutesFor(hour || hours[0]).map((m) => ({ id: m, name: m }))}
        placeholder={t('time.minutePlaceholder')}
        ariaLabel={t('time.minuteLabel')}
        disabled={!hour}
      />
    </div>
  );
}
