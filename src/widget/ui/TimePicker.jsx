import React, { useEffect, useMemo } from 'react';
import clockIcon from '@momentum-ui/icons/svg/recents_16.svg';
import SearchableSelect from './SearchableSelect.jsx';
import MomentumIcon from './MomentumIcon.jsx';
import { timeOptions, generateTimeSlots, MINUTE_INTERVAL } from '../callback/timeOptions.js';
import useT from '../i18n/useT.js';

/*
 * widget/ui/TimePicker.jsx — 24-hour time selector with 15-minute intervals
 * for the callback form and widget settings, styled after MomentumUI TimePicker
 * with Momentum token pills and the standard Momentum clock icon.
 *
 * In callback mode (when `date` and/or `workingHoursStart`/`workingHoursEnd` are
 * provided):
 * - Constrains selectable times to the agent's configured working hours.
 * - Enforces the 30-minute API lead time on the current date.
 *
 * In general mode (e.g. Settings):
 * - Provides full 24-hour 15-minute interval options (00:00 to 23:45) or
 *   custom minTime/maxTime.
 */
export default function TimePicker({
  value,
  onChange,
  date,
  now = new Date(),
  workingHoursStart,
  workingHoursEnd,
  minTime = '00:00',
  maxTime = '23:45',
  interval = MINUTE_INTERVAL,
  options: customOptions,
  placeholder,
  ariaLabel,
  disabled = false,
  emptyText,
}) {
  const t = useT();

  const options = useMemo(() => {
    if (customOptions) {
      return customOptions.map((o) => (typeof o === 'string' ? { id: o, name: o } : o));
    }
    if (date !== undefined || workingHoursStart !== undefined || workingHoursEnd !== undefined) {
      const { options: opts } = timeOptions(date, now, {
        start: workingHoursStart || '08:00',
        end: workingHoursEnd || '17:00',
        interval,
      });
      return opts;
    }
    const slots = generateTimeSlots({
      start: minTime,
      end: maxTime,
      interval,
    });
    return slots.map((s) => ({ id: s, name: s }));
  }, [customOptions, date, now, workingHoursStart, workingHoursEnd, minTime, maxTime, interval]);

  // When options change (e.g. moving between dates or changing working hours),
  // if the currently selected value is no longer valid, clear it.
  useEffect(() => {
    if (!value) return;
    const ids = options.map((o) => o.id);
    if (ids.length > 0 && !ids.includes(value)) {
      onChange('');
    }
  }, [options, value, onChange]);

  return (
    <div className="ccc-timepicker">
      <SearchableSelect
        value={value || ''}
        onChange={(v) => onChange(v || '')}
        options={options}
        placeholder={placeholder || t('time.selectTime')}
        ariaLabel={ariaLabel || t('time.selectTime')}
        disabled={disabled}
        emptyText={emptyText || t('time.noTimesAvailable')}
        icon={<MomentumIcon src={clockIcon} size={14} />}
      />
    </div>
  );
}
