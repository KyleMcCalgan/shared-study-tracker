// Today: countdown, Kyle vs David, your checklist, then what's next.
import { h, emptyState, secHead, avatar } from '../ui.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { PROFILES, PROFILE_IDS } from '../config.js';
import {
  sessionsOn, involves, computeStats, overdueSessions, nextSharedSession, upcomingSpecialDays,
  davidQueueStatus, sortDiscussions, activeTopics, getProgress, taskItemId, isChecked,
} from '../model.js';
import {
  todayISO, formatShort, examCountdown, relativeDay, formatTimestamp, weekdayName, parseISODate,
} from '../date-utils.js';
import { sessionCard, sessionMenu } from './session-card.js';
import * as actions from '../actions.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function renderDashboard(root) {
  const today = todayISO();
  const me = state.profile;
  const ws = state.workspace;
  const todays = sessionsOn(state.sessions, today);
  const mine = todays.filter((s) => involves(s, me));
  const countdown = examCountdown(ws?.examDate, today);
  const p = parseISODate(today);

  // ---- hero
  let count;
  if (countdown.kind === 'future') count = h('div', { class: 'hero-count' }, h('span', { class: 'hero-num' }, String(countdown.days)), h('span', { class: 'hero-unit' }, countdown.days === 1 ? 'day to' : 'days to', h('br'), 'the exam'));
  else if (countdown.kind === 'today') count = h('p', { class: 'hero-big' }, 'Exam day');
  else if (countdown.kind === 'passed') count = h('p', { class: 'hero-big' }, 'Exam done');
  else count = h('p', { class: 'hero-big' }, `Hi ${PROFILES[me].name}`);
  root.append(h('section', null,
    h('div', { class: 'hero' }, count,
      h('p', { class: 'hero-date' }, weekdayName(today), h('strong', null, `${p.d} ${MONTHS[p.m - 1]}`))),
    countdown.kind === 'today' && h('p', { class: 'hero-goal' }, `${ws.examStart}–${ws.examEnd} · arrive 14:30`),
    ws?.dayGoals?.[today] && h('p', { class: 'hero-goal' }, ws.dayGoals[today])));

  // ---- Kyle vs David
  const topics = activeTopics(state.topics);
  root.append(h('section', { 'aria-label': 'Progress' }, h('div', { class: 'duo' }, PROFILE_IDS.map((pid) => {
    const st = computeStats(state.topics, state.progressById, pid);
    const q = pid === 'david' ? davidQueueStatus(ws?.davidQueue, state.checksById) : null;
    return h('a', { class: ['duo-card', `duo-${pid}`], href: '#topics', 'aria-label': `${PROFILES[pid].name}: ${st.firstPass} of ${st.total} chapters through first pass, ${st.inProgress} in progress` },
      h('span', { class: 'duo-name' }, PROFILES[pid].name, pid === me && h('span', { class: 'duo-you' }, 'You')),
      h('span', { class: 'duo-num' }, String(st.firstPass), h('small', null, `/${st.total}`)),
      h('span', { class: 'segbar', 'aria-hidden': 'true' }, topics.map((t) => h('i', { class: `st-${getProgress(state.progressById, pid, t.id).status}` }))),
      h('span', { class: 'duo-sub' }, 'through first pass',
        st.inProgress ? h('br') : null, st.inProgress ? `${st.inProgress} in progress` : null,
        q && q.items.length ? h('br') : null, q && q.items.length ? `Queue ${q.doneCount} of ${q.items.length}` : null));
  }))));

  // ---- your day
  const plan = h('section', null, secHead('Your day'));
  if (!mine.length) {
    const next = nextStudyFor(me, today);
    plan.append(emptyState('Nothing planned today', next ? `Next up: ${formatShort(next.date)} · ${next.title}` : 'Check the schedule for what\'s next.'));
  } else {
    mine.forEach((s) => plan.append(sessionCard(s)));
  }
  root.append(plan);

  // ---- catch-up: past sessions nobody marked
  const overdue = overdueSessions(state.sessions, today, me);
  if (overdue.length) {
    root.append(h('section', null, secHead('Still to mark'),
      h('div', { class: 'card' }, h('p', { class: 'small muted', style: 'margin-bottom:.3rem' }, 'Past sessions are never marked automatically. Did they happen?'),
        h('div', { class: 'list-rows' }, overdue.map((s) => h('div', { class: 'list-row' },
          h('div', { class: 'grow' }, h('b', null, s.title), h('span', { class: 'small muted' }, `${formatShort(s.date)} · ${s.participants.length > 1 ? 'Together' : PROFILES[s.participants[0]].name}`)),
          h('button', { class: 'btn btn-sm btn-primary', onclick: () => actions.setSessionStatus(s, 'completed'), 'aria-label': `Mark ${s.title} done` }, 'Done'),
          h('button', { class: 'icon-btn', 'aria-label': `More for ${s.title}`, onclick: () => sessionMenu(s, true) }, icon('more'))))))));
  }

  // ---- next together
  const next = nextSharedSession(state.sessions, today);
  if (next) {
    root.append(h('section', null, secHead('Next together', { href: `#schedule/${next.date}`, label: relativeDay(next.date, today) }),
      sessionCard(next, { compact: true, showDate: true })));
  }

  // ---- partner's day
  const other = PROFILE_IDS.find((x) => x !== me);
  const theirs = todays.filter((s) => s.participants.length === 1 && s.participants[0] === other);
  if (theirs.length) {
    root.append(h('section', null, secHead(`${PROFILES[other].name} today`),
      h('div', { class: 'card' }, h('div', { class: 'list-rows' }, theirs.map((s) => {
        const done = (s.tasks || []).filter((t) => isChecked(state.checksById, other, taskItemId(s, t))).length;
        return h('a', { class: 'list-row', href: `#schedule/${s.date}` }, avatar(other),
          h('div', { class: 'grow' }, h('b', null, s.title), h('span', { class: 'small muted' }, s.type === 'rest' ? 'Rest' : `${done} of ${(s.tasks || []).length} tasks`)),
          icon('chevron', { size: 18 }));
      })))));
  }

  // ---- discussions
  const open = sortDiscussions(state.discussions.filter((d) => d.status === 'open'));
  root.append(h('section', null, secHead('To discuss', { href: '#discuss', label: `${open.length} open` }),
    open.length
      ? h('div', { class: 'card' }, h('div', { class: 'list-rows' }, open.slice(0, 3).map((d) => h('a', { class: 'list-row', href: '#discuss' },
        h('div', { class: 'grow' }, h('b', null, d.title), d.priority === 'high' && h('span', { class: 'small', style: 'color:var(--danger);font-weight:750' }, 'High priority')),
        icon('chevron', { size: 18 })))))
      : h('p', { class: 'muted' }, 'Nothing waiting.')));

  // ---- special days
  const special = upcomingSpecialDays(state.sessions, today).filter((s) => s.date > today);
  if (special.length) {
    root.append(h('section', null, secHead('Coming up'),
      h('div', { class: 'special-row' }, special.map((s) => h('a', { class: ['special', `special-${s.type}`], href: `#schedule/${s.date}` },
        h('span', { class: 'eyebrow' }, formatShort(s.date)),
        h('b', null, { rest: 'Rest', buffer: 'Buffer', practice: 'Practice', exam: 'Exam' }[s.type]),
        h('span', { class: 'small muted' }, s.participants.length > 1 ? 'Together' : PROFILES[s.participants[0]].name))))));
  }

  // ---- activity
  if (state.activity.length) {
    root.append(h('section', null, secHead('Recent activity'),
      h('div', { class: 'card' }, h('ul', { class: 'list-rows activity' }, state.activity.slice(0, 6).map((a) => h('li', { class: 'list-row' },
        PROFILES[a.profileId] ? avatar(a.profileId, 'xs') : null,
        h('span', { class: 'grow small' }, a.text),
        h('time', { class: 'small muted' }, formatTimestamp(a.createdAt))))))));
  }
}

function nextStudyFor(profileId, today) {
  return state.sessions.filter((s) => !s.archived && s.date > today && involves(s, profileId) && !['rest', 'other'].includes(s.type))
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
}
