import React, { useMemo, useState } from 'react';
import chevronLeft from '@momentum-ui/icons/svg/arrow-left_16.svg';
import chevronRight from '@momentum-ui/icons/svg/arrow-right_16.svg';
import MomentumIcon from './MomentumIcon.jsx';
import { monthMatrix, addMonths, isSameDay, isSelectableDay, toDateValue } from '../callback/calendarGrid.js';

/*
 * widget/ui/CalendarPicker.jsx — month calendar following the Momentum
 * Calendar design (momentum.design): month header with prev/next, a
 * Monday-first weekday row, out-of-month days dimmed and the selected day
 * filled with the accent colour.
 *
 * Implemented here rather than pulling @momentum-design/components: that
 * package is ~9 MB of Lit web components and would undo the bundle reduction
 * this content script just went through (2.2 MB -> ~210 KB). It also registers
 * custom elements globally, which is risky inside an arbitrary CRM page.
 */
export default function CalendarPicker({ value, onChange, maxDaysAhead = 31, now = new Date() }) {
  const selected = value ? new Date(`${value}T00:00`) : null;
  const [visibleMonth, setVisibleMonth] = useState(() => new Date((selected || now).getFullYear(), (selected || now).getMonth(), 1));

  const weeks = useMemo(
    () => monthMatrix(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth]
  );

  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en';
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(visibleMonth);
  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 2024-01-01 was a Monday, so this yields a Monday-first header row.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

  const canGoBack = weeks.some((week) => week.some((d) => d.inMonth && isSelectableDay(d.date, { now, maxDaysAhead })))
    ? addMonths(visibleMonth, -1).getTime() >= new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    : true;

  return (
    <div className="ccc-cal">
      <div className="ccc-cal__header">
        <button
          type="button"
          className="ccc-cal__nav"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
        >
          <MomentumIcon src={chevronLeft} size={12} />
        </button>
        <span className="ccc-cal__month">{monthLabel}</span>
        <button
          type="button"
          className="ccc-cal__nav"
          aria-label="Next month"
          onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
        >
          <MomentumIcon src={chevronRight} size={12} />
        </button>
      </div>

      <div className="ccc-cal__grid" role="grid">
        {weekdayNames.map((name) => (
          <span key={name} className="ccc-cal__weekday" role="columnheader">
            {name}
          </span>
        ))}
        {weeks.flat().map(({ date, inMonth }) => {
          const selectable = isSelectableDay(date, { now, maxDaysAhead });
          const isSelected = selected && isSameDay(date, selected);
          return (
            <button
              key={date.toISOString()}
              type="button"
              role="gridcell"
              className={`ccc-cal__day${inMonth ? '' : ' is-outside'}${isSelected ? ' is-selected' : ''}${
                isSameDay(date, now) ? ' is-today' : ''
              }`}
              disabled={!selectable}
              aria-pressed={!!isSelected}
              onClick={() => onChange(toDateValue(date))}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
