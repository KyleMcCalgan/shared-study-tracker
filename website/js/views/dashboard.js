// Today: exam countdown, today's tasks, progress, next session, discussions,
// then catch-up, the other person's day, key days and live activity.
import {
  h, card, bar, pill, avatar, chevronLink, emptyState, whoText,
} from '../ui.js';
import { icon, dualIcon, booksArt } from '../icons.js';
import { state } from '../store.js';
import { PROFILES, PROFILE_IDS } from '../config.js';
import {
  sessionsOn, involves, computeStats, overdueSessions, nextSharedSession, upcomingSpecialDays,
  davidQueueStatus, sortDiscussions, activeTopics, getProgress, taskItemId, isChecked, isFirstPassDone,
  visibleSessions, isStudySession, splitTitle,
} from '../model.js';
import {
  todayISO, formatShort, examCountdown, relativeDay, formatTimestamp, weekdayName, parseISODate, startOfWeek, addDays,
} from '../date-utils.js';
import {
  focusSession, sessionMenu, chaptersText, timeText, withText,
} from './session-card.js';
import * as actions from '../actions.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (iso) => { const p = parseISODate(iso); return `${weekdayName(iso).slice(0, 3)}, ${p.d} ${MONTHS[p.m - 1]}`; };

export function renderDashboard(root) {
  const today = todayISO();
  const me = state.profile;
  const grid = h('div', { class: 'dash-grid' });
  grid.append(
    examCard(today),
    focusCard(today, me),
    progressCard(me),
    nextSessionCard(today),
    discussionCard(),
    weeklyCard(today, me),
  );
  const extras = [overdueCard(today, me), partnerCard(today, me), comingUpCard(today), activityCard()].filter(Boolean);
  grid.append(...extras);
  root.append(grid);
}

// ---------------------------------------------------------------- exam

export function examCard(today) {
  const ws = state.workspace;
  const c = examCountdown(ws?.examDate, today);
  let big; let sub;
  if (c.kind === 'future') { big = c.days === 1 ? '1 day left' : `${c.days} days left`; sub = `${shortDay(ws.examDate)}, ${ws.examStart}`; }
  else if (c.kind === 'today') { big = 'Exam today'; sub = `${ws.examStart}–${ws.examEnd} · arrive 14:30`; }
  else if (c.kind === 'passed') { big = 'Exam done'; sub = shortDay(ws.examDate); }
  else { big = 'Date to confirm'; sub = 'Countdown begins when scheduled'; }
  return h('section', { class: 'card hero', 'aria-labelledby': 'exam-h', 'data-test': 'exam-countdown' },
    h('div', { class: 'hero-text' },
      h('div', { class: 'hero-head' }, dualIcon('d-square', 'calendar', { size: 28, stroke: 1.8, cls: 'hero-icon' }),
        h('h2', { class: 'hero-label', id: 'exam-h' }, `${ws?.moduleCode || 'COS330'} Exam`)),
      h('p', { class: 'hero-big' }, big),
      h('p', { class: 'hero-sub' }, sub),
      c.kind === 'today' && ws.examVenue && h('p', { class: 'hero-sub small' }, ws.examVenue)),
    booksArt('hero-art'));
}

// ---------------------------------------------------------------- today's tasks

function focusCard(today, me) {
  const ws = state.workspace;
  const mine = sessionsOn(state.sessions, today).filter((s) => involves(s, me) && s.type !== 'exam');
  const goal = ws?.dayGoals?.[today];
  const body = [];
  if (!mine.length) {
    const next = state.sessions.filter((s) => !s.archived && s.date > today && involves(s, me) && isStudySession(s))
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    body.push(h('p', { class: 'focus-empty' }, 'No study scheduled today.'),
      next && chevronLink(`#schedule/${next.date}`, `Next up: ${formatShort(next.date)}, ${next.title}`,
        h('span', { class: 'grow' }, h('span', { class: 'muted' }, 'Next up · '), `${formatShort(next.date)} · ${splitTitle(next.title).main}`)));
  } else {
    mine.forEach((s) => body.push(focusSession(s, { showTitle: mine.length > 1 })));
  }
  return card({
    cls: 'focus', title: "Today's Focus", id: 'focus', test: 'today-focus',
    sub: goal ? `Goal: ${goal}` : 'Your planned study tasks',
  }, body);
}

// ---------------------------------------------------------------- chapters

