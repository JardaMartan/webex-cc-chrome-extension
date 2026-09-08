/*
 * widget/phone/phonePopover.js — scans the CRM page for phone-number-looking
 * text and injects a small hover "Call" pill next to each match, wired
 * directly to the widget's Redux store (outdial thunk). Ported from the
 * sibling task-management project's crm-clicktocall-extension/content.js
 * scanner, simplified: since the widget and the scanner now live in the SAME
 * content script (no separate "Desktop tab" to message), a click can just
 * `store.dispatch(outdial(value))` directly.
 *
 * IMPORTANT: this file must never call setAttribute/removeAttribute (or any
 * other mutation) on an element that belongs to the host page. The CRM is
 * very likely a client-rendered React/Vue/etc. app; mutating one of its
 * elements while it is still hydrating is the textbook cause of "Hydration
 * failed because the initial UI does not match what was rendered on the
 * server" (React error #418/#421) — React's own docs literally call out
 * "a browser extension which messes with the HTML before React loaded" as a
 * cause. `scannedHosts` (a WeakSet, not a DOM attribute) is what makes this
 * scanner read-only with respect to the host page's own elements — the only
 * DOM writes here are brand-new pill elements appended into OUR OWN
 * container (see startPhonePopoverScanner's `pillContainer` param).
 */
import handsetIcon from '@momentum-ui/icons/svg/handset_16.svg';
import callbackIcon from '@momentum-ui/icons/svg/recents_16.svg';
import { extractPhoneNumbers } from '../../shared/phoneMatcher.js';
import { toInlineSvg } from '../ui/momentumSvg.js';
import { outdial, startCallbackDraft } from '../store/callSlice.js';
import { canPlaceCall, canScheduleCallback } from '../store/selectors.js';
import { t } from '../../shared/i18n/translate.js';

const scannedHosts = new WeakSet();
// Pills already injected, so a state change can re-skin them in place.
const livePills = [];

// Mirrors the store so the hover handlers stay synchronous.
let dialable = false;
let schedulable = false;

const CALL_SVG = toInlineSvg(handsetIcon, 15);
const CALLBACK_SVG = toInlineSvg(callbackIcon, 15);

function makeButton(className, svg) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `ccc-phone-pill__btn ${className}`;
  btn.innerHTML = svg;
  return btn;
}

// One group per number: dial now and/or schedule a callback, depending on what
// the agent's current state allows.
function makeCallPill(store, phoneValue) {
  const group = document.createElement('div');
  group.className = 'ccc-phone-pill';

  const callBtn = makeButton('ccc-phone-pill__btn--call', CALL_SVG);
  const locale = store.getState().call.locale;
  callBtn.title = t(locale, 'phone.callAria', { number: phoneValue });
  callBtn.setAttribute('aria-label', t(locale, 'phone.callAria', { number: phoneValue }));
  callBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    store.dispatch(outdial(phoneValue));
    callBtn.classList.add('ccc-phone-pill__btn--sent');
    setTimeout(() => callBtn.classList.remove('ccc-phone-pill__btn--sent'), 900);
  });

  const callbackBtn = makeButton('ccc-phone-pill__btn--callback', CALLBACK_SVG);
  callbackBtn.title = t(locale, 'phone.scheduleCallbackAria', { number: phoneValue });
  callbackBtn.setAttribute('aria-label', t(locale, 'phone.scheduleCallbackAria', { number: phoneValue }));
  callbackBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    store.dispatch(startCallbackDraft(phoneValue));
  });

  group.append(callBtn, callbackBtn);
  return { group, callBtn, callbackBtn };
}

// Re-skins every pill in place when the agent's state flips.
function paintPill({ callBtn, callbackBtn }) {
  callBtn.hidden = !dialable;
  callbackBtn.hidden = !schedulable;
}

function positionPill(host, pill) {
  const r = host.getBoundingClientRect();
  const gap = 6;
  const left = r.left - pill.offsetWidth - gap;
  // Fall back to the right side if there's no room to the left (e.g. the
  // number sits right at the viewport's left edge).
  pill.style.left = `${(left < 2 ? r.right + gap : left) + window.scrollX}px`;
  pill.style.top = `${r.top + r.height / 2 - pill.offsetHeight / 2 + window.scrollY}px`;
}

function attachHover(host, pill) {
  let hideTimer = null;
  const show = () => {
    if (!dialable && !schedulable) return;
    if (hideTimer) clearTimeout(hideTimer);
    pill.style.visibility = 'hidden';
    pill.classList.add('ccc-phone-pill--visible');
    positionPill(host, pill);
    pill.style.visibility = '';
  };
  const hide = () => {
    hideTimer = setTimeout(() => pill.classList.remove('ccc-phone-pill--visible'), 200);
  };
  host.addEventListener('mouseenter', show);
  host.addEventListener('mouseleave', hide);
  pill.addEventListener('mouseenter', show);
  pill.addEventListener('mouseleave', hide);
}

function scanTextNodes(root, store, pillContainer) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentNode;
      if (!p || !p.nodeName) return NodeFilter.FILTER_REJECT;
      if (['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT'].includes(p.nodeName)) return NodeFilter.FILTER_REJECT;
      if (scannedHosts.has(p)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !/\d/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const pending = [];
  let n;
  while ((n = walker.nextNode())) pending.push(n);

  pending.forEach((node) => {
    const host = node.parentNode;
    if (!host || scannedHosts.has(host)) return;
    const phones = extractPhoneNumbers(node.nodeValue);
    if (phones.length === 0) return;
    scannedHosts.add(host);
    phones.forEach((p) => {
      const pill = makeCallPill(store, p.value);
      paintPill(pill);
      livePills.push(pill);
      pillContainer.appendChild(pill.group);
      attachHover(host, pill.group);
    });
  });
}

export function startPhonePopoverScanner(store, pillContainer) {
  // Offering "Call" while the agent has no telephony device or is engaged would
  // only produce a failed outdial, so that button comes and goes with the
  // agent's state — but scheduling a callback stays available throughout, since
  // it needs nothing but a live session. A class on the container covers pills
  // that are already on screen when the state flips.
  const syncAvailability = () => {
    const call = store.getState().call;
    const nextDialable = canPlaceCall(call);
    const nextSchedulable = canScheduleCallback(call);
    if (nextDialable === dialable && nextSchedulable === schedulable) return;
    dialable = nextDialable;
    schedulable = nextSchedulable;
    pillContainer.classList.toggle('ccc-pills--disabled', !dialable && !schedulable);
    livePills.forEach(paintPill);
  };
  syncAvailability();
  const unsubscribe = store.subscribe(syncAvailability);

  const scan = () => {
    try {
      scanTextNodes(document.body, store, pillContainer);
    } catch (err) {
      console.warn('[crm-call-companion] phone scan error', err);
    }
  };
  scan();
  let rescanTimer = null;
  const observer = new MutationObserver(() => {
    if (rescanTimer) return;
    rescanTimer = setTimeout(() => {
      rescanTimer = null;
      scan();
    }, 400);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
    unsubscribe();
  };
}
