// DOM helpers. All text goes through textContent / text nodes: user notes are
// never rendered as HTML.
import { PROFILES, SESSION_TYPES, PROGRESS_STATUSES, SESSION_STATUSES } from './config.js';

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
      else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'open' || k === 'required' || k === 'multiple') el[k] = Boolean(v);
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

export function toast(message, kind = 'info', { timeout = 3200 } = {}) {
  const region = document.getElementById('toasts');
  if (!region) return;
  const el = h('div', { class: ['toast', `toast-${kind}`], role: kind === 'error' ? 'alert' : 'status' },
    h('span', { class: 'toast-msg' }, message),
    h('button', { class: 'toast-close', 'aria-label': 'Dismiss', onclick: () => el.remove() }, '×'));
  region.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

// ------------------------------------------------------------------ dialogs

/**
 * Modal dialog built on <dialog>. `build(close)` returns the body node.
 * Resolves with whatever value close() is called with (undefined on Esc).
 */
export function openDialog({ title, build, wide = false }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: ['dialog', wide && 'dialog-wide'], 'aria-labelledby': 'dlg-title' });
    let done = false;
    const close = (value) => {
      if (done) return;
      done = true;
      dlg.close();
      dlg.remove();
      resolve(value);
    };
    dlg.append(
      h('div', { class: 'dialog-head' },
        h('h2', { id: 'dlg-title', class: 'dialog-title' }, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close(undefined) }, '×')),
      h('div', { class: 'dialog-body' }, build(close)),
    );
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(undefined); });
    document.body.appendChild(dlg);
    dlg.showModal();
    const first = dlg.querySelector('[autofocus], input, select, textarea, .dialog-body button');
    if (first) first.focus();
  });
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, details = null }) {
  return openDialog({
    title,
    build: (close) => h('div', null,
      h('p', null, message),
      details,
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', onclick: () => close(false) }, 'Cancel'),
        h('button', { class: ['btn', danger ? 'btn-danger' : 'btn-primary'], onclick: () => close(true) }, confirmLabel))),
  }).then(Boolean);
}

// ------------------------------------------------------------------ chips & badges

export function personChip(profileId, { small = false } = {}) {
  const p = PROFILES[profileId];
  return h('span', { class: ['chip', `chip-${profileId}`, small && 'chip-sm'] },
    h('span', { class: 'chip-initial', 'aria-hidden': 'true' }, p.initial), p.name);
}

export function participantsChip(participants) {
  if (participants.length > 1) {
    return h('span', { class: 'chip chip-joint' }, h('span', { class: 'chip-initial', 'aria-hidden': 'true' }, '＋'), 'Kyle + David');
  }
  return personChip(participants[0]);
}

export function typeChip(type) {
  const t = SESSION_TYPES[type] || SESSION_TYPES.other;
  return h('span', { class: ['chip', 'chip-type', `type-${type}`] }, h('span', { 'aria-hidden': 'true' }, t.icon), t.label);
}

export function progressBadge(status) {
  const s = PROGRESS_STATUSES.find((x) => x.id === status) || PROGRESS_STATUSES[0];
  return h('span', { class: ['badge', `st-${s.id}`] }, s.label);
}

export function sessionStatusBadge(status) {
  if (status === 'planned') return null;
  const s = SESSION_STATUSES.find((x) => x.id === status);
  return h('span', { class: ['badge', `ss-${status}`] }, s ? s.label : status);
}

export function tierChip(tier, code) {
  const label = code || tier;
  return h('span', { class: ['tier', `tier-${(tier || 'block').toLowerCase()}`] }, label);
}

/** Progress bar with an accessible text equivalent. */
export function progressBar(value, max, label, profileId) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return h('div', { class: 'pbar-wrap' },
    h('div', {
      class: ['pbar', profileId && `pbar-${profileId}`], role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': value, 'aria-label': label,
    }, h('div', { class: 'pbar-fill', style: `width:${pct}%` })));
}

export function emptyState(title, text, icon = '') {
  return h('div', { class: 'empty' }, icon && h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, icon),
    h('p', { class: 'empty-title' }, title), text && h('p', { class: 'muted' }, text));
}

export function section(title, ...children) {
  return h('section', { class: 'panel' }, title && h('h2', { class: 'panel-title' }, title), ...children);
}

export function fieldError(id, message) {
  return h('p', { class: 'field-error', id, role: 'alert', hidden: !message }, message || '');
}
