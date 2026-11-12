// Today dashboard (default view).
import {
  h, section, emptyState, progressBar, personChip, progressBadge,
} from '../ui.js';
import { state } from '../store.js';
import { PROFILES, PROFILE_IDS, DISCUSSION_KINDS } from '../config.js';
import {
  sessionsOn, involves, computeStats, overdueSessions, nextSharedSession, upcomingSpecialDays,
  sessionsAhead, davidQueueStatus, exampleStats, sortDiscussions, activeTopics, getProgress,
} from '../model.js';
import {
  todayISO, formatLong, formatShort, examCountdown, relativeDay, formatTimestamp,
} from '../date-utils.js';
import { sessionCard } from './session-card.js';

export function renderDashboard(root) {
  const today = todayISO();
  const me = state.profile;
  const ws = state.workspace;
  const todays = sessionsOn(state.sessions, today);
  const mine = todays.filter((s) => involves(s, me));
  const others = todays.filter((s) => !involves(s, me));
  const countdown = examCountdown(ws?.examDate, today);

  // ---- hero: date, profile, countdown, day goal
  root.append(h('section', { class: 'hero' },
    h('p', { class: 'hero-date' }, formatLong(today)),
    h('h1', { class: 'hero-title' }, `Hi ${PROFILES[me].name}`),
    countdown.kind !== 'none' && h('p', { class: ['countdown', `countdown-${countdown.kind}`] },
      h('strong', null, countdown.label),
      countdown.kind !== 'passed' && h('span', { class: 'muted' }, ` · ${formatShort(ws.examDate)}, ${ws.examStart}–${ws.examEnd}`)),
    ws?.dayGoals?.[today] && h('p', { class: 'hero-goal' }, h('span', { class: 'muted' }, 'Today\'s goal: '), ws.dayGoals[today])));

  // ---- today's plan
  const plan = section('Your plan today');
  if (!mine.length) {
    plan.append(emptyState('No study scheduled today', 'Nothing is planned for you today. Check the schedule for what\'s next.', '☀️'));
  } else {
    if (mine.every((s) => s.type === 'rest')) plan.append(h('p', { class: 'rest-banner' }, '🌿 Rest day. No required work today.'));
    mine.forEach((s) => plan.append(sessionCard(s)));
  }
  root.append(plan);

  // ---- next shared session
  const next = nextSharedSession(state.sessions, today);
  root.append(section('Next shared session',
    next
      ? h('div', null, h('p', { class: 'muted small' }, `${relativeDay(next.date, today)} · ${formatLong(next.date)}`), sessionCard(next, { compact: true }),
        h('a', { class: 'link-more', href: `#schedule/${next.date}` }, 'Open in schedule →'))
      : emptyState('No upcoming joint sessions', 'Add one from the Schedule tab if you plan to meet.')));

  // ---- other participant today
  if (others.length) {
    const other = PROFILE_IDS.find((p) => p !== me);
    root.append(section(`${PROFILES[other].name}'s plan today`, others.map((s) => sessionCard(s, { compact: true }))));
  }

  // ---- progress side by side
  const topics = activeTopics(state.topics);
  const progress = section('Progress (all 12 examinable chapters)');
  const grid = h('div', { class: 'compare' });
  for (const p of PROFILE_IDS) {
    const st = computeStats(state.topics, state.progressById, p);
    const ex = exampleStats(state.topics, state.checksById, p);
    const ahead = sessionsAhead(state.sessions, today, p);
    grid.append(h('div', { class: ['compare-col', `col-${p}`] },
      h('div', { class: 'compare-head' }, personChip(p), p === me && h('span', { class: 'muted small' }, '(you)')),
      h('p', { class: 'kpi' }, h('span', { class: 'kpi-num' }, `${st.firstPass}/${st.total}`), h('span', { class: 'kpi-label' }, 'first pass done')),
      progressBar(st.firstPass, st.total, `${PROFILES[p].name}: ${st.firstPass} of ${st.total} chapters with first pass completed`, p),
      h('ul', { class: 'kpi-list' },
        h('li', null, `${st.inProgress} in progress · ${st.counts.needs_practice} need practice · ${st.examReady} exam ready`),
        h('li', null, `Technical examples: ${ex.done}/${ex.total}`),
        h('li', null, `Study sessions ahead: ${ahead}`)),
      p === 'david' && queueSummary()));
  }
  progress.append(grid);
  const strip = h('div', { class: 'chapter-strip', role: 'list', 'aria-label': 'Chapter status overview' });
  for (const t of topics) {
    strip.append(h('a', { class: 'strip-cell', href: `#topics/${t.id}`, role: 'listitem' },
      h('span', { class: 'strip-ch' }, `Ch ${t.chapter}`),
      PROFILE_IDS.map((p) => {
        const s = getProgress(state.progressById, p, t.id).status;
        return h('span', { class: ['strip-dot', `st-${s}`, `who-${p}`], title: `${PROFILES[p].name}: ${s.replace('_', ' ')}` },
          PROFILES[p].initial, h('span', { class: 'sr-only' }, `${PROFILES[p].name} ${s.replace('_', ' ')}`));
      })));
  }
  progress.append(h('p', { class: 'muted small' }, 'Per chapter: K = Kyle, D = David. Colour and text show status (open a chapter for details).'), strip);
  root.append(progress);

  // ---- needs attention: unmarked past sessions
  const overdue = overdueSessions(state.sessions, today, me);
  root.append(section('Past sessions not yet marked',
    overdue.length
      ? h('div', null, h('p', { class: 'muted small' }, 'Mark these done or missed, or reschedule them. Nothing is marked automatically.'),
        overdue.map((s) => sessionCard(s, { showDate: true })))
      : h('p', { class: 'muted' }, 'All caught up. No unmarked past sessions.')));

  // ---- discussion queue
  const open = sortDiscussions(state.discussions.filter((d) => d.status === 'open'));
  root.append(section(`Discussion queue (${open.length} open)`,
    open.length
      ? h('ul', { class: 'disc-mini' }, open.slice(0, 4).map((d) => h('li', null,
        d.priority === 'high' && h('span', { class: 'badge badge-high' }, 'High'), ' ',
        h('a', { href: '#discuss' }, d.title),
        h('span', { class: 'muted small' }, ` · ${DISCUSSION_KINDS.find((k) => k.id === d.kind)?.label ?? ''}`))))
      : h('p', { class: 'muted' }, 'Nothing waiting. Raise questions from the Topics or Discuss tabs.'),
    h('a', { class: 'link-more', href: '#discuss' }, 'Open discussions →')));

  // ---- upcoming special days
  const special = upcomingSpecialDays(state.sessions, today).filter((s) => s.date !== today).slice(0, 6);
  root.append(section('Coming up: rest, buffer, practice and exam',
    special.length
      ? h('ul', { class: 'special-list' }, special.map((s) => h('li', null,
        h('span', { class: ['dot', `type-${s.type}`], 'aria-hidden': 'true' }),
        h('strong', null, formatShort(s.date)), ` · ${s.title} `,
        h('span', { class: 'muted small' }, `(${s.participants.map((p) => PROFILES[p].name).join(' + ')})`))))
      : h('p', { class: 'muted' }, 'Nothing special coming up.')));

  // ---- recent activity
  root.append(section('Recent activity',
    state.activity.length
      ? h('ul', { class: 'activity' }, state.activity.slice(0, 12).map((a) => h('li', null,
        h('span', { class: ['mini', `mini-${a.profileId}`] }, PROFILES[a.profileId]?.initial ?? '?'),
        h('span', null, a.text),
        h('time', { class: 'muted small' }, formatTimestamp(a.createdAt)))))
      : h('p', { class: 'muted' }, 'No activity yet. Updates from either of you will appear here live.')));
}

function queueSummary() {
  const q = davidQueueStatus(state.workspace?.davidQueue, state.checksById);
  if (!q.items.length) return null;
  return h('p', { class: 'small queue-sum' },
    `Queue: ${q.doneCount}/${q.items.length} items (${q.doneHours}/${q.totalHours} h)`,
    q.next ? h('span', { class: 'muted' }, ` · next: ${q.next.code} ${q.next.item.split(':')[0]}`) : ' · complete',
    ' ', h('a', { href: '#topics/queue' }, 'View queue'));
}

export { progressBadge };
