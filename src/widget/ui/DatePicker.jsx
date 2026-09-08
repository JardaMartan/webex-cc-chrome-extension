import React, { useEffect, useRef, useState } from 'react';
import calendarIcon from '@momentum-ui/icons/svg/calendar-empty_16.svg';
import MomentumIcon from './MomentumIcon.jsx';
import CalendarPicker from './CalendarPicker.jsx';

/*
 * widget/ui/DatePicker.jsx — single-line date field with a calendar icon
 * that opens CalendarPicker's month grid in a popover, mirroring
 * SearchableSelect's pill-trigger pattern (same `.ss-trigger`/`.ss-pop`
 * tokens). The month grid used to sit permanently expanded in the callback
 * form (~200px tall) even when the agent wasn't actively picking a date;
 * this collapses it to a single 28px row, only opening on demand.
 */
export default function DatePicker({ value, onChange, maxDaysAhead, now, ariaLabel = 'Callback date' }) {
  const [open, setOpen] = useState(false);
  const [popStyle, setPopStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en';
  const displayText = value
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(`${value}T00:00`)
      )
    : 'Select date…';

  useEffect(() => {
    if (!open) return undefined;
    // position:fixed (measured here, not CSS) so the popover escapes
    // .ccc-panel's overflow-y:auto instead of being clipped/scrolled inside it
    // — same approach as SearchableSelect.
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopStyle({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 232) });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    // Shadow-safe outside-click: composedPath, not `.contains`, since inside
    // a shadow root document-level events retarget to the host element.
    const onDoc = (e) => {
      const path = (e.composedPath && e.composedPath()) || [];
      if (rootRef.current && (path.includes(rootRef.current) || rootRef.current.contains(e.target))) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (!open && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div className="ss-ctl" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className={`ss-trigger${open ? ' is-open' : ''}${value ? '' : ' is-placeholder'}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="ss-trigger__value">{displayText}</span>
        <span className="ss-trigger__chevron">
          <MomentumIcon src={calendarIcon} size={14} />
        </span>
      </button>
      {open && popStyle && (
        <div
          className="ccc-datepicker-pop"
          style={{ top: `${popStyle.top}px`, left: `${popStyle.left}px`, width: `${popStyle.width}px` }}
        >
          <CalendarPicker
            value={value}
            onChange={(date) => {
              onChange(date);
              setOpen(false);
            }}
            maxDaysAhead={maxDaysAhead}
            now={now}
          />
        </div>
      )}
    </div>
  );
}
