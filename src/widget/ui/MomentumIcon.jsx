import React, { useMemo } from 'react';
import { toInlineSvg } from './momentumSvg.js';

// See momentumSvg.js for why Momentum's SVG assets are inlined rather than
// using its icon font, and why innerHTML is safe for them.
export default function MomentumIcon({ src, size = 16 }) {
  const html = useMemo(() => toInlineSvg(src, size), [src, size]);
  // eslint-disable-next-line react/no-danger
  return <span className="ccc-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}
