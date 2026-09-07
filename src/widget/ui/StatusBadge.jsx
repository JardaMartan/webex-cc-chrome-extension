import React from 'react';
import MomentumIcon from './MomentumIcon.jsx';

/*
 * widget/ui/StatusBadge.jsx — replaces @momentum-ui/react's <Badge>.
 *
 * Momentum's compiled CSS ships no per-component badge stylesheet, so using
 * its Badge would force the whole 1.2 MB momentum-ui.min.css into the content
 * script for a handful of rules. Colours are Momentum tokens
 * (@momentum-ui/tokens colors.json) and it re-themes with the widget's own
 * custom properties, which Momentum's light-only badge never did.
 */
export default function StatusBadge({ color = 'gray', icon, children }) {
  return (
    <span className={`ccc-badge ccc-badge--${color}`}>
      {icon && <MomentumIcon src={icon} size={12} />}
      <span>{children}</span>
    </span>
  );
}
