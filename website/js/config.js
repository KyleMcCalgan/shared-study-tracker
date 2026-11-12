// Shared constants for the website, the Node scripts and the tests.
// Keep these in sync with firestore.rules (tests/rules verify the pairing).

export const WORKSPACE_ID = 'cos330-2026';
export const SCHEMA_VERSION = 1;

export const REPO_URL = 'https://github.com/KyleMcCalgan/shared-study-tracker';
export const SOURCE_SCHEDULE_URL = `${REPO_URL}/blob/main/docs/source-schedule.md`;

export const PROFILES = {
  kyle: { id: 'kyle', name: 'Kyle', initial: 'K' },
  david: { id: 'david', name: 'David', initial: 'D' },
};
export const PROFILE_IDS = Object.keys(PROFILES);

// Progress statuses. The vocabulary comes from the schedule's tracker (Section 13):
// Not started · In progress · First pass completed · Needs more practice · Exam ready.
export const PROGRESS_STATUSES = [
  { id: 'not_started', label: 'Not started', short: 'Not started' },
  { id: 'in_progress', label: 'In progress', short: 'In progress' },
  { id: 'completed', label: 'First pass completed', short: 'First pass' },
  { id: 'needs_practice', label: 'Needs more practice', short: 'Needs practice' },
  { id: 'exam_ready', label: 'Exam ready', short: 'Exam ready' },
];
export const PROGRESS_STATUS_IDS = PROGRESS_STATUSES.map((s) => s.id);
/** Statuses meaning the first pass is done (counted as "completed" in stats). */
export const FIRST_PASS_STATUSES = ['completed', 'needs_practice', 'exam_ready'];

// Depth actually achieved (schedule Sections 7.3, 10.2, 13.1: record actual depth honestly).
export const DEPTHS = [
  { id: 'none', label: 'Not recorded' },
  { id: 'exposure', label: 'Exposure only' },
  { id: 'mv', label: 'Minimum viable (MV)' },
  { id: 'must', label: 'MUST depth' },
  { id: 'beyond', label: 'Beyond MUST' },
];
export const DEPTH_IDS = DEPTHS.map((d) => d.id);

export const SESSION_TYPES = {
  individual: { label: 'Individual', icon: '📖' },
  joint: { label: 'Joint', icon: '👥' },
  rest: { label: 'Rest', icon: '🌿' },
  buffer: { label: 'Buffer', icon: '🧩' },
  practice: { label: 'Practice', icon: '✍️' },
  exam: { label: 'Exam', icon: '🎓' },
  other: { label: 'Other', icon: '📌' },
};
export const SESSION_TYPE_IDS = Object.keys(SESSION_TYPES);
export const SESSION_STATUSES = [
  { id: 'planned', label: 'Planned' },
  { id: 'completed', label: 'Completed' },
  { id: 'missed', label: 'Missed' },
  { id: 'cancelled', label: 'Cancelled' },
];
export const SESSION_STATUS_IDS = SESSION_STATUSES.map((s) => s.id);
/** Types that are not study tasks: no completed/missed status. */
export const NON_STUDY_TYPES = ['rest', 'exam', 'other'];

export const DISCUSSION_STATUSES = [
  { id: 'open', label: 'Open' },
  { id: 'discussed', label: 'Discussed' },
  { id: 'deferred', label: 'Deferred' },
];
export const DISCUSSION_STATUS_IDS = DISCUSSION_STATUSES.map((s) => s.id);
// Kinds mirror the schedule's Section 14 tables.
export const DISCUSSION_KINDS = [
  { id: 'discuss', label: 'Discuss together' },
  { id: 'difficulty', label: 'Finding this difficult' },
  { id: 'revisit', label: 'Both need to revisit' },
  { id: 'question', label: 'Question for lecturer / Claude' },
];
export const DISCUSSION_KIND_IDS = DISCUSSION_KINDS.map((k) => k.id);
export const PRIORITIES = ['normal', 'high'];

export const LIMITS = { title: 160, notes: 2000, reason: 300, timeLabel: 60, activity: 200 };

export const STORAGE_KEYS = {
  profile: 'studyTracker.activeProfile.v1',
  scheduleFilter: 'studyTracker.scheduleFilter.v1',
};

export const ACTIVITY_TYPES = ['progress', 'check', 'session', 'discussion'];

/** ID shape for checklist items (session tasks, queue items, technical examples). */
export const ITEM_ID_RE = /^[a-z0-9][a-z0-9-]{0,118}$/;