function chapterChips(me) {
  const topics = activeTopics(state.topics);
  const chips = [];
  let i = 0;
  // Runs of chapters already through first pass collapse into one ✓ chip.
  while (i < topics.length) {
    if (isFirstPassDone(getProgress(state.progressById, me, topics[i].id).status)) {
      let j = i;
      while (j + 1 < topics.length && isFirstPassDone(getProgress(state.progressById, me, topics[j + 1].id).status)) j++;
      const label = j > i ? `Ch ${topics[i].chapter} – ${topics[j].chapter}` : `Ch ${topics[i].chapter}`;
      chips.push({ done: true, label, href: `#topics/${topics[i].id}` });
      i = j + 1;
    } else {
      const st = getProgress(state.progressById, me, topics[i].id).status;
      chips.push({ done: false, prog: st === 'in_progress', label: `Ch ${topics[i].chapter}`, href: `#topics/${topics[i].id}` });
      i++;
    }
  }
  const shown = chips.length > 4 ? chips.slice(0, 3) : chips;
  const rest = chips.length - shown.length;
  return h('div', { class: 'ch-chips' },
    shown.map((c) => h('a', { class: ['ch-chip', c.done && 'is-done', c.prog && 'is-prog'], href: c.href },
      c.label, icon(c.done ? 'check' : c.prog ? 'progress' : 'd-discuss', { size: 17, stroke: c.done ? 2.4 : 1.6 }),
      h('span', { class: 'sr-only' }, c.done ? ' through first pass' : c.prog ? ' in progress' : ' not started'))),
    rest > 0 && h('a', { class: 'ch-chip ch-more', href: '#topics', 'aria-label': `${rest} more chapters` }, `+${rest}`));
}

function progressCard(me) {
  const other = PROFILE_IDS.find((p) => p !== me);
  const mineSt = computeStats(state.topics, state.progressById, me);
  const otherSt = computeStats(state.topics, state.progressById, other);
  const queueLine = (pid) => {
    if (pid !== 'david') return null;
    const q = davidQueueStatus(state.workspace?.davidQueue, state.checksById);
    return q.items.length ? `Queue ${q.doneCount} of ${q.items.length}` : null;
  };
  const extra = (st, pid) => [st.inProgress ? `${st.inProgress} in progress` : null, queueLine(pid)].filter(Boolean).join(' · ');
  return card({
    cls: 'progress-card', title: 'Chapter Progress', id: 'chapters', test: 'chapter-progress',
    meta: h('span', { class: 'muted' }, `${mineSt.firstPass} / ${mineSt.total} chapters`),
  },
  h('div', { class: 'who-progress', 'data-test': `progress-${me}`, 'data-done': mineSt.firstPass, 'data-total': mineSt.total },
    bar(mineSt.firstPass, mineSt.total, `${PROFILES[me].name}: ${mineSt.firstPass} of ${mineSt.total} chapters through first pass`, { cls: 'bar-lg' })),
  chapterChips(me),
  extra(mineSt, me) && h('p', { class: 'small muted' }, `You: ${extra(mineSt, me)}`),
  h('a', {
    class: 'partner-progress', href: '#topics', 'data-test': `progress-${other}`, 'data-done': otherSt.firstPass, 'data-total': otherSt.total,
  },
  h('span', { class: 'partner-name' }, PROFILES[other].name),
  bar(otherSt.firstPass, otherSt.total, `${PROFILES[other].name}: ${otherSt.firstPass} of ${otherSt.total} chapters through first pass`, { cls: 'bar-sm' }),
  h('span', { class: 'partner-num' }, `${otherSt.firstPass} / ${otherSt.total}`),
  extra(otherSt, other) && h('span', { class: 'partner-extra small muted' }, extra(otherSt, other))));
}

// ---------------------------------------------------------------- next session

function nextSessionCard(today) {
  const next = nextSharedSession(state.sessions, today);
  const iconEl = h('span', { class: 'card-icon icon-pink' }, dualIcon('d-square', 'calendar', { size: 26, stroke: 1.8 }));
  if (!next) {
    return card({ cls: 'next-card', title: 'Next Study Session', iconEl, id: 'next', test: 'next-session' },
      h('p', { class: 'next-when' }, 'No joint sessions left'), h('p', { class: 'muted' }, 'Everything planned together is done.'));
  }
  const day = relativeDay(next.date, today);
  const when = ['Today', 'Tomorrow'].includes(day) ? day : weekdayName(next.date);
  const time = timeText(next);
  const chapters = chaptersText(next.topicIds);
  return h('a', { class: 'card next-card card-link', href: `#schedule/${next.date}`, 'data-test': 'next-session', 'aria-label': `Next study session: ${when} ${formatShort(next.date)}, ${next.title}` },
    h('div', { class: 'card-head' }, iconEl, h('div', { class: 'card-head-text' }, h('h2', { class: 'card-title' }, 'Next Study Session')),
      icon('chevron', { size: 22, cls: 'chev only-mob' })),
    h('p', { class: 'next-when' }, `${when}, ${time === 'Any time' ? formatShort(next.date).slice(4) : time}`),
    h('p', { class: 'next-what muted' }, [withText(next).replace(/^With /, 'Study with '), next.code, chapters].filter(Boolean).join(' · ')));
}

// ---------------------------------------------------------------- discussions

