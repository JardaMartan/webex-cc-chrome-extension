import React, { useEffect, useRef, useState } from 'react';
import Spinner from './ui/Spinner.jsx';
import { useDispatch, useSelector } from 'react-redux';
import settingsIcon from '@momentum-ui/icons/svg/settings_16.svg';
import calendarIcon from '@momentum-ui/icons/svg/calendar-empty_16.svg';
import handsetIcon from '@momentum-ui/icons/svg/handset_24.svg';
import micMutedIcon from '@momentum-ui/icons/svg/microphone-muted_16.svg';
import LoginPanel from './components/LoginPanel.jsx';
import AgentBar from './components/AgentBar.jsx';
import CallControls from './components/CallControls.jsx';
import CadPanel from './components/CadPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import CallbackPanel from './components/CallbackPanel.jsx';
import MomentumIcon from './ui/MomentumIcon.jsx';
import Button from './ui/Button.jsx';
import { AGENT_STATUS } from '../shared/constants.js';
import { clearCallbackDraft, startCallbackDraft, checkMicrophone, openExtensionOptions } from './store/callSlice.js';
import { getWidgetUi, setWidgetUi, getSettings, onSettingsChanged } from '../shared/storage.js';
import useWidgetTheme from './theme/useWidgetTheme.js';
import useT from './i18n/useT.js';

// How often to re-check mic access while logged in — a revoked OS/browser
// permission mid-session would otherwise only surface as a silent no-audio
// call, since the offscreen document that answers calls can't prompt.
const MIC_CHECK_INTERVAL_MS = 60000;

// Keeps a persisted position usable after a viewport resize (e.g. a smaller
// window than when it was last dragged) instead of drifting off-screen.
function clampPosition(pos) {
  const margin = 8;
  const maxLeft = Math.max(margin, window.innerWidth - margin);
  const maxTop = Math.max(margin, window.innerHeight - margin);
  return { top: Math.min(Math.max(pos.top, margin), maxTop), left: Math.min(Math.max(pos.left, margin), maxLeft) };
}

