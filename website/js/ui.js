// DOM helpers and shared UI pieces. All text goes through textContent / text
// nodes: user notes are never rendered as HTML.
import { PROFILES, SESSION_TYPES, PROGRESS_STATUSES, SESSION_STATUSES } from './config.js';
import { subscribe } from './store.js';
import { icon } from './icons.js';

/**
 * h('button', { class: 'btn', onclick: fn, 'aria-label': 'x', dataset: { id } }, 'Text', childNode)
 * Attribute values of false/null/undefined are skipped; true sets a boolean attribute.
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (['checked', 'selected', 'disabled', 'open', 'required', 'multiple', 'hidden'].includes(k)) el[k] = Boolean(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ------------------------------------------------------------------ layout

const DESKTOP_QUERY = '(min-width: 960px)';
/** True when the sidebar (desktop) layout is active. Views with different desktop/phone structure use this. */
export function isDesktop() {
  return typeof matchMedia === 'function' && matchMedia(DESKTOP_QUERY).matches;
}
export function onLayoutChange(fn) {
  if (typeof matchMedia === 'function') matchMedia(DESKTOP_QUERY).addEventListener('change', fn);
}

/** Text that differs between the desktop and phone designs. */
export function bp(desktopText, mobileText) {
  if (desktopText === mobileText) return desktopText;
  return [h('span', { class: 'only-desk' }, desktopText), h('span', { class: 'only-mob' }, mobileText)];
}

// ------------------------------------------------------------------ toasts

export function toast(message, kind = 'info', { timeout = 3000 } = {}) {
  const region = document.getElementById('toasts');
  if (!region) return;
  const el = h('div', { class: ['toast', `toast-${kind}`], role: kind === 'error' ? 'alert' : 'status' },
    kind === 'success' && icon('check', { size: 18, cls: 'toast-icon' }),
    h('span', { class: 'toast-msg' }, message),
    h('button', { class: 'toast-close', 'aria-label': 'Dismiss', onclick: () => el.remove() }, icon('close', { size: 18 })));
  region.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

// ------------------------------------------------------------------ dialogs / sheets

/**
 * Modal dialog (a bottom sheet on phones). `build(close)` returns the body.
 * With `live: true` the body is rebuilt when shared data changes, so a sheet
 * left open still shows the other person's latest updates.
 * Resolves with the value passed to close() (undefined on Esc / ×).
 */
export function openDialog({ title, build, wide = false, live = false }) {
  return new Promise((resolve) => {
    const body = h('div', { class: 'dialog-body' });
    const dlg = h('dialog', { class: ['dialog', wide && 'dialog-wide'], 'aria-labelledby': 'dlg-title' });
    let done = false;
    let unsub = null;
    const close = (value) => {
      if (done) return;
      done = true;
      if (unsub) unsub();
      dlg.close();
      dlg.remove();
      resolve(value);
    };
    const render = () => {
      const active = document.activeElement;
      if (body.childNodes.length && active && body.contains(active) && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && active.type === 'text'))) return;
      const fk = active?.dataset?.fk;
      const scroll = dlg.scrollTop;
      body.replaceChildren(build(close));
      if (fk) body.querySelector(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
      dlg.scrollTop = scroll;
    };
    dlg.append(
      h('div', { class: 'dialog-head' },
        h('h2', { id: 'dlg-title', class: 'dialog-title' }, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => close(undefined) }, icon('close'))),
      body,
    );
    render();
    if (live) unsub = subscribe(render);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(undefined); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(undefined); }); // tap backdrop
    document.body.appendChild(dlg);
    dlg.showModal();
    const auto = dlg.querySelector('[autofocus]');
    if (auto) auto.focus();
  });
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return openDialog({
    title,
    build: (close) => h('div', { class: 'stack' },
      h('p', null, message),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-soft', type: 'button', onclick: () => close(false) }, 'Cancel'),
        h('button', { class: ['btn', danger ? 'btn-danger' : 'btn-primary'], type: 'button', onclick: () => close(true) }, confirmLabel))),
  }).then(Boolean);
}

/** List of actions shown as a sheet. actions: [{ label, sub?, danger?, run }] */
export function actionSheet(title, actions) {
  return openDialog({
    title,
    build: (close) => h('div', { class: 'menu', role: 'menu' }, actions.filter(Boolean).map((a) => h('button', {
      role: 'menuitem', type: 'button', class: a.danger && 'danger', onclick: () => { close(); a.run(); },
    }, h('span', { class: 'grow' }, a.label, a.sub && h('small', null, a.sub)), icon('chevron', { size: 18 })))),
  });
}

