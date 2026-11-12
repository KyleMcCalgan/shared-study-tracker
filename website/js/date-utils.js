// Date-only utilities for Africa/Johannesburg calendar days.
//
// Study days are calendar dates ("YYYY-MM-DD"), never UTC instants. We never
// pass a date-only string to `new Date()` (it is parsed as UTC midnight).
// All arithmetic is done on integer day numbers via Date.UTC, which has no DST
// or timezone effects. Johannesburg is UTC+02:00 all year (no DST).

export const TIMEZONE = 'Africa/Johannesburg';

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function pad(n, w = 2) { return String(n).padStart(w, '0'); }

function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

/** Returns {y, m, d} or null when the string is not a real calendar date. */
export function parseISODate(s) {
  if (typeof s !== 'string') return null;
  const match = ISO_RE.exec(s);
  if (!match) return null;
  const y = Number(match[1]); const m = Number(match[2]); const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function isValidISODate(s) { return parseISODate(s) !== null; }

export function toISODate(y, m, d) { return `${pad(y, 4)}-${pad(m)}-${pad(d)}`; }

/** Integer day number (days since 1970-01-01) for a valid ISO date. */
export function dayNumber(s) {
  const p = parseISODate(s);
  if (!p) throw new Error(`Invalid date: ${s}`);
  return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
}

export function fromDayNumber(n) {
  const dt = new Date(n * 86400000);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(s, n) { return fromDayNumber(dayNumber(s) + n); }

/** b - a in whole calendar days. */
export function diffDays(a, b) { return dayNumber(b) - dayNumber(a); }

export function compareDates(a, b) { return a < b ? -1 : a > b ? 1 : 0; } // ISO strings sort lexically

/** 0 = Sunday … 6 = Saturday */
export function weekdayIndex(s) { return new Date(dayNumber(s) * 86400000).getUTCDay(); }

export function weekdayName(s) { return WEEKDAYS[weekdayIndex(s)]; }

/** Monday that starts the week containing s. */
export function startOfWeek(s) {
  const wd = weekdayIndex(s);
  return addDays(s, wd === 0 ? -6 : 1 - wd);
}

/** The current calendar date in the given IANA timezone (default Johannesburg). */
export function todayISO(now = new Date(), timeZone = TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "Friday 13 November 2026" */
export function formatLong(s) {
  const p = parseISODate(s);
  if (!p) return 'Unknown date';
  return `${weekdayName(s)} ${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** "Fri 13 Nov" */
export function formatShort(s) {
  const p = parseISODate(s);
  if (!p) return 'TBD';
  return `${weekdayName(s).slice(0, 3)} ${p.d} ${MONTHS[p.m - 1].slice(0, 3)}`;
}

/**
 * Exam countdown. Returns { kind, days, label }.
 * kind: 'none' (no confirmed date) | 'future' | 'today' | 'passed'
 */
export function examCountdown(examDate, today) {
  if (!isValidISODate(examDate)) return { kind: 'none', days: null, label: '' };
  const days = diffDays(today, examDate);
  if (days > 1) return { kind: 'future', days, label: `${days} days until the exam` };
  if (days === 1) return { kind: 'future', days, label: '1 day until the exam' };
  if (days === 0) return { kind: 'today', days, label: 'Exam today' };
  return { kind: 'passed', days, label: 'Exam date passed' };
}

/** Relative description of a date versus today: "Today", "Tomorrow", "Yesterday", "In 3 days", "2 days ago". */
export function relativeDay(s, today) {
  const n = diffDays(today, s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}

/** Valid "HH:MM" 24h time? */
export function isValidTime(t) {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/** Format a millisecond timestamp in Johannesburg time, e.g. "13 Nov, 14:05". */
export function formatTimestamp(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: TIMEZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(ms));
}
