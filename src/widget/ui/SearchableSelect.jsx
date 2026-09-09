import React, { useEffect, useMemo, useRef, useState } from 'react';

// Ported from the sibling task-management project's src/ui/SearchableSelect.jsx
// (same Momentum-token pill design system) — inline SVG icons instead of the
// Momentum ComboBox/Select icon font (renders wrong glyphs in this standalone
// content-script bundle), shadow-DOM safe (composedPath outside-click,
// option commit on mousedown so it fires before the outside-click closes it).
const SearchIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path fill="currentColor" d="M11.74 10.34l2.96 2.96a1 1 0 0 1-1.41 1.41l-2.96-2.96a5.5 5.5 0 1 1 1.41-1.41zM7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
  </svg>
);
const ChevronIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path fill="currentColor" d="M4.24 6.24a1 1 0 0 1 1.42 0L8 8.59l2.34-2.35a1 1 0 1 1 1.42 1.42l-3.05 3.05a1 1 0 0 1-1.42 0L4.24 7.66a1 1 0 0 1 0-1.42z" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path fill="currentColor" d="M6.2 11.3L2.8 7.9l1.4-1.4 2 2 4.6-4.6 1.4 1.4z" />
  </svg>
);

/**
 * @param {string} value                     Selected option id (or '')
 * @param {{id:string,name:string}[]} options
 * @param {(id:string|null)=>void} onChange
 */
export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = '',
  searchable = true,
  disabled = false,
  ariaLabel,
  emptyText = '',
  icon = null,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [popStyle, setPopStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);

  const items = useMemo(() => (options || []).map((o) => ({ id: o.id, label: o.name || o.id })), [options]);

  const selectedId = value || '';
  const selected = items.find((i) => i.id === selectedId);
  const triggerText = selected ? selected.label : placeholder;

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;

  useEffect(() => {
    if (!open) return undefined;
    // position:fixed (computed here, not CSS `top:calc(100% + 4px)`) so the
    // popover escapes .ccc-panel's `overflow-y:auto` instead of being
    // clipped/forced to scroll inside the widget's own bounds.
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
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
    const onDoc = (e) => {
      const path = (e.composedPath && e.composedPath()) || [];
      if (rootRef.current && (path.includes(rootRef.current) || rootRef.current.contains(e.target))) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (searchable && inputRef.current) inputRef.current.focus();
    const idx = filtered.findIndex((i) => i.id === selectedId);
    setActiveIndex(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [query, filtered.length]);

  const pick = (id) => {
    onChange(id || null);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = filtered[activeIndex];
      if (it) pick(it.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="ss-ctl" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className={`ss-trigger ${open ? 'is-open' : ''} ${selected ? '' : 'is-placeholder'}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {icon && <span className="ss-trigger__icon">{icon}</span>}
        <span className="ss-trigger__value" title={triggerText}>
          {triggerText}
        </span>
        <span className="ss-trigger__chevron">
          <ChevronIcon />
        </span>
      </button>
      {open && popStyle && (
        <div className="ss-pop" style={{ top: `${popStyle.top}px`, left: `${popStyle.left}px`, width: `${popStyle.width}px` }}>
          {searchable && (
            <div className="ss-search">
              <span className="ss-search__icon">
                <SearchIcon />
              </span>
              <input
                ref={inputRef}
                className="ss-search__input"
                type="text"
                value={query}
                placeholder={placeholder}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          <ul className="ss-list" role="listbox">
            {filtered.map((it, i) => (
              <li
                key={it.id}
                role="option"
                aria-selected={it.id === selectedId}
                className={`ss-opt${it.id === selectedId ? ' is-selected' : ''}${i === activeIndex ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(it.id);
                }}
                title={it.label}
              >
                <span className="ss-opt__label">{it.label}</span>
                {it.id === selectedId && (
                  <span className="ss-opt__check">
                    <CheckIcon />
                  </span>
                )}
              </li>
            ))}
            {filtered.length === 0 && <li className="ss-opt ss-opt--empty">{emptyText || '—'}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