// ------------------------------------------------------------------ small pieces

/** A card with an optional icon + title + right-hand meta header. */
export function card({ cls = '', title, titleTag = 'h2', iconEl = null, meta = null, sub = null, id = null, test = null, labelledby = true } = {}, ...children) {
  const hid = id ? `${id}-h` : null;
  return h('section', { class: ['card', cls], id, 'data-test': test, 'aria-labelledby': title && hid && labelledby ? hid : null },
    title && h('div', { class: 'card-head' },
      iconEl,
      h('div', { class: 'card-head-text' }, h(titleTag, { class: 'card-title', id: hid }, title), sub && h('p', { class: 'card-sub' }, sub)),
      meta && h('div', { class: 'card-meta' }, meta)),
    children);
}

/** Small rounded label. kind: green | pink | grey | sand | terra */
export function pill(text, kind = 'grey', attrs = {}) {
  return h('span', { ...attrs, class: ['pill', `pill-${kind}`, attrs.class] }, text);
}

export function avatar(profileId, size = 'sm') {
  const p = PROFILES[profileId];
  return h('span', { class: ['avatar', `avatar-${profileId}`, `avatar-${size}`], title: p.name, 'aria-hidden': 'true' }, p.initial);
}

/** Who a session is for, as text: "Kyle", "David", "Kyle & David". */
export function whoText(participants) {
  return participants.length > 1 ? participants.map((p) => PROFILES[p]?.name ?? p).join(' & ') : (PROFILES[participants[0]]?.name ?? participants[0]);
}

export function whoChip(participants) {
  return participants.length > 1
    ? pill('Together', 'pink', { class: 'chip-joint' })
    : pill(PROFILES[participants[0]].name, 'green', { class: `chip-${participants[0]}` });
}

export function typeTag(type) {
  const kind = { individual: 'green', joint: 'pink', practice: 'pink', exam: 'terra', rest: 'grey', buffer: 'grey', other: 'grey' }[type] || 'grey';
  return pill((SESSION_TYPES[type] || SESSION_TYPES.other).label, kind, { class: `tag tag-${type}`, 'data-test': 'session-type' });
}

/** Progress status as a dot + text. `forProfile` adds the data-status-of hook. */
export function statusLabel(status, { short = false, forProfile = null, dot = true } = {}) {
  const s = PROGRESS_STATUSES.find((x) => x.id === status) || PROGRESS_STATUSES[0];
  return h('span', { class: ['status', `st-${s.id}`], 'data-status-of': forProfile, 'data-status': s.id },
    dot && h('i', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'status-text' }, short ? s.short : s.label));
}

/** 0–4 position of a status on the progress ladder (for bars). */
export function statusStep(status) {
  return { not_started: 0, in_progress: 1, completed: 2, needs_practice: 2, exam_ready: 4 }[status] ?? 0;
}

export function sessionStatePill(status) {
  if (status === 'planned') return null;
  const s = SESSION_STATUSES.find((x) => x.id === status);
  const kind = { completed: 'green', missed: 'terra', cancelled: 'grey' }[status] || 'grey';
  return pill(s ? s.label : status, kind, { class: 'session-state', 'data-test': 'session-state' });
}

export function bar(value, max, label, { cls = '' } = {}) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return h('div', { class: ['bar', cls], role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': value, 'aria-label': label },
    h('span', { style: `width:${pct}%` }));
}

export function emptyState(title, text) {
  return h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, title), text && h('p', { class: 'muted' }, text));
}

/** Section heading row: title (+ subtitle) on the left, controls on the right. */
export function sectionHead(title, sub, ...right) {
  return h('div', { class: 'section-head' },
    h('div', { class: 'section-head-text' }, h('h2', { class: 'section-title' }, title), sub && h('p', { class: 'section-sub' }, sub)),
    right.length > 0 && h('div', { class: 'section-head-right' }, right));
}

/** Pill-shaped filter buttons (aria-pressed). */
export function filterPills({ label, options, value, onChange, cls = '' }) {
  return h('div', { class: ['pills', cls], role: 'group', 'aria-label': label }, options.map((o) => h('button', {
    type: 'button', class: 'pill-btn', 'aria-pressed': String(o.id === value), onclick: () => onChange(o.id),
  }, o.label)));
}

export function segmented(opts) { return filterPills(opts); }

export function fieldError(id, message) {
  return h('p', { class: 'field-error', id, role: 'alert', hidden: !message }, message || '');
}

export function chevronLink(href, label, ...content) {
  return h('a', { class: 'row-link', href, 'aria-label': label }, content, icon('chevron', { size: 18, cls: 'chev' }));
}
