// Schedule: a strip of every plan day; tap a day to see its sessions.
import { h, segmented, emptyState } from '../ui.js';
import { icon } from '../icons.js';
import { state, readPref, writePref } from '../store.js';
import { STORAGE_KEYS, PROFILES } from '../config.js';
import {
  visibleSessions, sortSessions, matchesFilter, mineFirst,
} from '../model.js';
import {
  todayISO, addDays, parseISODate, weekdayName, diffDays, relativeDay,
} from '../date-utils.js';
import { sessionCard, sessionFormDialog } from './session-card.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'kyle', label: 'Kyle' },
  { id: 'david', label: 'David' },
  { id: 'together', label: 'Together' },
  { id: 'restbuffer', label: 'Rest' },
];

let selected = null; // selected day, kept across live re-renders

function dotsFor(sessions) {
  const kinds = new Set();
  for (const s of sessions) {
    if (s.status === 'cancelled') continue;
    if (['rest', 'practice', 'exam'].includes(s.type)) kinds.add(s.type);
    else if (s.participants.length > 1) kinds.add('joint');
    else kinds.add(s.participants[0]);
  }
  return ['kyle', 'david', 'joint', 'rest', 'practice', 'exam'].filter((k) => kinds.has(k)).slice(0, 4);
}

export function renderSchedule(root, param, rerender) {
  const today = todayISO();
  const all = sortSessions(visibleSessions(state.sessions));
  root.append(h('div', { class: 'row' }, h('h1', { class: 'page-title grow' }, 'Schedule'),
    h('button', { class: 'btn btn-sm', onclick: () => sessionFormDialog(undefined, { date: selected || today }) }, icon('plus', { size: 18 }), 'Add')));
  if (!all.length) {
    root.append(emptyState('No sessions yet', 'The schedule has not been imported into the database.'));
    return;
  }
  const first = all[0].date;
  const last = all.reduce((m, s) => (s.date > m ? s.date : m), first);
  if (param && parseISODate(param)) selected = param;
  if (!selected || selected < first || selected > last) selected = today < first ? first : today > last ? last : today;
  const filter = FILTERS.some((f) => f.id === readPref(STORAGE_KEYS.scheduleFilter)) ? readPref(STORAGE_KEYS.scheduleFilter) : 'all';

  // ---- day strip
  const strip = h('div', { class: 'daystrip', role: 'tablist', 'aria-label': 'Plan days' });
  for (let i = 0; i <= diffDays(first, last); i++) {
    const d = addDays(first, i);
    const daySessions = all.filter((s) => s.date === d && matchesFilter(s, filter));
    const isSel = d === selected;
    strip.append(h('button', {
      class: ['daypill', d === today && 'is-today', d < today && 'is-past', isSel && 'is-selected'],
      role: 'tab', 'aria-selected': String(isSel), id: `daypill-${d}`,
      'aria-label': `${weekdayName(d)} ${parseISODate(d).d}${d === today ? ', today' : ''}: ${daySessions.length} sessions`,
      onclick: () => { selected = d; rerender(); },
    },
    h('span', { class: 'daypill-dow' }, d === today ? 'Today' : weekdayName(d).slice(0, 3)),
    h('span', { class: 'daypill-num' }, String(parseISODate(d).d)),
    h('span', { class: 'daypill-dots', 'aria-hidden': 'true' }, dotsFor(daySessions).map((k) => h('i', { class: k })))));
  }
  root.append(strip);
  requestAnimationFrame(() => { // centre the selected day horizontally (never scrolls the page)
    const pill = document.getElementById(`daypill-${selected}`);
    if (pill) strip.scrollLeft = pill.offsetLeft - strip.offsetLeft - (strip.clientWidth - pill.offsetWidth) / 2;
  });

  root.append(segmented({
    label: 'Show', options: FILTERS, value: filter,
    onChange: (id) => { writePref(STORAGE_KEYS.scheduleFilter, id); rerender(); },
  }));

  // ---- selected day
  const ws = state.workspace;
  const d = selected;
  const sessions = mineFirst(all.filter((s) => s.date === d && matchesFilter(s, filter)), state.profile);
  const prot = (ws?.protectedDates || []).filter((p) => p.date === d);
  const day = h('section', { class: 'stack', id: `day-${d}`, 'aria-label': `${weekdayName(d)} ${parseISODate(d).d}` },
    h('div', { class: 'day-head' },
      h('div', null,
        h('p', { class: 'eyebrow' }, relativeDay(d, today)),
        h('h2', { class: 'day-title' }, `${weekdayName(d)} ${parseISODate(d).d}`)),
      ws?.examDate === d && h('span', { class: 'pill-state ps-missed' }, 'Exam day')),
    ws?.dayGoals?.[d] && h('p', { class: 'day-goal' }, ws.dayGoals[d]),
    prot.map((p) => h('p', { class: 'day-lock' }, icon('lock', { size: 16 }),
      h('span', null, `${p.appliesTo.length > 1 ? '' : `${PROFILES[p.appliesTo[0]].name}: `}${p.reason.split('. ')[0]}.`))));
  if (sessions.length) day.append(h('div', null, sessions.map((s) => sessionCard(s))));
  else day.append(emptyState(filter === 'all' ? 'Nothing scheduled' : 'Nothing for this filter', null));
  root.append(day);
}
