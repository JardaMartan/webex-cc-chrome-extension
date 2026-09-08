import { useSelector } from 'react-redux';
import { t } from '../../shared/i18n/translate.js';

/*
 * widget/i18n/useT.js — reads the resolved locale from Redux (see
 * store/callSlice.js `locale`, set once in widget/index.js from
 * resolveLocale()) and returns a bound `t(key, params)` for the current
 * render. No React context needed — every component already has the store.
 */
export default function useT() {
  const locale = useSelector((s) => s.call.locale);
  return (key, params) => t(locale, key, params);
}
