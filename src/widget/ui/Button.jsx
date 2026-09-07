import React from 'react';

/*
 * widget/ui/Button.jsx — replaces @momentum-ui/react's <Button>.
 *
 * Momentum's Button re-enters its own barrel (`import { Loading } from "./.."`),
 * which drags DatePicker/TimePicker and therefore all of moment.js (172 KB)
 * into the content script no matter how deeply it is imported. Since the whole
 * @momentum-ui/react package could then be dropped from this bundle, the few
 * buttons the widget needs are rendered here instead, styled with the same
 * Momentum design tokens as the rest of the widget.
 *
 * Prop names deliberately mirror Momentum's so call sites read the same.
 */
export default function Button({
  children,
  color,
  circle = false,
  size = 28,
  ghost = false,
  disabled = false,
  onClick,
  ariaLabel,
  ariaPressed,
  title,
  className = '',
}) {
  const classes = [
    'ccc-btn',
    circle && 'ccc-btn--circle',
    ghost && 'ccc-btn--ghost',
    color && `ccc-btn--${color}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style = { height: `${size}px`, ...(circle ? { width: `${size}px` } : {}) };

  return (
    <button
      type="button"
      className={classes}
      style={style}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={title}
    >
      {children}
    </button>
  );
}
