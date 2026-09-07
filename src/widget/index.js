/*
 * widget/index.js — content-script entry point. Mounts the React widget
 * (Momentum UI + Redux) inside a shadow root so the host CRM page's CSS can
 * never leak in or be leaked onto, and starts the phone-number popover
 * scanner. This is the file registered dynamically by
 * background/contentScriptRegistrar.js against the configured CRM URL.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import widgetCss from './styles/widget.css';
import searchableSelectCss from './ui/searchable-select.css';
import { injectCss } from '../shared/injectCss.js';
import { createStore } from './store/store.js';
import { initWidget, hydrate, setError } from './store/callSlice.js';
import { onEvent, sendCommand } from '../shared/messaging.js';
import { EVT, REG, SOURCE } from '../shared/constants.js';
import { getSettings } from '../shared/storage.js';
import WidgetApp from './WidgetApp.jsx';
import { startPhonePopoverScanner } from './phone/phonePopover.js';

if (!window.__cccWidgetMounted) {
  window.__cccWidgetMounted = true;
  mount();
}

async function mount() {
  const host = document.createElement('div');
  host.id = 'crm-call-companion-host';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  injectCss(shadow, widgetCss, 'ccc-widget-css');
  injectCss(shadow, searchableSelectCss, 'ccc-searchable-select-css');

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);
  // Phone-popover pills are appended here (inside our own shadow root, never
  // into the host page's DOM) so the injected widget.css actually reaches
  // them — shadow-root styles do not leak out to elements in the light DOM.
  const pillContainer = document.createElement('div');
  shadow.appendChild(pillContainer);

  const store = createStore();
  onEvent((msg) => {
    if (msg.type === EVT.STATE_CHANGED) store.dispatch(hydrate(msg.payload));
    if (msg.type === EVT.ERROR) store.dispatch(setError(msg.payload?.message));
  });
  store.dispatch(initWidget());

  createRoot(mountPoint).render(
    React.createElement(Provider, { store }, React.createElement(WidgetApp))
  );

  window.addEventListener('pagehide', () => {
    sendCommand(SOURCE.WIDGET, REG.WIDGET_CLOSED).catch(() => {});
  });

  const settings = await getSettings();
  if (settings.phoneDetectionEnabled) {
    startPhonePopoverScanner(store, pillContainer);
  }
}