function discussionCard() {
  const open = sortDiscussions(state.discussions.filter((d) => d.status === 'open'));
  const iconEl = h('span', { class: 'card-icon icon-green' }, dualIcon('phone', 'chat', { size: 26, stroke: 1.7 }));
  return h('section', { class: 'card disc-card', 'aria-labelledby': 'dq-h', 'data-test': 'discussion-queue' },
    h('a', { class: 'card-head card-head-link', href: '#discuss', 'aria-label': `Discussion queue: ${open.length} open` },
      iconEl,
      h('div', { class: 'card-head-text' }, h('h2', { class: 'card-title', id: 'dq-h' }, 'Discussion Queue')),
      h('span', { class: 'count-badge' }, String(open.length)),
      icon('chevron', { size: 22, cls: 'chev only-mob' })),
    open.length
      ? h('ul', { class: 'link-list' }, open.slice(0, 3).map((d) => h('li', null, chevronLink(`#discuss/${d.id}`, d.title,
        h('span', { class: 'grow' }, d.title, d.priority === 'high' && pill('High', 'terra'))))))
      : h('p', { class: 'muted' }, 'Nothing waiting. Add questions as they come up.'));
}

// ---------------------------------------------------------------- this week

function weeklyCard(today, me) {
  const start = startOfWeek(today);
  const end = addDays(start, 6);
  const week = visibleSessions(state.sessions).filter((s) => s.date >= start && s.date <= end && involves(s, me) && isStudySession(s) && s.status !== 'cancelled');
  const done = week.filter((s) => s.status === 'completed').length;
  const iconEl = h('span', { class: 'card-icon icon-green' }, dualIcon('bars', 'check', { size: 26, stroke: 1.6 }));
  return card({ cls: 'weekly-card', title: 'Weekly Progress', iconEl, id: 'weekly', test: 'weekly-progress' },
    h('div', { class: 'weekly-row' }, h('span', { class: 'muted' }, 'Sessions completed this week'),
      h('span', { class: 'weekly-num', 'data-done': done, 'data-total': week.length }, `${done} / ${week.length}`)),
    bar(done, week.length, `${done} of ${week.length} sessions completed this week`, { cls: 'bar-lg' }));
}

// ---------------------------------------------------------------- extras

function overdueCard(today, me) {
  const overdue = overdueSessions(state.sessions, today, me);
  if (!overdue.length) return null;
  return card({
    cls: 'overdue-card span-2', title: 'Still to mark', id: 'overdue', test: 'overdue', sub: 'Past sessions are never marked automatically. Did they happen?',
  },
  h('ul', { class: 'row-list' }, overdue.map((s) => h('li', { class: 'list-row' },
    h('div', { class: 'grow' }, h('b', null, splitTitle(s.title).main), h('span', { class: 'small muted' }, `${formatShort(s.date)} · ${s.participants.length > 1 ? 'Together' : PROFILES[s.participants[0]].name}`)),
    h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => actions.setSessionStatus(s, 'completed'), 'aria-label': `Mark ${s.title} done` }, 'Done'),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': `More for ${s.title}`, onclick: () => sessionMenu(s, true) }, icon('more'))))));
}

function partnerCard(today, me) {
  const other = PROFILE_IDS.find((x) => x !== me);
  const theirs = sessionsOn(state.sessions, today).filter((s) => s.participants.length === 1 && s.participants[0] === other);
  if (!theirs.length) return null;
  return card({ cls: 'partner-card', title: `${PROFILES[other].name} today`, id: 'partner', test: 'partner-today' },
    h('ul', { class: 'link-list' }, theirs.map((s) => {
      const done = (s.tasks || []).filter((t) => isChecked(state.checksById, other, taskItemId(s, t))).length;
      return h('li', null, chevronLink(`#schedule/${s.date}`, s.title, avatar(other, 'xs'),
        h('span', { class: 'grow' }, h('b', null, splitTitle(s.title).main),
          h('span', { class: 'small muted' }, s.type === 'rest' ? 'Rest' : s.type === 'other' ? (s.timeLabel || 'Other') : `${done} of ${(s.tasks || []).length} tasks`))));
    })));
}

function comingUpCard(today) {
  const special = upcomingSpecialDays(state.sessions, today).filter((s) => s.date > today);
  if (!special.length) return null;
  const kind = { rest: 'grey', buffer: 'grey', practice: 'pink', exam: 'terra' };
  return card({ cls: 'coming-card', title: 'Coming up', id: 'coming', test: 'coming-up', sub: 'Rest, buffer, practice and exam days' },
    h('ul', { class: 'link-list' }, special.map((s) => h('li', null, chevronLink(`#schedule/${s.date}`, `${formatShort(s.date)}: ${s.title}`,
      h('span', { class: 'date-chip' }, formatShort(s.date)),
      h('span', { class: 'grow' }, splitTitle(s.title).main, h('span', { class: 'small muted' }, whoText(s.participants))),
      pill({ rest: 'Rest', buffer: 'Buffer', practice: 'Practice', exam: 'Exam' }[s.type], kind[s.type]))))));
}

function activityCard() {
  if (!state.activity.length) return null;
  return card({ cls: 'activity-card span-2', title: 'Recent activity', id: 'activity', test: 'activity' },
    h('ul', { class: 'row-list activity' }, state.activity.slice(0, 6).map((a) => h('li', { class: 'list-row' },
      PROFILES[a.profileId] ? avatar(a.profileId, 'xs') : null,
      h('span', { class: 'grow' }, a.text),
      h('time', { class: 'small muted' }, formatTimestamp(a.createdAt))))));
}
