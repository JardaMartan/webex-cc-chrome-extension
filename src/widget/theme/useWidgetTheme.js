import { useEffect, useState } from 'react';
import { COLOR_MODE } from '../../shared/constants.js';
import { LIGHT_PALETTE, DARK_PALETTE } from './palette.js';
import { samplePageTheme, observePageTheme } from './pageTheme.js';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

function systemTheme() {
  const dark = window.matchMedia?.(SYSTEM_DARK_QUERY).matches;
  return { palette: dark ? DARK_PALETTE : LIGHT_PALETTE, isDark: !!dark };
}

/**
 * Resolves settings.colorMode into the CSS custom properties applied to
 * .ccc-root, plus whether the result is dark (which the few bits of Momentum
 * chrome we cannot re-token still need to know — see widget.css).
 */
export default function useWidgetTheme(mode) {
  const [theme, setTheme] = useState({ palette: LIGHT_PALETTE, isDark: false });

  useEffect(() => {
    if (mode === COLOR_MODE.DEFAULT) {
      setTheme({ palette: LIGHT_PALETTE, isDark: false });
      return undefined;
    }
    if (mode === COLOR_MODE.PAGE) {
      setTheme(samplePageTheme());
      return observePageTheme(setTheme);
    }
    setTheme(systemTheme());
    const media = window.matchMedia?.(SYSTEM_DARK_QUERY);
    if (!media) return undefined;
    const listener = () => setTheme(systemTheme());
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [mode]);

  return theme;
}
