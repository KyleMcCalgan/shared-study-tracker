// Small inline SVG icon set (static, trusted markup — never user data).
// Two families, matching the two design sets:
//  - line icons (phone design): home, calendar, layers, chat, gear, cap, user…
//  - "glyph" icons (desktop design): d-home ⌂, d-schedule ▣, d-topics ◇,
//    d-discuss ◯, d-settings ⚙, clover ♧, pawn ♙, d-square ▢, phone ☏, bars ▥
const DOTS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return `<circle cx="${(12 + 7 * Math.cos(a)).toFixed(2)}" cy="${(12 + 7 * Math.sin(a)).toFixed(2)}" r="1.5" fill="currentColor" stroke="none"/>`;
}).join('');

const PATHS = {
  // ---- line icons
  home: '<path class="fillable" d="M4 10.4 12 4l8 6.4V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-5v6h-4A1.5 1.5 0 0 1 4 19z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.6"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  layers: '<path class="fillable" d="M12 3.5 3 8.5l9 5 9-5z"/><path d="m3 12.6 9 5 9-5"/>',
  chat: '<path class="fillable" d="M12 4c5 0 9 3.1 9 7s-4 7-9 7c-1.2 0-2.3-.2-3.4-.5L4 19.5l1.3-3.7C3.8 14.5 3 12.8 3 11c0-3.9 4-7 9-7z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  cap: '<path d="M1.8 9.2 12 4.6l10.2 4.6L12 13.8z"/><path d="M5.6 11v4.6c0 1.8 2.9 3.4 6.4 3.4s6.4-1.6 6.4-3.4V11"/>',
  user: '<circle cx="12" cy="7.8" r="4"/><path d="M4.5 20.5c0-4 3.4-6.6 7.5-6.6s7.5 2.6 7.5 6.6z"/>',
  users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.8c0-3.5 2.8-5.8 6.2-5.8s6.2 2.3 6.2 5.8z"/><path d="M15.2 4.8a3.4 3.4 0 0 1 0 6.4M17.3 14.3c2.2.6 3.9 2.6 3.9 5.5h-2.4"/>',
  swap: '<path d="M4 8h15M15.5 4.5 19 8l-3.5 3.5M20 16H5M8.5 12.5 5 16l3.5 3.5"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.6 9.5 4.5 4.5 0 0 0 7 18.5z"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10.5" rx="1.4"/><path d="M2.5 18.5h19"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  progress: DOTS,
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',

  // ---- desktop "glyph" icons
  'd-home': '<path d="M5.5 20V11l6.5-6 6.5 6v9z"/>',
  'd-schedule': '<rect x="4" y="4" width="16" height="16" rx="1"/><rect class="glyph-fill" x="7" y="7" width="10" height="10" fill="currentColor" stroke="none"/>',
  'd-topics': '<path d="M12 3.8 20.2 12 12 20.2 3.8 12z"/>',
  'd-discuss': '<circle cx="12" cy="12" r="9.2"/>',
  'd-settings': '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M10.6 2.5h2.8l.5 2.6 1.6.7 2.2-1.5 2 2-1.5 2.2.7 1.6 2.6.5v2.8l-2.6.5-.7 1.6 1.5 2.2-2 2-2.2-1.5-1.6.7-.5 2.6h-2.8l-.5-2.6-1.6-.7-2.2 1.5-2-2 1.5-2.2-.7-1.6-2.6-.5v-2.8l2.6-.5.7-1.6-1.5-2.2 2-2 2.2 1.5 1.6-.7zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z"/>',
  clover: '<circle cx="12" cy="7.2" r="3.7"/><circle cx="7.3" cy="13.2" r="3.7"/><circle cx="16.7" cy="13.2" r="3.7"/><path d="M12 13.5v7.5M10.4 21h3.2"/>',
  pawn: '<circle cx="12" cy="5.8" r="2.4"/><path d="M9.3 10.2h5.4M10.6 10.2c0 2.8-1.4 4.6-2.9 6h8.6c-1.5-1.4-2.9-3.2-2.9-6M6.6 20.5h10.8v-3.4H6.6z"/>',
  'd-square': '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/>',
  phone: '<path d="M2.8 9.6c0-2.3 4.1-4.3 9.2-4.3s9.2 2 9.2 4.3v1.6h-4.1V9.3c-1.4-.6-3-.9-5.1-.9s-3.7.3-5.1.9v1.9H2.8z"/><path d="M7.4 11.2 5.3 18.5h13.4l-2.1-7.3"/><circle cx="12" cy="14.8" r="2"/>',
  bars: '<rect x="3.8" y="5" width="16.4" height="14"/><path d="M7.2 5v14M10.4 5v14M13.6 5v14M16.8 5v14"/>',
};

export function icon(name, { size = 22, label = null, cls = '', stroke = 2 } = {}) {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="icon icon-${name} ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${PATHS[name] || ''}</svg>`;
  return tpl.content.firstElementChild;
}

/** Two decorative icons: one shown on the desktop layout, the other on phones. */
export function dualIcon(desktopName, mobileName, opts = {}) {
  const span = document.createElement('span');
  span.className = `dual-icon ${opts.cls || ''}`;
  span.setAttribute('aria-hidden', 'true');
  span.append(icon(desktopName, { ...opts, cls: 'only-desk' }), icon(mobileName, { ...opts, cls: 'only-mob' }));
  return span;
}

/** Stack-of-books illustration (static, decorative). */
function book(x, y, w, h, cover, dark, rot) {
  const lines = [0.32, 0.5, 0.68].map((f) => `<path d="M${x + 24} ${(y + h * f).toFixed(1)} H${x + w - 2}" stroke="#ead9cb" stroke-width="1.6"/>`).join('');
  return `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2.6}" fill="${dark}"/>
    <rect x="${x + 3}" y="${y}" width="${w - 3}" height="${h * 0.72}" rx="${h / 3}" fill="${cover}"/>
    <rect x="${x + 20}" y="${y + h * 0.2}" width="${w - 18}" height="${h * 0.6}" rx="3" fill="#fffaf4"/>
    ${lines}
    <path d="M${x + 20} ${y + h * 0.2} H${x + w + 2}" stroke="${cover}" stroke-width="3" stroke-linecap="round"/>
    <path d="M${x + 20} ${y + h * 0.8} H${x + w + 2}" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}
export function booksArt(cls = '') {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="art art-books ${cls}" viewBox="0 0 200 130" aria-hidden="true">
  ${book(10, 70, 172, 48, '#df8e6c', '#c5694a', -6)}
  ${book(30, 20, 156, 48, '#acc192', '#8ea672', -10)}
</svg>`;
  return tpl.content.firstElementChild;
}

/** Two speech bubbles (static, decorative). */
export function bubblesArt(cls = '') {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="art art-bubbles ${cls}" viewBox="0 0 180 150" aria-hidden="true">
  <path d="M20 92c0-20 19-34 42-34s42 14 42 34-19 34-42 34c-5 0-10-1-14-2l-14 18 2-24c-10-6-16-15-16-26z" fill="#df9a7b"/>
  <path d="M70 46c0-22 22-38 50-38s50 16 50 38-22 38-50 38c-6 0-12-1-17-2l-1 0 22 16-38-14c-10-8-16-23-16-38z" fill="#a9be90"/>
  <circle cx="98" cy="46" r="6" fill="#fff"/><circle cx="120" cy="46" r="6" fill="#fff"/><circle cx="142" cy="46" r="6" fill="#fff"/>
</svg>`;
  return tpl.content.firstElementChild;
}
