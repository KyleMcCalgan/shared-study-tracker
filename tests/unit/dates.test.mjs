import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseISODate, isValidISODate, addDays, diffDays, weekdayName, startOfWeek, todayISO, formatLong, formatShort,
  examCountdown, relativeDay, isValidTime,
} from '../../website/js/date-utils.js';

test('valid and invalid calendar dates', () => {
  assert.ok(isValidISODate('2026-11-21'));
  assert.ok(isValidISODate('2028-02-29')); // leap year
  for (const bad of ['2026-02-29', '2026-11-31', '2026-13-01', '2026-00-10', '2026-1-5', '21/11/2026', '', null, '2026-11-21T00:00']) {
    assert.equal(isValidISODate(bad), false, String(bad));
  }
  assert.deepEqual(parseISODate('2026-11-05'), { y: 2026, m: 11, d: 5 });
});

test('arithmetic across month and year boundaries', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(diffDays('2026-11-13', '2026-11-21'), 8);
  assert.equal(diffDays('2026-12-30', '2027-01-02'), 3);
});

test('weekday names match the schedule', () => {
  assert.equal(weekdayName('2026-11-12'), 'Thursday');
  assert.equal(weekdayName('2026-11-14'), 'Saturday');
  assert.equal(weekdayName('2026-11-21'), 'Saturday');
  assert.equal(startOfWeek('2026-11-15'), '2026-11-09'); // Sunday → previous Monday
  assert.equal(startOfWeek('2026-11-16'), '2026-11-16');
  assert.equal(formatLong('2026-11-21'), 'Saturday 21 November 2026');
  assert.equal(formatShort('2026-11-13'), 'Fri 13 Nov');
});

test('today in Johannesburg, not UTC', () => {
  // 23:30 UTC on 12 Nov is 01:30 on 13 Nov in Johannesburg (UTC+2)
  assert.equal(todayISO(new Date('2026-11-12T23:30:00Z')), '2026-11-13');
  // 21:59 UTC is 23:59 local, still the 12th
  assert.equal(todayISO(new Date('2026-11-12T21:59:00Z')), '2026-11-12');
  // New Year boundary
  assert.equal(todayISO(new Date('2026-12-31T22:30:00Z')), '2027-01-01');
});

test('exam countdown never goes negative (F18)', () => {
  assert.deepEqual(examCountdown('2026-11-21', '2026-11-13'), { kind: 'future', days: 8, label: '8 days until the exam' });
  assert.equal(examCountdown('2026-11-21', '2026-11-20').label, '1 day until the exam');
  assert.equal(examCountdown('2026-11-21', '2026-11-21').label, 'Exam today');
  assert.deepEqual(examCountdown('2026-11-21', '2026-11-25'), { kind: 'passed', days: -4, label: 'Exam date passed' });
  assert.equal(examCountdown(null, '2026-11-13').kind, 'none');
  assert.equal(examCountdown('TBD', '2026-11-13').kind, 'none');
});

test('relative days and times', () => {
  assert.equal(relativeDay('2026-11-13', '2026-11-13'), 'Today');
  assert.equal(relativeDay('2026-11-15', '2026-11-13'), 'In 2 days');
  assert.equal(relativeDay('2026-11-12', '2026-11-13'), 'Yesterday');
  assert.ok(isValidTime('15:00'));
  assert.ok(!isValidTime('24:00'));
  assert.ok(!isValidTime('9:00'));
});
