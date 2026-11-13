// Schedule: a Mon–Sun week of plan days (tap a day to see its sessions),
// upcoming sessions and key dates.
import {
  h, emptyState, filterPills, sectionHead, card, pill, bp,
} from '../ui.js';
import { icon, dualIcon, booksArt } from '../icons.js';
import { state, readPref, writePref } from '../store.js';
import { STORAGE_KEYS, PROFILES } from '../config.js';
import {
  visibleSessions, sortSessions, matchesFilter, mineFirst, involves, isStudySession, splitTitle,
} from '../model.js';
import {
  todayISO, addDays, parseISODate, weekdayName, relativeDay, startOfWeek, formatShort, examCountdown,
} from '../date-utils.js';
import {
  sessionCard, sessionFormDialog, timeText, withText,
} from './session-card.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'kyle', label: 'Kyle' },
  { id: 'david', label: 'David' },
  { id: 'together', label: 'Together' },
  { id: 'restbuffer', label: 'Rest' },
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let selected = null; // selected day, kept across live re-renders
let scrollToSession = null;

/** Short chip text for a session in the week grid. */
function chipLabel(s) {
  if (s.type === 'rest') return 'Rest';
  if (s.type === 'buffer') return 'Buffer';
  if (s.type === 'exam') return 'Exam';
  if (s.type === 'practice') return 'Practice';
  if (s.type === 'joint') return s.code ? `${s.code} together` : 'Together';
  if (s.type === 'other') return `${PROFILES[s.participants[0]].name}: ${/^Open day/.test(s.title) ? 'open' : 'busy'}`;
  return `${PROFILES[s.participants[0]].name} study`;
}
const chipKind = (s) => ({ individual: 'green', joint: 'pink', practice: 'pink', exam: 'terra' }[s.type] || 'grey');

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
  const me = state.profile;
  const all = sortSessions(visibleSessions(state.sessions));
  const addBtn = (cls) => h('button', { class: ['btn btn-primary btn-add', cls], type: 'button', onclick: () => sessionFormDialog(undefined, { date: selected || today }) },
    icon('plus', { size: 20 }), 'Add Session');
  if (!all.length) {
    root.append(h('div', { class: 'toolbar' }, addBtn()), emptyState('No sessions yet', 'The schedule has not been imported into the database.'));
    return;
  }
  const first = all[0].date;
  const last = all.reduce((m, s) => (s.date > m ? s.date : m), first);
  if (param && parseISODate(param)) selected = param;
  if (!selected || selected < first || selected > last) selected = today < first ? first : today > last ? last : today;
  const filter = FILTERS.some((f) => f.id === readPref(STORAGE_KEYS.scheduleFilter)) ? readPref(STORAGE_KEYS.scheduleFilter) : 'all';
  const weekStart = startOfWeek(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const canPrev = weekStart > first;
  const canNext = addDays(weekStart, 7) <= last;
  const goWeek = (n) => {
    let d = addDays(selected, 7 * n);
    if (d < first) d = first;
    if (d > last) d = last;
    selected = d;
    rerender();
  };
  const navBtn = (n, cls) => h('button', {
    class: ['icon-btn week-arrow', cls], type: 'button', disabled: n < 0 ? !canPrev : !canNext,
    'aria-label': n < 0 ? 'Previous week' : 'Next week', onclick: () => goWeek(n),
  }, icon(n < 0 ? 'back' : 'chevron', { size: 20 }));

  // ---- desktop toolbar
  root.append(sectionHead('Study calendar', 'Your sessions and time together',
    h('div', { class: 'week-pill only-desk' }, navBtn(-1), h('span', null, 'Week view'), navBtn(1)),
    addBtn('only-desk')));

  // ---- week card
  const inWeek = all.filter((s) => days.includes(s.date));
  const mineInWeek = inWeek.filter((s) => involves(s, me) && isStudySession(s) && s.status !== 'cancelled');
  const studyCount = mineInWeek.length;
  const jointCount = mineInWeek.filter((s) => s.type === 'joint').length;
  const summary = `${studyCount} study session${studyCount === 1 ? '' : 's'} · ${jointCount} joint session${jointCount === 1 ? '' : 's'}`;
  const ws = parseISODate(weekStart);
  const we = parseISODate(addDays(weekStart, 6));
  const range = `${ws.d}${ws.m !== we.m ? ` ${MONTHS[ws.m - 1].slice(0, 3)}` : ''} – ${we.d} ${MONTHS[we.m - 1].slice(0, 3)}`;

  const strip = h('div', { class: 'week-days', role: 'tablist', 'aria-label': 'Days this week' }, days.map((d) => {
    const daySessions = mineFirst(all.filter((s) => s.date === d && matchesFilter(s, filter)), me);
    const inPlan = d >= first && d <= last;
    const isSel = d === selected;
    return h('button', {
      class: ['daycol', d === today && 'is-today', d < today && 'is-past', isSel && 'is-selected', !inPlan && 'is-off'],
      role: 'tab', type: 'button', 'aria-selected': String(isSel), id: `daypill-${d}`, disabled: !inPlan,
      'aria-label': `${weekdayName(d)} ${parseISODate(d).d}${d === today ? ', today' : ''}: ${daySessions.length} sessions`,
      onclick: () => { selected = d; rerender(); },
    },
    h('span', { class: 'daycol-dow' }, d === today ? 'Today' : weekdayName(d).slice(0, 3)),
    h('span', { class: 'daycol-num' }, String(parseISODate(d).d)),
    h('span', { class: 'daycol-chips', 'aria-hidden': 'true' }, daySessions.filter((s) => s.status !== 'cancelled').slice(0, 4).map((s) => h('span', { class: ['wk-chip', `wk-${chipKind(s)}`, s.status === 'completed' && 'is-done'] }, chipLabel(s)))),
    h('span', { class: 'daycol-dots', 'aria-hidden': 'true' }, dotsFor(daySessions).map((k) => h('i', { class: k }))));
  }));

  const weekCard = h('section', { class: 'card week-card', 'aria-labelledby': 'week-h', 'data-test': 'week' },
    h('div', { class: 'week-head' },
      navBtn(-1, 'only-mob'),
      h('h2', { class: 'card-title', id: 'week-h' }, bp(`Week of ${ws.d} ${MONTHS[ws.m - 1]}`, range)),
      navBtn(1, 'only-mob'),
      h('span', { class: 'card-meta muted only-desk' }, summary)),
    strip,
    filterPills({
      label: 'Show', options: FILTERS, value: filter, cls: 'week-filters',
      onChange: (id) => { writePref(STORAGE_KEYS.scheduleFilter, id); rerender(); },
    }));

  // ---- this week (phone design)
  const thisWeek = h('section', { class: 'card hero hero-week only-mob', 'aria-label': `This week: ${summary}` },
    h('div', { class: 'hero-text' },
      h('div', { class: 'hero-head' }, icon('calendar', { size: 30, stroke: 1.8, cls: 'hero-icon' }), h('p', { class: 'hero-week-title' }, 'This Week')),
      h('p', { class: 'hero-sub muted' }, summary)),
    booksArt('hero-art'));

  // ---- selected day
  const wsDoc = state.workspace;
  const d = selected;
  const sessions = mineFirst(all.filter((s) => s.date === d && matchesFilter(s, filter)), me);
  const prot = (wsDoc?.protectedDates || []).filter((p) => p.date === d);
  const day = h('section', { class: 'day-panel', id: `day-${d}`, 'aria-label': `${weekdayName(d)} ${parseISODate(d).d}`, 'data-test': 'day' },
    h('div', { class: 'day-head' },
      h('div', null,
        h('p', { class: 'eyebrow' }, relativeDay(d, today)),
        h('h2', { class: 'day-title' }, `${weekdayName(d)} ${parseISODate(d).d}`)),
      wsDoc?.examDate === d && pill('Exam day', 'terra')),
    wsDoc?.dayGoals?.[d] && h('p', { class: 'day-goal' }, wsDoc.dayGoals[d]),
    prot.map((p) => h('p', { class: 'day-lock' }, icon('lock', { size: 16 }),
      h('span', null, `${p.appliesTo.length > 1 ? '' : `${PROFILES[p.appliesTo[0]].name}: `}${p.reason.split('. ')[0]}.`))));
  if (sessions.length) day.append(h('div', { class: 'sess-list' }, sessions.map((s) => sessionCard(s))));
  else day.append(emptyState(filter === 'all' ? 'Nothing scheduled' : 'Nothing for this filter', null));

  // ---- upcoming
  const upcoming = sortSessions(visibleSessions(state.sessions).filter((s) => s.date >= today && s.status === 'planned'
    && involves(s, me) && !['rest', 'exam', 'other'].includes(s.type))).slice(0, 5);
  const upTag = (s) => (s.type === 'individual' ? pill(PROFILES[s.participants[0]].name, 'green')
    : s.type === 'joint' ? pill('Together', 'pink') : s.type === 'practice' ? pill('Practice', 'pink') : pill('Buffer', 'grey'));
  const upcomingCard = h('section', { class: 'card upcoming-card', 'aria-labelledby': 'up-h', 'data-test': 'upcoming' },
    h('div', { class: 'card-head' },
      h('div', { class: 'card-head-text' }, h('h2', { class: 'card-title', id: 'up-h' }, 'Upcoming Sessions'), h('p', { class: 'card-sub only-desk' }, 'Your next planned activities')),
      addBtn('only-mob')),
    upcoming.length
      ? h('ul', { class: 'up-list' }, upcoming.map((s) => {
        const p = parseISODate(s.date);
        return h('li', null, h('a', {
          class: ['up-row', `up-${chipKind(s)}`], href: `#schedule/${s.date}`,
          onclick: () => { scrollToSession = s.id; if (location.hash === `#schedule/${s.date}`) { selected = s.date; rerender(); } },
        },
        h('span', { class: 'up-date only-mob', 'aria-hidden': 'true' }, h('span', null, weekdayName(s.date).slice(0, 3)), h('b', null, String(p.d)), h('span', null, MONTHS[p.m - 1].slice(0, 3))),
        h('span', { class: 'up-body' },
          h('span', { class: 'only-desk' }, upTag(s)),
          h('span', { class: 'up-title' }, splitTitle(s.title).main),
          h('span', { class: 'up-meta only-desk' }, `${formatShort(s.date)} · ${timeText(s)}`),
          h('span', { class: 'up-meta only-mob' },
            h('span', null, icon('clock', { size: 18, stroke: 1.7 }), timeText(s)),
            h('span', null, icon(s.participants.length > 1 ? 'users' : 'user', { size: 18, stroke: 1.7 }), withText(s)))),
        icon('chevron', { size: 20, cls: 'chev' })));
      }))
      : h('p', { class: 'muted' }, 'Nothing else planned for you.'));

  // ---- key dates
  const exam = wsDoc?.examDate;
  const c = examCountdown(exam, today);
  const keyDays = sortSessions(visibleSessions(state.sessions).filter((s) => s.date >= today && ['rest', 'practice'].includes(s.type)
    && involves(s, me) && s.status !== 'cancelled'));
  const keyCard = h('section', { class: 'card key-card', 'aria-labelledby': 'key-h', 'data-test': 'key-dates' },
    h('div', { class: 'card-head' }, h('div', { class: 'card-head-text' }, h('h2', { class: 'card-title', id: 'key-h' }, 'Key Dates'))),
    h('ul', { class: 'key-list' },
      exam && h('li', null, h('a', { class: 'key-row', href: `#schedule/${exam}` },
        dualIcon('d-square', 'calendar', { size: 26, stroke: 1.8, cls: 'key-icon' }),
        h('span', { class: 'grow' }, h('b', null, `${wsDoc.moduleCode || 'COS330'} Exam`), h('span', { class: 'muted' }, `${formatShort(exam)}, ${wsDoc.examStart}`)),
        c.kind === 'future' && pill(c.days === 1 ? '1 day left' : `${c.days} days left`, 'terra', { class: 'pill-lg' }),
        c.kind === 'today' && pill('Today', 'terra', { class: 'pill-lg' }))),
      keyDays.map((s) => h('li', null, h('a', { class: 'key-row', href: `#schedule/${s.date}` },
        dualIcon('d-square', 'calendar', { size: 26, stroke: 1.8, cls: 'key-icon' }),
        h('span', { class: 'grow' }, h('b', null, splitTitle(s.title).main), h('span', { class: 'muted' }, `${formatShort(s.date)} · ${s.type === 'rest' ? 'Rest' : 'Practice'}`)))))));

  root.append(h('div', { class: 'sched-layout' },
    h('div', { class: 'sched-main' }, weekCard, thisWeek, day),
    h('div', { class: 'sched-side' }, upcomingCard, keyCard)));

  requestAnimationFrame(() => {
    if (scrollToSession) {
      document.getElementById(`session-${scrollToSession}`)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      scrollToSession = null;
    }
  });
}
