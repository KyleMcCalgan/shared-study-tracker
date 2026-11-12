import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSchedule, ParseError, chaptersIn, clean } from '../../scripts/lib/schedule-parser.mjs';
import { validateSeed } from '../../scripts/lib/validate.mjs';
import { planSeed, isNoop } from '../../scripts/lib/seed-plan.mjs';

const md = readFileSync(new URL('../../docs/source-schedule.md', import.meta.url), 'utf8');
const parse = () => parseSchedule(md, { sourceFilename: 'x.md', importedAt: '2026-11-12T00:00:00.000Z' });

test('parses the real schedule faithfully', () => {
  const { seed } = parse();
  const ws = seed.workspace;
  assert.equal(ws.moduleCode, 'COS330');
  assert.equal(ws.examDate, '2026-11-21');
  assert.equal(ws.examStart, '15:00');
  assert.equal(ws.examEnd, '18:00');
  assert.deepEqual(ws.excludedChapters, [12]);
  assert.deepEqual(seed.topics.map((t) => t.chapter), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13]);
  assert.equal(seed.topics.find((t) => t.id === 'ch05').title, 'Database and data centre security');
  assert.equal(seed.topics.reduce((a, t) => a + t.slides, 0), 520); // §4.1 total
  assert.equal(ws.davidQueue.length, 16);
  assert.equal(ws.queueTotalHours, 13.25);
  assert.equal(seed.topics.flatMap((t) => t.examples).length, 13);
});

test('session structure matches the source sections', () => {
  const { seed } = parse();
  const by = (id) => seed.sessions.find((s) => s.id === id);
  // Kyle: 6 study days (§6) + golf rest + Thu buffer
  assert.equal(seed.sessions.filter((s) => s.id.endsWith('-kyle-study')).length, 6);
  assert.equal(by('2026-11-14-kyle-golf-rest').type, 'rest');
  assert.equal(by('2026-11-19-kyle-deepening-buffer').type, 'buffer');
  assert.deepEqual(by('2026-11-13-kyle-study').tasks.map((t) => [t.tier, t.hours]), [['MUST', 1.5], ['MUST', 3], ['SHOULD', 1], ['COULD', 0.5]]);
  // David
  assert.equal(by('2026-11-14-david-study').optional, true);
  assert.equal(by('2026-11-18-david-other-exam').type, 'other');
  assert.equal(by('2026-11-18-david-evening').optional, true);
  assert.deepEqual(by('2026-11-19-david-study').tasks.map((t) => t.code), ['T1', 'T3', 'T4']);
  // Joint J1–J7 with optional flags from §9.1
  const joints = seed.sessions.filter((s) => s.type === 'joint').map((s) => [s.code, s.date, s.optional]);
  assert.deepEqual(joints, [
    ['J1', '2026-11-15', true], ['J2', '2026-11-16', true], ['J3', '2026-11-17', true], ['J4', '2026-11-18', true],
    ['J5', '2026-11-19', false], ['J6', '2026-11-20', false], ['J7', '2026-11-21', true],
  ]);
  assert.deepEqual(by('2026-11-20-joint-j6').tasks.map((t) => t.code), ['P4', 'P6']);
  assert.deepEqual(by('2026-11-20-practice').tasks.map((t) => t.code), ['P1', 'P2', 'P3', 'P5']);
  const exam = by('2026-11-21-exam');
  assert.equal(exam.startTime, '15:00');
  assert.equal(exam.endTime, '18:00');
  // no study sessions are invented on protected days
  assert.ok(!seed.sessions.some((s) => s.date === '2026-11-14' && s.participants.includes('kyle') && s.type !== 'rest'));
  assert.ok(!seed.sessions.some((s) => s.date === '2026-11-20' && s.type === 'individual'));
  // no clock times are invented
  assert.ok(seed.sessions.filter((s) => s.type !== 'exam').every((s) => s.startTime === null && s.endTime === null));
  // everything starts as planned, nothing pre-completed
  assert.ok(seed.sessions.every((s) => s.status === 'planned'));
});

test('parse is deterministic and the seed validates', () => {
  const a = parse(); const b = parse();
  assert.equal(JSON.stringify(a.seed), JSON.stringify(b.seed));
  assert.deepEqual(validateSeed(a.seed).errors, []);
  assert.equal(new Set(a.seed.sessions.map((s) => s.id)).size, a.seed.sessions.length);
});

test('committed seed matches the parser output', () => {
  const committed = JSON.parse(readFileSync(new URL('../../data/seed-schedule.json', import.meta.url), 'utf8'));
  const { seed } = parseSchedule(md, { sourceFilename: committed.sourceScheduleFilename, importedAt: committed.importedAt });
  assert.deepEqual(committed, JSON.parse(JSON.stringify(seed)));
});

test('fails loudly on a broken source instead of losing data', () => {
  assert.throws(() => parseSchedule(md.replace('## 6. KYLE', '## 6. SOMEONE')), ParseError);
  assert.throws(() => parseSchedule(md.replace('### Fri 13 Nov', '### Sat 13 Nov')), /does not fall on a Sat/);
  assert.throws(() => parseSchedule(md.replace('Final exam:', 'Exam:')), ParseError);
});

test('helpers', () => {
  assert.deepEqual(chaptersIn('Ch 6–13 and Ch 2 part B, CH13 S45', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13]), [2, 6, 7, 8, 9, 10, 11, 13]);
  assert.equal(clean('**MUST** Ch 1 *Example:* `GRANT`'), 'MUST Ch 1 Example: GRANT');
});

test('F20 seed plan is idempotent and preserves user changes', () => {
  const { seed } = parse();
  const empty = { workspace: null, topics: new Map(), sessions: new Map(), discussions: new Map() };
  const first = planSeed(seed, empty);
  assert.equal(first.sessions.create.length, seed.sessions.length);
  // simulate DB after first import, plus user changes
  const after = {
    workspace: { ...seed.workspace },
    topics: new Map(seed.topics.map((t) => [t.id, { ...t }])),
    sessions: new Map(seed.sessions.map((s) => [s.id, { ...s }])),
    discussions: new Map(seed.discussions.map((d) => [d.id, { ...d }])),
  };
  const moved = after.sessions.get('2026-11-16-kyle-study');
  Object.assign(moved, { date: '2026-11-19', status: 'planned', rescheduledFrom: '2026-11-16', userNotes: 'x' });
  after.discussions.get('schedule-question-1').status = 'discussed';
  const second = planSeed(seed, after);
  assert.ok(isNoop(second), 'second run must be a no-op');
  // a source change to a rescheduled session updates content but keeps the users' date
  const changed = JSON.parse(JSON.stringify(seed));
  const cs = changed.sessions.find((s) => s.id === '2026-11-16-kyle-study');
  cs.title = 'Ch 5 part B and Ch 6 (revised)';
  cs.sourceDate = '2026-11-17'; cs.date = '2026-11-17';
  const third = planSeed(changed, after);
  const upd = third.sessions.update.find((u) => u.id === '2026-11-16-kyle-study');
  assert.ok(upd.fields.includes('title'));
  assert.equal(upd.data.date, undefined);
  assert.equal(third.sessions.conflicts.length, 1);
  assert.ok(!('status' in upd.data) && !('userNotes' in upd.data));
});
