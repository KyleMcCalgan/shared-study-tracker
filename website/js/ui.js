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
      else if (['checked', 'selected', 'disabled', 'open', 'required', 'multiple'].includes(k)) el[k] = Boolean(v);
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

// ------------------------------------------------------------------ toasts

export function toast(message, kind = 'info', { timeout = 3000 } = {}) {
  const region = document.getElementById('toasts');
  if (!region) return;
  const el = h('div', { class: ['toast', `toast-${kind}`], role: kind === 'error' ? 'alert' : 'status' },
    h('span', { class: 'toast-msg' }, message),
    h('button', { class: 'toast-close', 'aria-label': 'Dismiss', onclick: () => el.remove() }, '×'));
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
      body.replaceChildren(build(close));
      if (fk) body.querySelector(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
    };
    dlg.append(
      h('div', { class: 'dialog-head' },
        h('h2', { id: 'dlg-title', class: 'dialog-title' }, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close(undefined) }, icon('close'))),
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
        h('button', { class: 'btn', onclick: () => close(false) }, 'Cancel'),
        h('button', { class: ['btn', danger ? 'btn-danger' : 'btn-primary'], onclick: () => close(true) }, confirmLabel))),
  }).then(Boolean);
}

/** List of actions shown as a sheet. actions: [{ label, sub?, danger?, run }] */
export function actionSheet(title, actions) {
  return openDialog({
    title,
    build: (close) => h('div', { class: 'menu', role: 'menu' }, actions.filter(Boolean).map((a) => h('button', {
      role: 'menuitem', class: a.danger && 'danger', onclick: () => { close(); a.run(); },
    }, h('span', { class: 'grow' }, a.label, a.sub && h('small', null, a.sub))))),
  });
}

// ------------------------------------------------------------------ small pieces

export function avatar(profileId, size = 'sm') {
  const p = PROFILES[profileId];
  return h('span', { class: ['avatar', `avatar-${profileId}`, `avatar-${size}`], title: p.name, 'aria-hidden': 'true' }, p.initial);
}

export function personChip(profileId) {
  return h('span', { class: ['chip', `chip-${profileId}`] }, PROFILES[profileId].name);
}

export function whoChip(participants) {
  return participants.length > 1
    ? h('span', { class: 'chip chip-joint' }, 'Together')
    : personChip(participants[0]);
}

export function typeTag(type) {
  return h('span', { class: ['tag', `tag-${type}`] }, (SESSION_TYPES[type] || SESSION_TYPES.other).label);
}

export function statusLabel(status, { short = false } = {}) {
  const s = PROGRESS_STATUSES.find((x) => x.id === status) || PROGRESS_STATUSES[0];
  return h('span', { class: ['status', `st-${s.id}`] }, short ? s.short : s.label);
}

export function sessionStatePill(status) {
  if (status === 'planned') return null;
  const s = SESSION_STATUSES.find((x) => x.id === status);
  return h('span', { class: ['pill-state', `ps-${status}`] }, s ? s.label : status);
}

export function bar(value, max, label) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': value, 'aria-label': label },
    h('span', { style: `width:${pct}%` }));
}

export function emptyState(title, text) {
  return h('div', { class: 'empty card' }, h('p', { class: 'empty-title' }, title), text && h('p', { class: 'muted' }, text));
}

export function secHead(title, link) {
  return h('div', { class: 'sec-head' }, h('h2', { class: 'sec-title' }, title),
    link && h('a', { class: 'sec-link', href: link.href }, link.label, icon('chevron', { size: 18 })));
}

export function segmented({ label, options, value, onChange }) {
  return h('div', { class: 'seg', role: 'group', 'aria-label': label }, options.map((o) => h('button', {
    type: 'button', 'aria-pressed': String(o.id === value), onclick: () => onChange(o.id),
  }, o.label)));
}

export function fieldError(id, message) {
  return h('p', { class: 'field-error', id, role: 'alert', hidden: !message }, message || '');
}
