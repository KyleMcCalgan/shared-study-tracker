import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  computeStats, getProgress, overdueSessions, nextSharedSession, matchesFilter, checkReschedule, davidQueueStatus,
  sortDiscussions, validateSessionInput, validateDiscussionInput, taskItemId, bufferSlots, protectedReasons, exampleStats,
} from '../../website/js/model.js';

const seed = JSON.parse(readFileSync(new URL('../../data/seed-schedule.json', import.meta.url), 'utf8'));
const { topics, sessions, workspace } = seed;

test('stats use all 12 syllabus topics as denominator; missing progress = not started', () => {
  const st = computeStats(topics, {}, 'kyle');
  assert.equal(st.total, 12);
  assert.equal(st.firstPass, 0);
  assert.equal(st.notStarted, 12);
  const progress = {
    kyle__ch01: { status: 'completed' }, kyle__ch02: { status: 'exam_ready' }, kyle__ch03: { status: 'in_progress' },
    david__ch01: { status: 'needs_practice' }, kyle__ch04: { status: 'garbage' },
  };
  const k = computeStats(topics, progress, 'kyle');
  assert.equal(k.firstPass, 2);
  assert.equal(k.inProgress, 1);
  assert.equal(k.notStarted, 9); // invalid status treated as not started
  assert.equal(k.pct, 17);
  const d = computeStats(topics, progress, 'david');
  assert.equal(d.firstPass, 1); // Kyle's progress does not leak into David's
  assert.equal(getProgress(progress, 'david', 'ch05').status, 'not_started');
});

test('overdue: only past planned study sessions for that profile, never rest/exam', () => {
  const od = overdueSessions(sessions, '2026-11-16', 'kyle').map((s) => s.id);
  assert.ok(od.includes('2026-11-13-kyle-study'));
  assert.ok(od.includes('2026-11-15-joint-j1'));
  assert.ok(!od.includes('2026-11-14-kyle-golf-rest'));
  assert.ok(!od.includes('2026-11-12-no-study'));
  assert.ok(!od.some((id) => id.includes('david-study')));
  const marked = sessions.map((s) => (s.id === '2026-11-13-kyle-study' ? { ...s, status: 'missed' } : s));
  assert.ok(!overdueSessions(marked, '2026-11-16', 'kyle').some((s) => s.id === '2026-11-13-kyle-study'));
});

test('next shared session and filters', () => {
  assert.equal(nextSharedSession(sessions, '2026-11-13').id, '2026-11-15-joint-j1');
  assert.equal(nextSharedSession(sessions, '2026-11-19').id, '2026-11-19-joint-j5');
  const j = sessions.find((s) => s.id === '2026-11-16-joint-j2');
  const rest = sessions.find((s) => s.id === '2026-11-14-kyle-golf-rest');
  assert.ok(matchesFilter(j, 'together') && matchesFilter(j, 'kyle') && matchesFilter(j, 'david'));
  assert.ok(matchesFilter(rest, 'restbuffer') && !matchesFilter(rest, 'david') && !matchesFilter(rest, 'together'));
});

test('reschedule guards: protected days warn, past/exam/after-exam blocked (F13/F14)', () => {
  const kyleMon = sessions.find((s) => s.id === '2026-11-16-kyle-study');
  const today = '2026-11-16';
  assert.equal(checkReschedule({ session: kyleMon, newDate: '2026-11-19', today, workspace }).ok, true);
  const toGolf = checkReschedule({ session: kyleMon, newDate: '2026-11-14', today: '2026-11-13', workspace });
  assert.ok(toGolf.ok && toGolf.warnings.length === 1 && /golf/i.test(toGolf.warnings[0]));
  const toPractice = checkReschedule({ session: kyleMon, newDate: '2026-11-20', today, workspace });
  assert.ok(toPractice.warnings.some((w) => /Practice and revision only/.test(w)));
  assert.equal(checkReschedule({ session: kyleMon, newDate: '2026-11-15', today, workspace }).ok, false); // past
  assert.equal(checkReschedule({ session: kyleMon, newDate: '2026-11-22', today, workspace }).ok, false); // after exam
  const exam = sessions.find((s) => s.type === 'exam');
  assert.equal(checkReschedule({ session: exam, newDate: '2026-11-20', today, workspace }).ok, false);
  // David's other exam day only warns for David's sessions
  const davidMon = sessions.find((s) => s.id === '2026-11-16-david-study');
  assert.equal(protectedReasons(workspace, '2026-11-18', davidMon.participants).length, 1);
  assert.equal(protectedReasons(workspace, '2026-11-18', kyleMon.participants).length, 0);
  assert.deepEqual(bufferSlots(sessions, '2026-11-16', ['kyle']).map((s) => s.id), ['2026-11-19-kyle-deepening-buffer']);
});

test('David queue status and shared task checkbox ids', () => {
  const checks = { david__q01: { done: true }, david__q02: { done: true }, david__q04: { done: true } };
  const q = davidQueueStatus(workspace.davidQueue, checks);
  assert.equal(q.doneCount, 3);
  assert.equal(q.next.code, 'Q3');
  assert.equal(q.lastDone.code, 'Q4');
  assert.equal(q.totalHours, 13.25);
  const fri = sessions.find((s) => s.id === '2026-11-13-david-study');
  assert.equal(taskItemId(fri, fri.tasks[0]), 'q01');
  assert.equal(taskItemId(fri, fri.tasks[2]), '2026-11-13-david-study--could-1');
  assert.deepEqual(exampleStats(topics, { kyle__ex_none: {} }, 'kyle'), { total: 13, done: 0 });
});

test('discussions sort open first, high priority first', () => {
  const list = [
    { id: 'a', status: 'discussed', priority: 'high', updatedAt: 5 },
    { id: 'b', status: 'open', priority: 'normal', updatedAt: 9 },
    { id: 'c', status: 'open', priority: 'high', updatedAt: 1 },
    { id: 'd', status: 'deferred', priority: 'normal', updatedAt: 3 },
  ];
  assert.deepEqual(sortDiscussions(list).map((d) => d.id), ['c', 'b', 'd', 'a']);
});

test('input validation', () => {
  const ok = { title: 'Extra', date: '2026-11-17', type: 'joint', participants: ['kyle', 'david'] };
  assert.deepEqual(validateSessionInput(ok), {});
  assert.ok(validateSessionInput({ ...ok, title: '' }).title);
  assert.ok(validateSessionInput({ ...ok, title: 'x'.repeat(161) }).title);
  assert.ok(validateSessionInput({ ...ok, date: '2026-02-30' }).date);
  assert.ok(validateSessionInput({ ...ok, participants: ['kyle'] }).participants);
  assert.ok(validateSessionInput({ ...ok, type: 'exam' }).type);
  assert.ok(validateSessionInput({ ...ok, startTime: '18:00', endTime: '17:00' }).endTime);
  const disc = { title: 'Q', kind: 'discuss', priority: 'normal', raisedBy: 'kyle', topicIds: ['ch01'] };
  assert.deepEqual(validateDiscussionInput(disc, ['ch01']), {});
  assert.ok(validateDiscussionInput({ ...disc, raisedBy: 'eve' }, ['ch01']).raisedBy);
  assert.ok(validateDiscussionInput({ ...disc, topicIds: ['ch12'] }, ['ch01']).topicIds);
});
