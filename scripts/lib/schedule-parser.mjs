// Parser for the COS330 shared study schedule (docs/source-schedule.md).
//
// It is deliberately written against the real structure of the supplied
// Markdown (section numbers, table headers, bullet conventions). If any
// expected section, table or pattern is missing it throws a descriptive error
// instead of silently dropping data (spec §9.2).
//
// Output is a plain object; see scripts/parse-schedule.mjs for file writing.

import { createHash } from 'node:crypto';
import {
  isValidISODate, toISODate, weekdayIndex,
} from '../../website/js/date-utils.js';
import { WORKSPACE_ID, SCHEMA_VERSION, PROFILE_IDS } from '../../website/js/config.js';

export class ParseError extends Error {}

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

// ---------------------------------------------------------------- helpers

/** Remove Markdown emphasis/code markers, keep the words exactly. */
export function clean(s) {
  return String(s ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*\w])\*([^*\n]+?)\*(?=[^*\w]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sha256(text) { return createHash('sha256').update(text, 'utf8').digest('hex'); }

/** Chapter numbers mentioned as "Ch 5", "Ch 1–5", "Ch 6–13", "Ch 11 part B". Ch 12 excluded via `allowed`. */
export function chaptersIn(text, allowed) {
  const found = new Set();
  const re = /\bCh\s?(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?/g;
  let m;
  while ((m = re.exec(text))) {
    const a = Number(m[1]); const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) found.add(n);
  }
  return [...found].filter((n) => !allowed || allowed.includes(n)).sort((x, y) => x - y);
}

export function topicIdFor(ch) { return `ch${String(ch).padStart(2, '0')}`; }

function splitRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function isSeparatorRow(cells) { return cells.every((c) => /^:?-{3,}:?$/.test(c) || c === ''); }

/** Parse the first table found at/after `fromLine` (0-based) within [fromLine, toLine). */
function parseTable(lines, fromLine, toLine, expectHeaderStartsWith) {
  for (let i = fromLine; i < toLine; i++) {
    const cells = splitRow(lines[i]);
    if (!cells) continue;
    if (expectHeaderStartsWith && !clean(cells[0]).startsWith(expectHeaderStartsWith)) continue;
    const sep = splitRow(lines[i + 1] ?? '');
    if (!sep || !isSeparatorRow(sep)) continue;
    const header = cells.map(clean);
    const rows = [];
    let j = i + 2;
    for (; j < toLine; j++) {
      const r = splitRow(lines[j]);
      if (!r) break;
      rows.push({ cells: r, line: j + 1 });
    }
    return { header, rows, headerLine: i + 1, endLine: j };
  }
  throw new ParseError(`Expected a table${expectHeaderStartsWith ? ` starting with "${expectHeaderStartsWith}"` : ''} between lines ${fromLine + 1}-${toLine}`);
}

// ---------------------------------------------------------------- parser

export function parseSchedule(markdown, { sourceFilename = 'source-schedule.md', importedAt = new Date().toISOString() } = {}) {
  const text = markdown.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const warnings = [];
  const assumptions = [];
  const ambiguities = [];

  // ---- section index: "## 12. PRACTICE AND REVISION PLAN" / "### 9.3 Thursday ..."
  const headings = [];
  lines.forEach((l, i) => {
    const m = /^(#{1,3})\s+(.*)$/.exec(l);
    if (m) headings.push({ level: m[1].length, text: m[2].trim(), line: i });
  });
  function section(prefix, level = 2) {
    const idx = headings.findIndex((h) => h.level === level && h.text.startsWith(prefix));
    if (idx < 0) throw new ParseError(`Missing section heading "${'#'.repeat(level)} ${prefix}"`);
    const h = headings[idx];
    const next = headings.slice(idx + 1).find((x) => x.level <= level);
    return { start: h.line, end: next ? next.line : lines.length, title: h.text };
  }

  // ---- exam header (line 3) and Section 1 table must agree
  const headerMatch = /Final exam:\s*(\w+day) (\d{1,2}) (\w+) (\d{4}), (\d{2}:\d{2})[–-](\d{2}:\d{2})/.exec(text);
  if (!headerMatch) throw new ParseError('Could not find "Final exam: <weekday> <d> <Month> <yyyy>, HH:MM–HH:MM" line');
  const examMonth = MONTH_NAMES.indexOf(headerMatch[3]) + 1;
  if (examMonth < 1) throw new ParseError(`Unknown month "${headerMatch[3]}" in exam line`);
  const examYear = Number(headerMatch[4]);
  const examDate = toISODate(examYear, examMonth, Number(headerMatch[2]));
  if (!isValidISODate(examDate)) throw new ParseError(`Exam date ${examDate} is not a valid date`);
  const examWeekdayName = headerMatch[1];
  if (['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekdayIndex(examDate)] !== examWeekdayName) {
    throw new ParseError(`Exam weekday "${examWeekdayName}" does not match ${examDate}`);
  }
  const examStart = headerMatch[5];
  const examEnd = headerMatch[6];
  const headerLineNo = lines.findIndex((l) => l.includes('Final exam:')) + 1;
  const versionMatch = /VERSION (\d+)/.exec(lines[0]);
  const revisedMatch = /revised (\w+ \d{1,2} \w+ \d{4})/.exec(text);

  const s1 = section('1. EXAMINATION OVERVIEW');
  const overviewTable = parseTable(lines, s1.start, s1.end, 'Item');
  const exam = {};
  for (const r of overviewTable.rows) exam[clean(r.cells[0])] = { detail: clean(r.cells[1]), source: clean(r.cells[2]), line: r.line };
  for (const key of ['Module', 'Date and time', 'Scope', 'Format', 'Venue', 'Marks', 'Marks rule']) {
    if (!exam[key]) throw new ParseError(`Section 1 table is missing row "${key}"`);
  }
  const dtCell = exam['Date and time'].detail;
  const dt = /(\w{3}) (\d{1,2}) (\w{3}) (\d{4}), (\d{2}:\d{2})[–-](\d{2}:\d{2})/.exec(dtCell);
  if (!dt || Number(dt[2]) !== Number(headerMatch[2]) || dt[5] !== examStart || dt[6] !== examEnd) {
    throw new ParseError(`Exam date/time in header and Section 1 disagree: "${headerMatch[0]}" vs "${dtCell}"`);
  }
  const moduleCode = (/^([A-Z]{3}\d{3})/.exec(exam.Module.detail) || [])[1];
  if (!moduleCode) throw new ParseError('Could not read module code from Section 1');

  /** Resolve "Fri 13" style references inside the schedule's month/year, checking the weekday. */
  function resolveDay(dow, day, where) {
    const iso = toISODate(examYear, examMonth, Number(day));
    if (!isValidISODate(iso)) throw new ParseError(`Invalid day "${dow} ${day}" (${where})`);
    if (DOW[dow] === undefined) throw new ParseError(`Unknown weekday "${dow}" (${where})`);
    if (weekdayIndex(iso) !== DOW[dow]) throw new ParseError(`"${dow} ${day}" does not fall on a ${dow} in ${MONTH_NAMES[examMonth - 1]} ${examYear} (${where})`);
    return iso;
  }

  // ---- scope: "Chapters 1–11 and 13. Chapter 12 excluded."
  const scopeText = exam.Scope.detail;
  const scopeRange = /Chapters (\d+)[–-](\d+) and (\d+)/.exec(scopeText);
  if (!scopeRange) throw new ParseError(`Could not read chapter scope from "${scopeText}"`);
  const examinable = [];
  for (let n = Number(scopeRange[1]); n <= Number(scopeRange[2]); n++) examinable.push(n);
  examinable.push(Number(scopeRange[3]));
  const excludedMatch = /Chapter (\d+) excluded/.exec(scopeText);
  const excludedChapters = excludedMatch ? [Number(excludedMatch[1])] : [];

  // ---- Section 3.1 chapter groups
  const s31 = section('3.1', 3);
  const groupTable = parseTable(lines, s31.start, s31.end, 'Step');
  const groups = groupTable.rows.map((r) => {
    const cell = r.cells[1];
    const name = clean(cell.replace(/\*\*[^*]+\*\*/, ''));
    const chapters = chaptersIn(clean(cell), examinable);
    if (!chapters.length) throw new ParseError(`Section 3.1 row at line ${r.line} has no chapters`);
    return { id: `step-${clean(r.cells[0])}`, step: Number(clean(r.cells[0])), name, chapters, reason: clean(r.cells[2]), line: r.line };
  });

  // ---- Section 4.2 workload per chapter
  const s42 = section('4.2', 3);
  const workTable = parseTable(lines, s42.start, s42.end, 'Ch');
  const workload = {};
  for (const r of workTable.rows) {
    const c = clean(r.cells[0]);
    if (!/^\d+$/.test(c)) continue; // skip Total row
    workload[Number(c)] = {
      slides: Number(clean(r.cells[1])),
      complexity: Number(clean(r.cells[2])),
      exampleMinutes: Number(clean(r.cells[3])),
      fullHours: Number(clean(r.cells[4])),
      mustHours: Number(clean(r.cells[5])),
      shouldHours: Number(clean(r.cells[6])),
      line: r.line,
    };
  }

  // ---- Section 13.1 chapter tracker (authoritative chapter titles)
  const s131 = section('13.1', 3);
  const chapTable = parseTable(lines, s131.start, s131.end, 'Ch');
  const topics = [];
  const jointPlanByChapter = {};
  for (const r of chapTable.rows) {
    const ch = Number(clean(r.cells[0]));
    const [title, kyleTarget, davidTarget, kyleStatus, davidStatus, jointPlanned] = r.cells.slice(1).map(clean);
    if (!examinable.includes(ch)) throw new ParseError(`Tracker row for non-examinable chapter ${ch} at line ${r.line}`);
    for (const [who, st] of [['Kyle', kyleStatus], ['David', davidStatus]]) {
      if (st !== 'Not started') {
        warnings.push(`Section 13.1 line ${r.line}: ${who} status for Ch ${ch} is "${st}". Progress is NOT seeded from the schedule; record it in the app if confirmed.`);
      }
    }
    const group = groups.find((g) => g.chapters.includes(ch));
    const w = workload[ch];
    if (!w) throw new ParseError(`Section 4.2 has no workload row for Ch ${ch}`);
    jointPlanByChapter[ch] = jointPlanned.split(',').map((s) => s.trim()).filter(Boolean);
    topics.push({
      id: topicIdFor(ch),
      chapter: ch,
      title,
      group: group ? group.name : null,
      groupStep: group ? group.step : null,
      order: ch,
      description: '',
      slides: w.slides,
      complexity: w.complexity,
      hours: { full: w.fullHours, must: w.mustHours, should: w.shouldHours },
      targets: { kyle: kyleTarget, david: davidTarget },
      jointPlanned: jointPlanByChapter[ch],
      examples: [],
      sourceRef: `docs/source-schedule.md#L${r.line}`,
      imported: true,
      archived: false,
    });
  }
  for (const ch of examinable) {
    if (!topics.find((t) => t.chapter === ch)) throw new ParseError(`Examinable chapter ${ch} has no row in Section 13.1`);
  }
  topics.sort((a, b) => a.order - b.order);
  const topicIds = topics.map((t) => t.id);

  // ---- Section 13.3 technical examples → per-topic checklists
  const s133 = section('13.3', 3);
  const exTable = parseTable(lines, s133.start, s133.end, 'Ch');
  const exCount = {};
  for (const r of exTable.rows) {
    const ch = Number(clean(r.cells[0]));
    const topic = topics.find((t) => t.chapter === ch);
    if (!topic) throw new ParseError(`Technical example for unknown chapter ${ch} (line ${r.line})`);
    exCount[ch] = (exCount[ch] || 0) + 1;
    const davidCell = clean(r.cells[3]).replace('☐', '').trim();
    topic.examples.push({
      id: `ex-${topic.id}-${exCount[ch]}`,
      text: clean(r.cells[1]),
      davidNote: davidCell.replace(/[()]/g, '') || null,
      line: r.line,
    });
  }

  // ---- Section 7.1 David's queue
  const s71 = section('7.1', 3);
  const qTable = parseTable(lines, s71.start, s71.end, '#');
  const davidQueue = [];
  for (const r of qTable.rows) {
    const code = clean(r.cells[0]);
    if (!/^Q\d+$/.test(code)) continue; // Total row
    const item = clean(r.cells[1]);
    const depth = clean(r.cells[2]);
    davidQueue.push({
      id: `q${code.slice(1).padStart(2, '0')}`,
      code,
      item,
      depth,
      hours: Number(clean(r.cells[3])),
      topicIds: chaptersIn(item, examinable).map(topicIdFor),
      line: r.line,
    });
  }
  if (davidQueue.length === 0) throw new ParseError('David queue (7.1) is empty');
  const queueTotal = Math.round(davidQueue.reduce((a, q) => a + q.hours, 0) * 100) / 100;
  const queueTotalRow = qTable.rows.find((r) => /Total/.test(clean(r.cells[1])));
  if (queueTotalRow && Number(clean(queueTotalRow.cells[3])) !== queueTotal) {
    warnings.push(`David queue hours sum to ${queueTotal} h but the Total row says ${clean(queueTotalRow.cells[3])} h`);
  }

  // ---- Section 5 overview table: per-day titles for Kyle/David and main goals
  const s5 = section('5. CHRONOLOGICAL SCHEDULE');
  const ovTable = parseTable(lines, s5.start, s5.end, 'Date');
  const overview = {};
  for (const r of ovTable.rows) {
    const m = /(\w{3}) (\d{1,2})/.exec(clean(r.cells[0]));
    if (!m) throw new ParseError(`Bad date cell in overview at line ${r.line}`);
    const date = resolveDay(m[1], m[2], `overview line ${r.line}`);
    overview[date] = {
      kyle: clean(r.cells[1]), david: clean(r.cells[2]), joint: clean(r.cells[3]), goal: clean(r.cells[4]), line: r.line,
    };
  }
  const noStudyLine = lines.findIndex((l, i) => i > s5.start && i < s5.end && /no study \(agreed\)/i.test(l));
  const noStudyMatch = noStudyLine >= 0 ? /(\w{3}) (\d{1,2}) Nov: no study/.exec(lines[noStudyLine]) : null;

  // ---- sessions
  const sessions = [];
  const usedIds = new Set();
  function addSession(s) {
    let id = s.id; let n = 2;
    while (usedIds.has(id)) id = `${s.id}-${n++}`;
    usedIds.add(id);
    const full = {
      id,
      date: s.date,
      sourceDate: s.date,
      startTime: s.startTime ?? null,
      endTime: s.endTime ?? null,
      timeLabel: s.timeLabel ?? null,
      durationLabel: s.durationLabel ?? null,
      type: s.type,
      code: s.code ?? null,
      title: s.title,
      participants: s.participants,
      topicIds: (s.topicIds ?? []).filter((t) => topicIds.includes(t)),
      optional: Boolean(s.optional),
      tasks: s.tasks ?? [],
      outcome: s.outcome ?? null,
      notes: (s.notes ?? []).filter(Boolean).join('\n'),
      goal: overview[s.date]?.goal ?? null,
      sourceRef: `docs/source-schedule.md#L${s.line}`,
      sourceSection: s.section,
      imported: true,
      archived: false,
      status: 'planned',
      statusReason: '',
      userNotes: '',
      rescheduledFrom: null,
    };
    sessions.push(full);
    return full;
  }
  const tc = (cnt, tier) => { cnt[tier] = (cnt[tier] || 0) + 1; return `${tier.toLowerCase()}-${cnt[tier]}`; };
  function stripTrailingParen(s) {
    const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(s);
    return m ? { main: m[1].trim(), paren: m[2].trim() } : { main: s.trim(), paren: null };
  }

  // Thu 12 (or whatever the schedule says): no study day for both
  if (noStudyMatch) {
    const date = resolveDay(noStudyMatch[1], noStudyMatch[2], `line ${noStudyLine + 1}`);
    addSession({
      id: `${date}-no-study`, date, type: 'rest', title: 'No study day (agreed)', participants: [...PROFILE_IDS],
      notes: ['The schedule starts the following day (Section 2, item 1).'], line: noStudyLine + 1, section: '§5 overview',
    });
  } else {
    warnings.push('No "no study (agreed)" line found in Section 5.');
  }

  // ---- Section 6: Kyle's daily assignments
  const s6 = section('6. KYLE');
  const kyleDays = headings.filter((h) => h.level === 3 && h.line > s6.start && h.line < s6.end);
  if (!kyleDays.length) throw new ParseError('Section 6 has no day headings');
  const kyleStudyDates = [];
  for (let k = 0; k < kyleDays.length; k++) {
    const h = kyleDays[k];
    const end = k + 1 < kyleDays.length ? kyleDays[k + 1].line : s6.end;
    const hm = /^(\w{3}) (\d{1,2}) Nov\s+—\s+(.*)$/.exec(h.text);
    if (!hm) throw new ParseError(`Unrecognised Kyle day heading at line ${h.line + 1}: "${h.text}"`);
    const date = resolveDay(hm[1], hm[2], `line ${h.line + 1}`);
    const headingRest = hm[3];
    const body = lines.slice(h.line + 1, end);
    if (/REST DAY/i.test(headingRest)) {
      const s8 = section('8. PROTECTED');
      const restNotes = lines.slice(s8.start + 1, s8.end).filter((l) => l.startsWith('- ')).map((l) => clean(l.slice(2)));
      addSession({
        id: `${date}-kyle-golf-rest`, date, type: 'rest', title: 'Protected golf / rest day',
        participants: ['kyle'], notes: [body.map(clean).filter(Boolean).join(' '), ...restNotes], line: h.line + 1, section: '§6 / §8',
      });
      continue;
    }
    kyleStudyDates.push(date);
    const { main: rawTitle, paren: durationLabel } = stripTrailingParen(clean(headingRest));
    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    const tasks = []; const notes = []; const cnt = {};
    let outcome = null; let jointNote = null;
    const bufferTasks = [];
    for (let i = 0; i < body.length; i++) {
      const raw = body[i];
      const lineNo = h.line + 2 + i;
      if (!raw.trim() || /^-{3,}$/.test(raw.trim())) continue;
      let m;
      if ((m = /^- \*\*(MUST|SHOULD|COULD)\*\*\s+(.*)$/.exec(raw))) {
        const hrs = /\s+—\s+([\d.]+) h$/.exec(m[2]);
        const textPart = clean(hrs ? m[2].slice(0, hrs.index) : m[2]);
        const task = { id: tc(cnt, m[1]), tier: m[1], text: textPart, hours: hrs ? Number(hrs[1]) : null, line: lineNo };
        if (!hrs) warnings.push(`Kyle ${date} ${m[1]} task at line ${lineNo} has no hour estimate`);
        // Thursday's SHOULD "deepening" is the schedule's explicit catch-up buffer (Section 11.1).
        if (m[1] === 'SHOULD' && /^deepening/i.test(textPart)) bufferTasks.push(task);
        else tasks.push(task);
      } else if ((m = /^- \*\*Outcome:\*\*\s*(.*)$/.exec(raw))) {
        outcome = clean(m[1]);
      } else if ((m = /^- \*\*Joint \(optional\):\*\*\s*(.*)$/.exec(raw))) {
        jointNote = `Joint (optional): ${clean(m[1])}`;
      } else if (raw.startsWith('- ')) {
        throw new ParseError(`Unrecognised bullet in Kyle's ${date} section at line ${lineNo}: ${raw.slice(0, 80)}`);
      } else {
        notes.push(clean(raw));
      }
    }
    if (!tasks.length) throw new ParseError(`Kyle's ${date} section has no tasks`);
    const ov = overview[date];
    if (!ov) throw new ParseError(`Overview table has no row for ${date}`);
    if (jointNote) notes.push(jointNote);
    notes.push('This day\'s SHOULD slot doubles as the catch-up block: if behind, spend it on unfinished MUST items first (Section 6 intro).');
    addSession({
      id: `${date}-kyle-study`, date, type: 'individual', title, durationLabel,
      participants: ['kyle'], topicIds: chaptersIn(ov.kyle, examinable).map(topicIdFor),
      tasks, outcome, notes, line: h.line + 1, section: `§6 ${hm[1]} ${hm[2]} Nov`,
    });
    if (bufferTasks.length) {
      const hours = bufferTasks.reduce((a, t) => a + (t.hours || 0), 0);
      addSession({
        id: `${date}-kyle-deepening-buffer`, date, type: 'buffer', title: 'SHOULD deepening / catch-up time',
        durationLabel: `${hours} h`, participants: ['kyle'], tasks: bufferTasks,
        notes: [
          'Catch-up uses each day\'s SHOULD slot, a +0.5 h extension (cap 6 h) and Thursday\'s deepening time, in that order (Section 11.1).',
          'If either student is fatigued, reduce Kyle\'s SHOULD deepening first (Section 9.3 rule 4).',
        ],
        line: bufferTasks[0].line, section: `§6 ${hm[1]} ${hm[2]} Nov (SHOULD) / §11.1`,
      });
    }
  }

  // ---- Section 7.2: David's daily expectations
  const s72 = section('7.2', 3);
  const davidStarts = [];
  for (let i = s72.start + 1; i < s72.end; i++) {
    const m = /^\*\*(\w{3}) (\d{1,2}) Nov(?: \(([^)]*)\))?:\*\*\s*(.*)$/.exec(lines[i]);
    if (m) davidStarts.push({ i, m });
  }
  if (!davidStarts.length) throw new ParseError('Section 7.2 has no day paragraphs');
  const queueById = Object.fromEntries(davidQueue.map((q) => [q.code, q]));
  for (let k = 0; k < davidStarts.length; k++) {
    const { i, m } = davidStarts[k];
    const end = k + 1 < davidStarts.length ? davidStarts[k + 1].i : s72.end;
    const date = resolveDay(m[1], m[2], `line ${i + 1}`);
    const paren = m[3] || null;
    const lead = clean(m[4]);
    const ov = overview[date];
    if (!ov) throw new ParseError(`Overview table has no row for ${date}`);
    const tasks = []; const notes = []; const cnt = {};
    const eveningTasks = [];
    if (lead) notes.push(lead);
    for (let j = i + 1; j < end; j++) {
      const raw = lines[j]; const lineNo = j + 1;
      if (!raw.trim() || /^-{3,}$/.test(raw.trim())) continue;
      let b;
      if ((b = /^- \*\*(MUST|SHOULD|COULD)\*\*\s+(.*)$/.exec(raw))) {
        let rest = b[2];
        let condition = null;
        const cond = /^\(([^)]*)\):\s*(.*)$/.exec(rest);
        if (cond) { condition = cond[1]; rest = cond[2]; }
        const hrs = /\s+—\s+([\d.]+) h\.?$/.exec(rest);
        const textPart = clean(hrs ? rest.slice(0, hrs.index) : rest);
        const q = /^(Q\d+)\b/.exec(textPart);
        const task = {
          id: q ? q[1].toLowerCase() : tc(cnt, b[1]), tier: b[1], text: textPart, hours: hrs ? Number(hrs[1]) : null,
          condition, line: lineNo,
        };
        if (q) {
          if (!queueById[q[1]]) throw new ParseError(`David task at line ${lineNo} references unknown queue item ${q[1]}`);
          task.checkItemId = queueById[q[1]].id; // ticking this task ticks the queue item
        }
        if (!hrs) {
          const approx = /—\s*(about [^;]+?h[^;]*)/.exec(rest);
          task.hoursLabel = approx ? clean(approx[1]) : null;
        }
        if (condition && /evening/i.test(condition)) eveningTasks.push(task);
        else tasks.push(task);
      } else if ((b = /^- \*\*(T\d+) \(([\d.]+) h\):\*\*\s*(.*)$/.exec(raw))) {
        tasks.push({ id: b[1].toLowerCase(), tier: 'BLOCK', code: b[1], text: clean(b[3]), hours: Number(b[2]), line: lineNo });
      } else if ((b = /^- \*([^*]+):\*\s*(.*)$/.exec(raw))) {
        notes.push(`${clean(b[1])}: ${clean(b[2])}`);
      } else if (raw.startsWith('- ')) {
        notes.push(clean(raw.slice(2)));
      } else {
        notes.push(clean(raw));
      }
    }
    const base = { date, participants: ['david'], line: i + 1, section: `§7.2 ${m[1]} ${m[2]} Nov` };
    const { main: ovTitle, paren: ovParen } = stripTrailingParen(ov.david.replace(/\s*Evening .*$/, ''));
    if (/other exam/i.test(lead)) {
      addSession({
        ...base, id: `${date}-david-other-exam`, type: 'other', title: 'Other exam — no COS330 by day',
        notes, timeLabel: 'Daytime',
      });
      if (eveningTasks.length) {
        const evOv = /Evening (.*)$/.exec(ov.david);
        addSession({
          ...base, id: `${date}-david-evening`, type: 'individual', optional: true,
          title: evOv ? `Evening (optional): ${clean(evOv[1]).replace(/^S [\d.]+ h optional:\s*/, '')}` : 'Evening (optional)',
          timeLabel: 'Evening, only if rested', durationLabel: evOv ? clean(evOv[1]).match(/S [\d.]+ h/)?.[0] ?? null : null,
          topicIds: chaptersIn(ov.david.replace(/^.*Evening/, ''), examinable).map(topicIdFor),
          tasks: eveningTasks, notes: [],
        });
      }
      continue;
    }
    const optional = /no COS330 required/i.test(paren || '') || /no COS330 required/i.test(ov.david);
    let title = ovTitle;
    if (optional) {
      const opt = /optional:\s*([^,)]+)/.exec(ov.david);
      title = opt ? `Optional: ${clean(opt[1])}` : 'Optional COS330 study';
    }
    if (/^Next outstanding queue items/.test(title)) assumptions.push(`David's ${date} session topics are taken from the overview ("${ov.david}"); actual work depends on his queue position (Section 9.3).`);
    addSession({
      ...base, id: `${date}-david-study`, type: 'individual', optional, title,
      durationLabel: paren || ovParen,
      topicIds: chaptersIn(ov.david, examinable).map(topicIdFor), tasks, notes,
    });
  }

  // ---- Section 9.1 joint sessions
  const s91 = section('9.1', 3);
  const jTable = parseTable(lines, s91.start, s91.end, '#');
  const s92 = section('9.2', 3);
  const formatTable = parseTable(lines, s92.start, s92.end, 'Part');
  const jointFormat = {
    intro: clean(lines.slice(s92.start + 1, formatTable.headerLine - 1).join(' ')),
    parts: formatTable.rows.map((r) => ({ part: clean(r.cells[0]), short: clean(r.cells[1]), long: clean(r.cells[2]) })),
  };
  const s93 = section('9.3', 3);
  const thuTable = parseTable(lines, s93.start, s93.end, 'Block');
  const thuRulesStart = lines.findIndex((l, idx) => idx > s93.start && /Thursday adjustment rules/.test(l));
  const thuRules = [];
  for (let idx = thuRulesStart + 1; idx < s93.end && thuRulesStart > 0; idx++) {
    const rm = /^\d+\.\s+(.*)$/.exec(lines[idx]);
    if (rm) thuRules.push(clean(rm[1]));
  }
  const thuNotes = [clean(lines[s93.start + 2] || '')];
  const s121 = section('12.1', 3);
  const pTable = parseTable(lines, s121.start, s121.end, 'Block');
  const pBlocks = pTable.rows.map((r) => {
    const label = clean(r.cells[0]);
    const pm = /^(P\d+)\s+(.*)$/.exec(label);
    return pm
      ? { code: pm[1], name: pm[2], duration: clean(r.cells[1]), mode: clean(r.cells[2]), text: clean(r.cells[3]), line: r.line }
      : { code: null, name: label, duration: clean(r.cells[1]), mode: clean(r.cells[2]), text: clean(r.cells[3]), line: r.line };
  });

  for (const r of jTable.rows) {
    const code = clean(r.cells[0]);
    const when = clean(r.cells[1]);
    const length = clean(r.cells[2]);
    const topicsText = clean(r.cells[3]);
    const wm = /^(\w{3}) (\d{1,2})(?:\s+(\w+))?/.exec(when);
    if (!wm) throw new ParseError(`Bad "When" cell for ${code} at line ${r.line}`);
    const date = resolveDay(wm[1], wm[2], `line ${r.line}`);
    const timeLabel = wm[3] ? wm[3][0].toUpperCase() + wm[3].slice(1) : null;
    const optional = /optional/i.test(length);
    const fromTracker = Object.entries(jointPlanByChapter)
      .filter(([, codes]) => codes.some((c) => c === code || c.startsWith(`${code}-`)))
      .map(([ch]) => topicIdFor(Number(ch)));
    const tIds = [...new Set([...chaptersIn(topicsText, examinable).map(topicIdFor), ...fromTracker])].sort();
    const notes = [];
    let tasks = [];
    let title = `${code}: ${topicsText}`;
    if (/See 9\.3/.test(topicsText)) {
      title = `${code}: Main joint day (adaptive block plan)`;
      tasks = thuTable.rows.filter((tr) => /Joint/.test(clean(tr.cells[0]))).map((tr) => {
        const bc = /^(T\d+)/.exec(clean(tr.cells[0]))[1];
        return {
          id: bc.toLowerCase(), tier: 'BLOCK', code: bc, durationLabel: clean(tr.cells[1]),
          text: `${clean(tr.cells[3])} — David: ${clean(tr.cells[2])}`, line: tr.line,
        };
      });
      notes.push(...thuNotes, 'Full day: T1 independent 2 h · T2 joint 45 min · lunch 45 min · T3 independent 2 h · break 15 min · T4 independent 1 h 15 min · T5 joint 60 min · break 15 min · T6 joint 45 min (Section 9.3).');
      thuRules.forEach((rule, n) => notes.push(`Adjustment rule ${n + 1}: ${rule}`));
    } else if (/Section 12/.test(topicsText)) {
      title = `${code}: Marking and rapid-fire (practice day)`;
      tasks = pBlocks.filter((b) => b.code && /Joint/i.test(b.mode)).map((b) => ({
        id: b.code.toLowerCase(), tier: 'BLOCK', code: b.code, durationLabel: b.duration, text: `${b.name}: ${b.text}`, line: b.line,
      }));
    }
    addSession({
      id: `${date}-joint-${code.toLowerCase()}`, date, type: 'joint', code, title, timeLabel, durationLabel: length,
      participants: [...PROFILE_IDS], optional, topicIds: tIds, tasks, notes, line: r.line, section: '§9.1',
    });
  }

  // ---- Fri practice day (Section 12.1)
  const practiceDayMatch = /^(\w+) (\d{1,2}) November/.exec(s121.title.replace(/^12\.1\s+/, ''));
  if (!practiceDayMatch) throw new ParseError(`Cannot read practice-day date from "${s121.title}"`);
  const practiceDate = resolveDay(practiceDayMatch[1].slice(0, 3), practiceDayMatch[2], s121.title);
  const pIntro = clean(lines.slice(s121.start + 1, pTable.headerLine - 1).join(' '));
  const pAfter = lines.slice(pTable.endLine, s121.end).map(clean).filter(Boolean);
  const order = pBlocks.map((b) => (b.code ? `${b.code}${/Joint/i.test(b.mode) ? ' (joint, J6)' : ''}` : `${b.name.toLowerCase()} ${b.duration}`)).join(' → ');
  addSession({
    id: `${practiceDate}-practice`, date: practiceDate, type: 'practice', title: 'Practice and revision only',
    durationLabel: '≈6 h active, ≈6 h 50 min elapsed', participants: [...PROFILE_IDS],
    tasks: pBlocks.filter((b) => b.code && !/Joint/i.test(b.mode)).map((b) => ({
      id: b.code.toLowerCase(), tier: 'BLOCK', code: b.code, durationLabel: b.duration, text: `${b.name} (${b.mode}): ${b.text}`, line: b.line,
    })),
    notes: [pIntro, `Block order: ${order}.`, ...pAfter], line: s121.start + 1, section: '§12.1',
  });

  // ---- Exam day (Section 12.2)
  const s122 = section('12.2', 3);
  const examDayLines = lines.slice(s122.start + 1, s122.end);
  const revTasks = []; const examNotes = []; const revNotes = [];
  let inMorning = false;
  examDayLines.forEach((l, idx) => {
    const lineNo = s122.start + 2 + idx;
    if (/^- \*\*Morning:\*\*/.test(l)) { inMorning = true; revNotes.push(clean(l.slice(2))); return; }
    const sub = /^\s{2,}- (.*)$/.exec(l);
    if (sub && inMorning) {
      const dm = /^(\d+ min):\s*(.*)$/.exec(sub[1]);
      revTasks.push({ id: `rev-${revTasks.length + 1}`, tier: 'BLOCK', durationLabel: dm ? dm[1] : null, text: clean(dm ? dm[2] : sub[1]).replace(/;$/, ''), line: lineNo });
      return;
    }
    if (l.startsWith('- ')) {
      inMorning = false;
      if (/^- \*\*Do not:\*\*/.test(l)) revNotes.push(clean(l.slice(2)));
      else examNotes.push(clean(l.slice(2)));
    }
  });
  addSession({
    id: `${examDate}-revision`, date: examDate, type: 'practice', title: 'Light revision, finished by midday',
    timeLabel: 'Morning', durationLabel: '60–75 min', participants: [...PROFILE_IDS], tasks: revTasks, notes: revNotes,
    line: s122.start + 1, section: '§12.2',
  });
  addSession({
    id: `${examDate}-exam`, date: examDate, type: 'exam', title: `${moduleCode} final exam`,
    startTime: examStart, endTime: examEnd, timeLabel: `${examStart}–${examEnd}`, durationLabel: '3 h',
    participants: [...PROFILE_IDS], topicIds,
    notes: [`Venue: ${exam.Venue.detail}`, `Format: ${exam.Format.detail}`, `Marks: ${exam.Marks.detail}`, ...examNotes],
    line: headerLineNo, section: '§1 / §12.2',
  });

  // ---- Section 14: open questions → seeded discussions
  const s14 = section('14. OUTSTANDING');
  const oqHeader = lines.findIndex((l, idx) => idx > s14.start && idx < s14.end && /^\| Open questions/.test(l));
  const discussions = [];
  if (oqHeader >= 0) {
    const oq = parseTable(lines, oqHeader, s14.end, 'Open questions');
    oq.rows.forEach((r, n) => {
      const title = clean(r.cells[0]);
      if (!title) return;
      const chText = clean(r.cells[1]);
      const ids = chaptersIn(`Ch ${chText.replace(/,\s*/g, ', Ch ')}`, examinable).map(topicIdFor);
      discussions.push({
        id: `schedule-question-${n + 1}`, title, topicIds: ids, raisedBy: null, kind: 'question', status: 'open', priority: 'normal',
        notes: '', sessionId: null, sourceDateAdded: clean(r.cells[2]), imported: true, sourceRef: `docs/source-schedule.md#L${r.line}`,
      });
    });
  }
  for (const label of ['Topics Kyle finds difficult', 'Topics David finds difficult', 'Topics both need to revisit']) {
    const at = lines.findIndex((l, idx) => idx > s14.start && idx < s14.end && l.startsWith(`| ${label}`));
    if (at < 0) { warnings.push(`Section 14 table "${label}" not found`); continue; }
    const t = parseTable(lines, at, s14.end, label);
    const filled = t.rows.filter((r) => clean(r.cells[0]));
    if (filled.length) warnings.push(`Section 14 "${label}" has ${filled.length} entries that are not imported automatically; add them in the Discuss tab.`);
  }

  // ---- protected dates (Sections 8, 11.1, 12.1, 12.2, 7.2)
  const restSession = sessions.find((s) => s.type === 'rest' && s.participants.includes('kyle') && s.participants.length === 1);
  const protectedDates = [];
  if (restSession) protectedDates.push({ date: restSession.date, appliesTo: [...PROFILE_IDS], reason: 'Protected golf / rest day. Never used to recover lost time; nobody schedules a Saturday catch-up (Sections 8 and 11.1). Weather swap with Sun 15 is allowed (Section 8).' });
  protectedDates.push({ date: practiceDate, appliesTo: [...PROFILE_IDS], reason: 'Practice and revision only. Never used to recover lost time; no first-time chapter learning (Sections 11.1 and 12.1).' });
  protectedDates.push({ date: examDate, appliesTo: [...PROFILE_IDS], reason: 'Exam day. Light revision only, finished by midday; do not start new material (Section 12.2).' });
  const otherExam = sessions.find((s) => s.type === 'other' && s.participants.includes('david'));
  if (otherExam) protectedDates.push({ date: otherExam.date, appliesTo: ['david'], reason: 'David\'s other exam. No COS330 by day; evening only if rested (Section 7.2).' });
  if (noStudyMatch) {
    const d = resolveDay(noStudyMatch[1], noStudyMatch[2], 'no-study');
    protectedDates.push({ date: d, appliesTo: [...PROFILE_IDS], reason: 'Agreed no-study day (Section 2, item 1).' });
  }
  protectedDates.sort((a, b) => (a.date < b.date ? -1 : 1));

  // ---- day goals from overview
  const dayGoals = Object.fromEntries(Object.entries(overview).map(([d, o]) => [d, o.goal]));

  // ---- recovery rules for the reschedule dialog (Section 11.1)
  const s111 = section('11.1', 3);
  const recoveryRules = lines.slice(s111.start + 1, s111.end).filter((l) => l.startsWith('- ')).map((l) => clean(l.slice(2)));

  // ---- assumptions/ambiguities that the importer itself introduces
  assumptions.push(
    `Module code "${moduleCode}" comes from the schedule. The specification text says "COS326"; the schedule is authoritative for course facts (spec §3.2), so the workspace ID is "${WORKSPACE_ID}".`,
    'Dates such as "Fri 13" are resolved within the exam month and year and checked against the weekday; all matched.',
    'No clock times are given for study or joint sessions (Section 9: "No clock times are set"). They show as "All day / unscheduled time" unless the schedule gives a phrase such as "evening" or "morning". Only the exam has clock times.',
    'Kyle\'s Thursday SHOULD "deepening" block is imported as a separate buffer session, because Section 11.1 names Thursday\'s deepening time as the catch-up reserve.',
    'Practice-day blocks P4 and P6 are joint, so they sit in the J6 session; P1, P2, P3 and P5 sit in the practice session.',
    'J5 topics come from the Section 13.1 "Joint discussion planned" column (J5-T2/T5/T6), because Section 9.1 says only "See 9.3".',
    'David\'s session tasks that name a queue item (Q1–Q16) share one checkbox with that queue item, so ticking either updates both.',
    'Section 14 open questions are imported as Discuss items with raisedBy = "From schedule". Neither Kyle nor David is named as their author.',
    'No progress is seeded. Every chapter starts as "Not started" for both, as Section 2 item 8 and Section 13 state.',
    'The course knowledge map is not imported. The schedule says it does not use its priority section (Section 2, item 7).',
  );
  ambiguities.push(
    'Weather swap (Section 8): golf may move from Sat 14 to Sun 15, with Sunday\'s tasks done on Saturday. This is not automated; use Reschedule on both sessions if it happens.',
    'David\'s daily hours before 18 Nov are suggestions and assumptions, not commitments (Sections 2.5 and 7). Missing them is not shown as a failure.',
    'Thu 19 is adaptive: the schedule says not to lock it until the evening of 18 Nov (Section 9.3). The imported blocks are the default template.',
    'Mock questions and memo for Fri 20 are "not generated yet" (Section 12.1). The tracker does not contain them.',
  );

  const sourceHash = sha256(text);
  const workspace = {
    title: `${moduleCode} Shared Study Tracker`,
    moduleCode,
    moduleName: exam.Module.detail,
    timezone: 'Africa/Johannesburg',
    participants: [...PROFILE_IDS],
    examDate,
    examStart,
    examEnd,
    examVenue: exam.Venue.detail,
    examFormat: exam.Format.detail,
    examMarks: exam.Marks.detail,
    examMarksRule: exam['Marks rule'].detail,
    scope: scopeText,
    examinableChapters: examinable,
    excludedChapters,
    sourceScheduleFilename: sourceFilename,
    sourceVersion: versionMatch ? versionMatch[1] : null,
    sourceRevised: revisedMatch ? revisedMatch[1] : null,
    sourceHash,
    schemaVersion: SCHEMA_VERSION,
    protectedDates,
    dayGoals,
    davidQueue,
    queueTotalHours: queueTotal,
    groups: groups.map(({ line, ...g }) => g),
    jointFormat,
    recoveryRules,
    tierNote: clean(lines.find((l) => l.startsWith('**Evidence labels.**')) || '').replace(/^Evidence labels\.\s*/, ''),
  };

  sessions.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));

  return {
    seed: {
      schemaVersion: SCHEMA_VERSION,
      workspaceId: WORKSPACE_ID,
      sourceFile: 'docs/source-schedule.md',
      sourceScheduleFilename: sourceFilename,
      sourceHash,
      importedAt,
      workspace,
      topics: topics.map((t) => ({ ...t, examples: t.examples.map(({ line, ...e }) => ({ ...e, sourceRef: `docs/source-schedule.md#L${line}` })) })),
      sessions: sessions.map((s) => ({ ...s, tasks: s.tasks.map(({ line, ...t }) => ({ ...t, sourceRef: `docs/source-schedule.md#L${line}` })) })),
      discussions,
    },
    report: { warnings, assumptions, ambiguities, examinable, excludedChapters, kyleStudyDates },
  };
}