export default function WidgetApp() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [position, setPosition] = useState(null); // null = default bottom-right corner (CSS-driven)
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const dispatch = useDispatch();
  const { agentStatus, error, activeTask, micGranted, micMessage } = useSelector((s) => s.call);
  const callbackDraft = useSelector((s) => s.call.callbackDraft);
  const isRinging = !!activeTask && agentStatus !== AGENT_STATUS.ON_CALL && agentStatus !== AGENT_STATUS.WRAP_UP;
  // Both of these are things the agent MUST act on, so they outrank whatever
  // screen is open — the callback form replaces CallControls entirely, which
  // is how a wrap-up form could end up with nowhere to render.
  const callNeedsAttention = isRinging || agentStatus === AGENT_STATUS.WRAP_UP;
  const [colorMode, setColorMode] = useState('system');
  const theme = useWidgetTheme(colorMode);

  useEffect(() => {
    getSettings().then((s) => setColorMode(s.colorMode));
    return onSettingsChanged((s) => setColorMode(s?.colorMode || 'system'));
  }, []);

  // Re-checked periodically (not just at login) because the offscreen
  // document that actually answers calls has no visible surface to prompt on
  // — if the OS/browser revokes mic access mid-session, the agent would
  // otherwise only find out on the next call, as silence.
  const isSignedIn = agentStatus !== AGENT_STATUS.LOGGED_OUT && agentStatus !== AGENT_STATUS.CONNECTING;
  useEffect(() => {
    if (!isSignedIn) return undefined;
    dispatch(checkMicrophone());
    const id = setInterval(() => dispatch(checkMicrophone()), MIC_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isSignedIn, dispatch]);

  useEffect(() => {
    getWidgetUi().then((ui) => {
      if (ui.position) setPosition(clampPosition(ui.position));
    });
  }, []);

  // Once dragged to an explicit position, the panel anchors top-left, so
  // growing content (CAD panel opening, wrap-up UI, etc.) would normally
  // push its BOTTOM edge further down and off-screen. Watch its actual
  // rendered height and, whenever that would happen, shift `top` up just
  // enough to keep the bottom edge on-screen — i.e. expand upward instead.
  // (The default, never-dragged bottom-right corner already grows upward on
  // its own via the CSS `bottom: 16px` anchor, so this only needs to act
  // once a drag has switched positioning to explicit top/left — checked via
  // a ref, not a `position` dependency, so the observer isn't torn down and
  // recreated on every position update while actively dragging.)
  const positionRef = useRef(position);
  positionRef.current = position;
  // The `top` the panel had before an auto upward shift, so shrinking content
  // (e.g. wrap-up form closing) can snap it back instead of leaving it
  // parked higher than the user actually put it. Cleared by a manual drag,
  // which becomes the new baseline.
  const naturalTopRef = useRef(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const margin = 8;
    const observer = new ResizeObserver(() => {
      const current = positionRef.current;
      if (!current) return;
      const rect = el.getBoundingClientRect();
      const maxTop = Math.max(margin, window.innerHeight - margin - rect.height);

      if (naturalTopRef.current !== null && naturalTopRef.current <= maxTop) {
        const restoredTop = naturalTopRef.current;
        naturalTopRef.current = null;
        setPosition((prev) => {
          if (!prev) return prev;
          const next = { ...prev, top: restoredTop };
          setWidgetUi({ position: next });
          return next;
        });
        return;
      }

      if (rect.top > maxTop) {
        if (naturalTopRef.current === null) naturalTopRef.current = current.top;
        setPosition((prev) => {
          if (!prev) return prev;
          const next = { ...prev, top: maxTop };
          setWidgetUi({ position: next });
          return next;
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-expand the moment a call starts ringing; from then on it stays open
  // through the whole call (answered, wrap-up, ...) — it only ever collapses
  // again via the user's own click on the × button, never automatically.
  useEffect(() => {
    if (isRinging) setOpen(true);
  }, [isRinging]);

  // A ringing call or a mandatory wrap-up must never be hidden behind the
  // settings or callback screens.
  useEffect(() => {
    if (!callNeedsAttention) return;
    setShowSettings(false);
    if (callbackDraft) dispatch(clearCallbackDraft());
  }, [callNeedsAttention, callbackDraft, dispatch]);

  // Clicking a phone number mid-call opens the widget straight on the form.
  useEffect(() => {
    if (callbackDraft) {
      setOpen(true);
      setShowSettings(false);
    }
  }, [callbackDraft]);

  function startDrag(e) {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: rect.top, startLeft: rect.left, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onDragMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    setPosition(clampPosition({ top: drag.startTop + dy, left: drag.startLeft + dx }));
  }

  function endDrag() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return false;
    if (drag.moved) {
      // The panel just moved to a spot the user chose directly, so any
      // remembered pre-auto-shift top is stale — this position is the new one.
      naturalTopRef.current = null;
      if (position) setWidgetUi({ position });
    }
    return drag.moved;
  }

  const expanded = open;
  const style = {
    ...theme.palette,
    ...(position ? { top: `${position.top}px`, left: `${position.left}px`, right: 'auto', bottom: 'auto' } : {}),
  };

  return (
    <div
      className={`ccc-root${isRinging ? ' ccc-root--ringing' : ''}`}
      ref={rootRef}
      style={style}
      data-dark={theme.isDark ? 'true' : 'false'}
    >
      {expanded && (
        <div className="ccc-panel">
          <div
            className="ccc-panel__header"
            onPointerDown={startDrag}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span className="ccc-panel__title">Webex CC Client</span>
            {isSignedIn && !callNeedsAttention && (
              <button
                className="ccc-panel__icon-btn"
                aria-label={t('header.scheduledCallbacks')}
                aria-pressed={!!callbackDraft}
                title={t('header.scheduledCallbacks')}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setShowSettings(false);
                  dispatch(callbackDraft ? clearCallbackDraft() : startCallbackDraft(''));
                }}
              >
                <MomentumIcon src={calendarIcon} size={14} />
              </button>
            )}
            {isSignedIn && (
              <button
                className={`ccc-panel__icon-btn${error ? ' has-error' : ''}`}
                aria-label={error ? t('header.settingsNeedsAttention') : t('header.settings')}
                aria-pressed={showSettings}
                title={error ? t('header.settingsNeedsAttentionTitle') : t('header.settings')}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setShowSettings((v) => !v)}
              >
                <MomentumIcon src={settingsIcon} size={14} />
              </button>
            )}
            <button
              className="ccc-panel__close"
              aria-label={t('header.collapse')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          {/* Errors are reported in the settings screen, not here: a banner
              above the call controls pushed them around mid-call. The gear
              icon carries a marker so an error is still noticeable. */}
          {isSignedIn && micGranted === false && (
            <div className="ccc-panel__section ccc-mic-warning">
              <MomentumIcon src={micMutedIcon} size={16} />
              <p className="ccc-muted">
                {micMessage || t('mic.blockedDefault')}
              </p>
              <Button size={24} color="orange" onClick={() => dispatch(openExtensionOptions())}>
                {t('mic.fixButton')}
              </Button>
            </div>
          )}
          {agentStatus === AGENT_STATUS.LOGGED_OUT && <LoginPanel />}
          {agentStatus === AGENT_STATUS.CONNECTING && (
            <div className="ccc-panel__section ccc-connecting">
              <Spinner size={16} />
              <p className="ccc-muted">{t('status.connecting')}</p>
            </div>
          )}
          {agentStatus !== AGENT_STATUS.LOGGED_OUT && agentStatus !== AGENT_STATUS.CONNECTING && (
            <>
              {showSettings ? (
                <SettingsPanel onClose={() => setShowSettings(false)} />
              ) : callbackDraft && !callNeedsAttention ? (
                <CallbackPanel />
              ) : (
                <>
                  <AgentBar />
                  <CadPanel />
                  <CallControls />
                </>
              )}
            </>
          )}
        </div>
      )}
      {!expanded && (
        <button
          className="ccc-launcher"
          aria-label={t('header.openWidget')}
          onPointerDown={startDrag}
          onPointerMove={onDragMove}
          onPointerUp={(e) => {
            const moved = endDrag(e);
            if (!moved) setOpen(true);
          }}
          onPointerCancel={endDrag}
        >
          <MomentumIcon src={handsetIcon} size={22} />
        </button>
      )}
    </div>
  );
}

