import React from 'react';

/*
 * widget/ui/Spinner.jsx — replaces @momentum-ui/react's <Spinner>.
 *
 * Its `.md-spinner` rules live in @momentum-ui/core's loader.css, which is
 * 246 KB of loader variants we never use — far too much to inline into a
 * content script for one busy indicator.
 */
export default function Spinner({ size = 16 }) {
  return (
    <span
      className="ccc-spinner"
      style={{ width: `${size}px`, height: `${size}px` }}
      role="status"
      aria-label="Loading"
    />
  );
}
