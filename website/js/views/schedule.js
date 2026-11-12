// Schedule / calendar: agenda grouped by date, week navigation, filters.
import { h, emptyState } from '../ui.js';
import { state, readPref, writePref } from '../store.js';
import { STORAGE_KEYS } from '../config.js';
import { visibleSessions, sortSessions, matchesFilter } from '../model.js';
import {
  todayISO, formatLong, startOfWeek, addDays, formatShort, compareDates,
} from '../date-utils.js';
import { sessionCard, sessionFormDialog } from './session-card.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'kyle', label: 'Kyle' },
  { id: 'david', label: 'David' },
  { id: 'together', label: 'Together' },
  { id: 'restbuffer', label: 'Rest & buffers' },
];

let weekStart = null; // Monday of the displayed week (kept across re-renders)

export function renderSchedule(root, param, rerender) {
  const today = todayISO();
  const all = sortSessions(visibleSessions(state.sessions));
  if (!all.length) {
    root.append(emptyState('No sessions yet', 'The schedule has not been imported into the database.', '🗓️'));
    return;
  }
  const filter = FILTERS.some((f) => f.id === readPref(STORAGE_KEYS.scheduleFilter)) ? readPref(STORAGE_KEYS.scheduleFilter) : 'all';
  const first = all[0].date;
  const last = all.reduce((m, s) => (s.date > m ? s.date : m), all[0].date);
  const minWeek = startOfWeek(first);
  const maxWeek = startOfWeek(last);

  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) weekStart = startOfWeek(param);
  if (!weekStart) weekStart = startOfWeek(compareDates(today, first) < 0 ? first : (today > last ? last : today));
  if (weekStart < minWeek) weekStart = minWeek;
  if (weekStart > maxWeek) weekStart = maxWeek;
  const weekEnd = addDays(weekStart, 6);

  const go = (ws) => { weekStart = ws; rerender(); };
  root.append(h('div', { class: 'toolbar' },
    h('h1', { class: 'view-title' }, 'Schedule'),
    h('button', { class: 'btn btn-sm', onclick: () => sessionFormDialog(undefined, { date: today >= first ? today : first }) }, '＋ Add session')));

  root.append(h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter sessions' },
    FILTERS.map((f) => h('button', {
      class: ['filter', f.id === filter && 'is-active'],
      'aria-pressed': String(f.id === filter),
      onclick: () => { writePref(STORAGE_KEYS.scheduleFilter, f.id); rerender(); },
    }, f.label))));

  root.append(h('div', { class: 'weeknav' },
    h('button', { class: 'btn btn-sm', disabled: weekStart <= minWeek, onclick: () => go(addDays(weekStart, -7)), 'aria-label': 'Previous week' }, '‹ Prev'),
    h('span', { class: 'weeknav-label', 'aria-live': 'polite' }, `${formatShort(weekStart)} – ${formatShort(weekEnd)}`),
    h('button', { class: 'btn btn-sm', onclick: () => { go(startOfWeek(today)); setTimeout(() => document.getElementById(`day-${today}`)?.scrollIntoView({ block: 'start' }), 50); } }, 'Today'),
    h('button', { class: 'btn btn-sm', disabled: weekStart >= maxWeek, onclick: () => go(addDays(weekStart, 7)), 'aria-label': 'Next week' }, 'Next ›')));

  const ws = state.workspace;
  const list = h('div', { class: 'agenda' });
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const daySessions = all.filter((s) => s.date === d && matchesFilter(s, filter));
    const isToday = d === today;
    const isPast = d < today;
    const isExam = ws?.examDate === d;
    const goal = ws?.dayGoals?.[d];
    const prot = (ws?.protectedDates || []).filter((p) => p.date === d);
    const outOfRange = d < first || d > last;
    const day = h('section', { class: ['day', isToday && 'is-today', isPast && 'is-past'], id: `day-${d}`, 'aria-label': formatLong(d) },
      h('header', { class: 'day-head' },
        h('h2', { class: 'day-title' }, formatLong(d)),
        isToday && h('span', { class: 'badge badge-today' }, 'Today'),
        isPast && !isToday && h('span', { class: 'badge badge-past' }, 'Past'),
        isExam && h('span', { class: 'badge badge-exam' }, '🎓 Exam day')),
      goal && h('p', { class: 'day-goal muted small' }, `Goal: ${goal}`),
      prot.length > 0 && h('p', { class: 'day-protected small' }, `🔒 ${prot.map((p) => p.reason.split('.')[0]).join(' · ')}`));
    if (daySessions.length) daySessions.forEach((s) => day.append(sessionCard(s)));
    else if (outOfRange) day.append(h('p', { class: 'muted small' }, 'Outside the study plan.'));
    else day.append(h('p', { class: 'muted small' }, filter === 'all' ? 'Nothing scheduled.' : 'Nothing for this filter.'));
    list.append(day);
  }
  root.append(list);
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    setTimeout(() => document.getElementById(`day-${param}`)?.scrollIntoView({ block: 'start' }), 30);
  }
}
