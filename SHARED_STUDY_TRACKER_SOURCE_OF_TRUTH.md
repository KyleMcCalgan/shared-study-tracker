# Shared Study Tracker — Source of Truth & Agent Implementation Specification

> **Status:** Implementation-ready specification, pending insertion of the authoritative study schedule and Firebase/GitHub credentials supplied through the operator's environment.  
> **Version:** 1.0  
> **Prepared:** 12 November 2026  
> **Primary audience:** Claude Code, OpenAI Codex, or another coding agent executing in a local working directory.  
> **Project:** A two-person, mobile-first COS326 study scheduling and progress-tracking web application.  
> **Participants:** Kyle and David.  
> **Authoritative schedule:** A separate Markdown document supplied to the agent in the working directory. **Do not invent its content.**

---

## 0. Mandatory agent instructions

**Read this entire specification before changing files.** Then locate and read the supplied schedule Markdown file **in full** before implementing dates, chapters, sessions, constraints, or imports. The schedule is the source of truth for academic content; this document is the source of truth for application requirements and architecture. If they conflict, resolve conflicts according to §3.

**Completion objective:** Build, test, and where access permits, publish a functioning GitHub Pages application, backed by Cloud Firestore, that Kyle and David can operate without a traditional server. Do not stop at a visual mockup, scaffolding, empty database screen, or README. Deliver actual working functionality and verifiable deployment results.

**Non-negotiable rules:**

1. Maintain a **vanilla HTML/CSS/JavaScript** application; no React, Next.js, Vercel, custom server, or unnecessary npm runtime framework.
2. The entire publishable site lives in a `website/` directory. Keep agent docs, scripts, rules, tests, and GitHub workflows outside `website/`.
3. Host the frontend on **GitHub Pages** and use **Cloud Firestore** as the persistent source of live shared state. No Git commits are needed for users' day-to-day progress updates.
4. No compulsory user-visible login. The initial selector offers only **Kyle** and **David**; preserve the choice in `localStorage` and allow switching intentionally in settings. A selected profile is an app identity, **not proven authentication**.
5. Prefer a no-login, *allowlisted-device anonymous Firebase Authentication* strategy described in §10: behind-the-scenes anonymous sign-in plus approval of exactly two device identities, followed by Firestore rules restricted to those UIDs. This preserves the desired UX while preventing unrestricted public writes. Provide documented onboarding; do **not** silently switch to globally readable/writable Firestore. If the operator explicitly opts into open access instead, provide the documented lower-security alternative and conspicuous warning.
6. **Never publish unrestricted `allow read, write: if true` Firestore rules.** Do not deploy a database that is writable by anyone solely because they know its public Firebase configuration.
7. Preserve the authoritative Markdown schedule's dates, ordering, study allocations, joint sessions, rest/golf days, buffer days, revision plan, individual constraints, and distinctions between planned work and actual progress. Do not infer that either participant knows a topic or that past-test marks represent their present proficiency.
8. Build **separate per-participant progress** and **shared scheduling/discussion state**. Schedule changes must not reset progress.
9. All dates and day-boundaries use **Africa/Johannesburg (UTC+02:00)**. Store date-only plans as `YYYY-MM-DD`, not JS UTC timestamp-derived strings.
10. Do not fabricate exam dates, chapter titles, topic dependencies, Firebase project IDs, GitHub URLs, credentials, publication results, or successful tests.
11. When tools/accounts are unavailable, implement everything that can be implemented locally, and provide **exact short operator steps** for the remaining external actions. Do not fake a live deployment.
12. Test mobile-first behavior, cross-device sync, schedule import idempotency, access controls, and critical interactions before marking the project complete.

### 0.1 Expected final agent response

Provide: repository URL (if created), live GitHub Pages URL (if deployed), Firebase project setup status, a concise feature checklist, tests actually run with results, any steps requiring Kyle's attention, and links/paths to README and imported schedule. Explicitly distinguish **completed**, **tested**, **deployed**, **not verified**, and **requires manual action**.

---

## 1. Vision, context and success criteria

Kyle and David need a simple shared study tracker for an upcoming COS326 exam. Both must revise the syllabus, not merely their perceived weak topics. Kyle may begin individual studying earlier; David is temporarily prioritising another module but will study when possible. The original schedule is supplied separately and may define exactly when that priority changes. Both want to meet to discuss material, leave space for fallback/catch-up, reserve a rest/golf day if the schedule does so, and protect a final day for past papers and revision.

The application replaces an editable Markdown timetable with a **live collaborative dashboard**. A user opens a GitHub Pages URL, selects Kyle or David once, and checks today's tasks. Tick-boxes and status changes write to Firestore in seconds; the other participant sees updates without refreshing. Rescheduling or missed sessions remains visible and manageable.

### 1.1 Success means

- Both participants can see **the same shared schedule** on desktop and phone.
- Each participant can independently track *not started / in progress / completed* per topic.
- There is a clear distinction between **planned**, **completed**, **discussed together**, and **practised**.
- Joint meetings, independent work, rest days, buffers and exam revision are easy to distinguish.
- One participant's updates appear on the other's device in near real time.
- An accidentally refreshed page does not lose edits.
- Daily progress edits do not trigger GitHub builds or commits.
- Data access does not rely on a secretly embedded GitHub token or Firebase admin credential.
- There is a reproducible setup and seed process from the schedule Markdown.
- The site works from a GitHub Pages repository subpath and on narrow mobile screens.

### 1.2 Explicit non-goals for v1

Do not implement messaging, AI tutoring, notifications, Google Calendar sync, complex role-based team management, a chatroom, a calendar-service backend, time tracking by the second, gamified XP, accounts/passwords, file uploads, a CMS, or a complex analytics suite. Do not add features that obscure the schedule. Prioritise reliability and clarity.

---

## 2. Stack and architecture

| Layer | Required choice | Notes |
|---|---|---|
| Static host | GitHub Pages | GitHub Actions publishes `website/` on push to `main` |
| UI | Semantic HTML + responsive CSS + ES modules | Minimal third-party dependencies |
| Firebase SDK | Official modular Firebase Web SDK | Pin a tested release; use browser ESM imports or a small development-only bundling path if justified |
| Database | Cloud Firestore, Standard edition | Documents and collections, real-time `onSnapshot()` |
| Behind-the-scenes auth | Firebase Anonymous Authentication | No visible signup/sign-in; two approved UIDs only by default |
| Local preference | `localStorage` | Selected profile, UI preferences; never authoritative progress |
| Data validation | Client-side + Firestore Security Rules | Never rely on client validation for authorization |
| Date handling | Explicit local date utilities | Africa/Johannesburg date-only model |
| Deployment | GitHub Actions official Pages actions | Only publishes static files |
| Tests | Lightweight browser tests + unit tests | Tool choice at agent discretion; avoid heavyweight app architecture |

**Data flow:** `GitHub Pages website → Firebase JS SDK → Firebase Auth (anonymous, silently) → Cloud Firestore ↔ realtime listener → both browsers`. GitHub stores the **application code**, not daily mutable user data.

Firebase's web `apiKey`, `authDomain`, `projectId`, `appId` and similar web-app configuration are **public identifiers**, not administrative secrets. Database authorization comes from correctly deployed Security Rules. **Never expose** a service account JSON, private key, Admin SDK credential, GitHub PAT, Firebase CLI token, or privileged Google Cloud access in published files.

### 2.1 Offline and loading behavior

Cloud Firestore local caching is optional, not a requirement. Show a useful skeleton/loading state; distinguish `synced`, `saving`, `offline`, and `error`. Never claim an action was saved remotely while only pending locally. Prefer non-blocking feedback; optimistic UI may revert on failure. A realtime listener should remain active only while needed; dispose subscriptions when components/views are no longer using them. Avoid continuous repeated queries or polling.

---

## 3. Source-of-truth hierarchy and schedule interpretation

### 3.1 Input discovery

The operator will place a study schedule Markdown file somewhere in the agent's working directory. Agent must search for likely names, including `*STUDY*SCHEDULE*.md`, `*schedule*.md`, and `*.md`; identify the correct schedule based on content, not just filename. **Read every section**, including footnotes and assumptions. Do not assume a specific chapter count or exact timetable until read.

Maintain a verbatim archived copy at `docs/source-schedule.md` with source filename and import date noted elsewhere, not inserted into the archived text. Do not rewrite the source document silently.

### 3.2 Priority order

1. **Directly stated instructions from the operator in the active agent session.**
2. **Supplied schedule Markdown:** topic names, exam date, explicit calendar allocations, course structure, time constraints, rest day, meetings, buffers and final-day revision.
3. **This specification:** system architecture, database, UI behavior, workflows, tests, and quality requirements.
4. Inferred defaults below, **only** for details genuinely unspecified.

If a schedule conflicts with an earlier conversation summary, follow the schedule unless the operator explicitly overrides it. If a field cannot be inferred safely, surface it as `TBD` in app data and in `docs/import-report.md`; do not quietly make up a date.

### 3.3 Personal planning principles

- Neither Kyle nor David should be assumed competent in any syllabus section based on an earlier test; **both need comprehensive revision**.
- Their actual progress begins as *not started*, unless the schedule explicitly contains **confirmed completed work** (not merely a plan).
- Kyle can progress independently before joint meetings.
- David may have reduced capacity while focusing on another module; do not interpret lower early progress as failure or a commitment breach.
- Shared sessions are for discussion, comparison, explanations, questions, and worked examples; they do not require both to have finished identical independent work.
- Respect any explicitly reserved rest/golf day as **no required work**, and any final revision day as **practice/revision rather than first exposure to new syllabus content**.
- Buffers must be tangible fallback slots, not automatic extra mandatory assignments.
- Prescribed chapter ordering wins unless the schedule explicitly permits flexible ordering. Dependencies can be displayed as informational guidance, never automatically reorder the imported timetable.

### 3.4 Schedule ingestion rules

Convert the supplied Markdown into a normalized, reviewable intermediate JSON snapshot. Preserve:

- Topic IDs and names; module/unit/chapter grouping; learning objectives if present.
- Dates, duration or time ranges if explicitly provided, session titles and participants.
- Each participant's assigned independent work and any joint work.
- Session type: `individual`, `joint`, `rest`, `buffer`, `practice`, `exam`, or `other`.
- Any proposed contingency, recovery instructions, or optional activity.
- Original source line/heading or textual reference for traceability.
- Uncertain or ambiguous interpretation in import report, rather than inventing facts.

A day may have multiple sessions. If the schedule uses loose phrases like “after lunch” or “evening”, retain a human-readable label and do not invent precise clock times. If a session does not specify a time, render it as **All day / Unscheduled time**.

**Import must be idempotent:** stable IDs derived from source-defined codes or semantic identity, such as `2026-11-16-joint-ch4`, with collision handling. Running import twice must not duplicate sessions. Do not overwrite completed progress, discussion decisions, user-edited schedule content, or historical activity logs when reseeding. Seed new content, detect differences, produce a proposed diff, and require an explicit migration/apply flag for disruptive changes.

### 3.5 Initial seed is not the runtime database

Commit `data/seed-schedule.json` and `docs/import-report.md` to the repo. These are reproducible **snapshots**, not live storage. Import into Firestore through a controlled **local** owner-operated script, preferably Firebase Admin SDK using `GOOGLE_APPLICATION_CREDENTIALS` or Application Default Credentials outside the repo; never run privileged seeding in the browser. If admin credentials are unavailable, provide a documented safe one-time manual initialization path, gated by an explicitly temporary rule and immediately locked down afterward; avoid leaving insecure bootstrap rules installed. Do not import data from the Markdown every page load.

---

## 4. User journeys

### 4.1 First visit

1. Website loads and initializes Firebase.
2. Invisible anonymous auth signs in or restores the anonymous Firebase session.
3. If the device UID has not been approved, show **Device approval required** with its UID and simple instructions to send it privately to Kyle for allowlisting. **Do not display study content before authorization.**
4. Once approved, display profile selector: **Kyle** or **David**.
5. Clicking a profile persists the choice locally and enters the dashboard.
6. Returning visits auto-open the last selected profile, except if device authorization is missing/expired or data cannot load.

**Important:** Profile selection is a convenience, not a guarantee that someone cannot impersonate the other person's progress. The app can expose **switch profile** visibly in Settings. The two allowlisted anonymous UIDs restrict the project to two enrolled browser identities, not to immutable real-world people.

### 4.2 Everyday study

- Open site → “Today” dashboard with planned study items and due discussions.
- Start an item → state changes to `in_progress` and syncs.
- Finish item → state changes to `completed`; record completion time, with optional note.
- See progress indicators for Kyle and David side by side, without changing selected identity.
- Visit calendar → see upcoming independent and joint sessions.
- Mark a discussion item discussed after meeting; this **must not** automatically mark individual study complete.
- If a day is missed → move only the planned session or reallocate planned work to a buffer; never silently modify historical progress.

### 4.3 Change profile

Settings → Switch profile → choose other name → confirmation stating the new active profile. Do not destroy cached data or require a second Firebase account. Show a persistent but discreet active-profile indicator in the header to avoid accidental updates to the wrong person's progress.

### 4.4 Concurrent use

Two browsers can concurrently edit **different topic/progress documents** without collisions. For the **same document**, use narrowly scoped field updates or transactions where appropriate, acknowledge last-write-wins if applied, and make conflict behavior clear. Do not overwrite an entire study plan document just to update one status. Use `serverTimestamp()` for audit fields; use date-only strings for scheduled days.

---

## 5. Required screens and functionality

### 5.1 Profile selector / approval

Two large clear selectable profile cards. No passwords. Selected choice stored under a versioned localStorage key, e.g. `studyTracker.activeProfile.v1`. Separate loading, auth-error and unapproved-device states. Provide copy-UID functionality during onboarding.

### 5.2 Dashboard (default)

Above the fold on mobile: date, active participant, days until exam if date is confirmed, today's plan, next shared session. Below: comparative progress, overdue/incomplete planned sessions, discussion queue, upcoming rest/buffer/revision day. Show **no exam countdown** if the input lacks a confirmed exam date. Make an empty day feel intentional (“No study scheduled today”), especially rest days.

Suggested compact KPIs: topics completed by each participant out of syllabus topics; shared discussions outstanding; sessions ahead. Use separate counts for planned versus completed. Progress percentages must have well-defined denominators: all syllabus topics, not only assigned topics. Rest days and exam sessions are excluded from completion denominators.

### 5.3 Schedule / calendar

Default mobile list/agenda view grouped by date; optionally a compact desktop week grid. Types distinguished by labeled chips and accessible icons, not just color. Each card displays type, title, participant(s), time label if given, chapter/topic links, notes, and status where relevant. View filters: `All`, `Kyle`, `David`, `Together`, `Rest & buffers`. Clearly flag today and past days. Jump to today; navigate weeks; show exam date if confirmed.

**Editing v1:** Add/edit/delete a non-imported user session, reschedule a planned session, mark a session cancelled/completed, or add a brief reason. For imported sessions, preserve provenance and store modifications separately or as metadata, with source details retained. Ask for confirmation before destructive deletes. No drag-and-drop required.

### 5.4 Topics / syllabus

Grouped searchable topic list drawn from the actual schedule. Every topic shows two independent statuses. Optional collapsible description and expected subtasks. Use segmented statuses or simple actions: Not started / In progress / Completed. Support marking “needs discussion” without modifying progress status. If schedule includes material not yet allocated, display it under **Unscheduled topics**.

### 5.5 Shared discussions

A separate queue with: linked topic(s), title/question, raised by, created time, priority `normal/high` (optional), status `open/discussed/deferred`, notes/resolution, and optional linked joint session. Either user may add discussion items. Marking discussed must not mark topic complete. Sort open before discussed; show recent activity.

### 5.6 Recovery / missed days

Mark session `missed`; optionally move outstanding work to one of the explicit future buffer days. Before moving, show affected dates, participant and topic IDs. Never automatically consume a rest/golf day or final revision-only day; do not automatically convert optional buffer time into a full workload. For v1, a minimal **Reschedule** action with clear preview is enough. Do not build a complex optimization engine.

### 5.7 Settings / diagnostics

Show current profile, device approval state (approved UID masked by default), connection state, timezone, data last synced, and links to repo/source schedule. Allow switching profile and manually refreshing. Optional JSON export of non-sensitive tracker data; ensure exports are client-generated, not stored on GitHub. Administrative imports must **not** be exposed as a normal frontend button.

---

## 6. Data model: Firestore

Use a single logical workspace with a fixed ID such as `cos326-2026`. All app state is under `workspaces/{workspaceId}`. A separate optional `approvedDevices/{uid}` root collection can be used for approval metadata, but authorization **must** be enforced by rules, not merely checking that document in UI.

### 6.1 Collections

| Path | Purpose | Suggested document ID |
|---|---|---|
| `workspaces/cos326-2026` | Workspace metadata / exam info | Fixed workspace ID |
| `workspaces/cos326-2026/topics/{topicId}` | Canonical topics/chapters | Stable import ID |
| `workspaces/cos326-2026/progress/{profile_topic}` | Individual progress | `kyle__chapter-01` |
| `workspaces/cos326-2026/sessions/{sessionId}` | Individual / joint sessions | Stable ID |
| `workspaces/cos326-2026/discussions/{discussionId}` | Discussion requests | Auto ID or UUID |
| `workspaces/cos326-2026/activity/{eventId}` | Optional lightweight audit entries | Auto ID |

Avoid nesting all progress in one enormous document; use one progress document **per participant per topic** for independent updates and easy listeners. Do not store one mutable giant `schedule.json` document.

### 6.2 Representative workspace document

```json
{
  "title": "COS326 Shared Study Tracker",
  "moduleCode": "COS326",
  "timezone": "Africa/Johannesburg",
  "participants": ["kyle", "david"],
  "examDate": null,
  "sourceScheduleFilename": "<actual supplied filename>",
  "schemaVersion": 1
}
```

`examDate: null` is intentional until the real schedule supplies a date. Do not show a mock exam date in production.

### 6.3 Representative topic document

```json
{
  "id": "chapter-06",
  "title": "<exact imported topic title>",
  "group": "<imported syllabus group or null>",
  "order": 6,
  "description": "",
  "sourceRef": "docs/source-schedule.md#<source-heading>",
  "imported": true,
  "archived": false
}
```

### 6.4 Representative progress document

```json
{
  "profileId": "kyle",
  "topicId": "chapter-06",
  "status": "in_progress",
  "notes": "",
  "startedAt": null,
  "completedAt": null,
  "updatedAt": "<Firestore server timestamp>",
  "updatedByUid": "<Firebase anonymous auth UID>"
}
```

Valid statuses: `not_started`, `in_progress`, `completed`. When not started, a missing progress document may imply that status. `completedAt` is set only on completion, and cleared on explicitly reopening a topic. Always validate profile/topic IDs. Record timestamps as Firestore Timestamps, not the placeholder shown above.

### 6.5 Representative session document

```json
{
  "id": "2026-11-16-joint-ch6",
  "date": "2026-11-16",
  "startTime": null,
  "endTime": null,
  "timeLabel": "Evening",
  "type": "joint",
  "title": "<exact or faithful imported schedule title>",
  "participants": ["kyle", "david"],
  "topicIds": ["chapter-06"],
  "status": "planned",
  "optional": false,
  "notes": "",
  "sourceRef": "<source section>",
  "imported": true,
  "rescheduledFrom": null,
  "updatedAt": "<Firestore timestamp>"
}
```

Examples above are **illustrative schema examples only, not claims that these dates or chapters exist in the supplied schedule**. Valid session states: `planned`, `completed`, `missed`, `cancelled`. Type values: `individual`, `joint`, `rest`, `buffer`, `practice`, `exam`, `other`. Rest and exam entries cannot be marked “completed study tasks” and should use a tailored presentation.

### 6.6 Representative discussion document

```json
{
  "title": "<actual question>",
  "topicIds": ["chapter-06"],
  "raisedBy": "david",
  "status": "open",
  "notes": "",
  "sessionId": null,
  "createdAt": "<Firestore timestamp>",
  "updatedAt": "<Firestore timestamp>"
}
```

### 6.7 Validation and invariants

- Do not accept arbitrary profile IDs, malformed dates or unknown status values.
- Limit free-text lengths (e.g., titles ≤ 160 chars, notes ≤ 2,000 chars) in both UI and rules.
- Topic IDs are immutable after import; edits change labels, not primary identifiers.
- `date` must be a valid ISO calendar date, not just a matching regex.
- Every discussion's `raisedBy` and progress's `profileId` must be either `kyle` or `david`.
- Sessions must have at least one valid participant and `endTime >= startTime` when both are provided.
- `updatedAt` should be a server timestamp; `createdAt` should remain immutable after creation.
- Never delete historical progress because a session is rescheduled or removed.
- Keep data small; no large binary assets or lecture PDFs in Firestore.

---

## 7. UI and design system

**Visual direction:** Calm, clean study workspace; restrained, helpful, not a neon SaaS dashboard. Not a game. Avoid over-designed gradients and unnecessary animation. Use clearly differentiated Kyle, David and joint-study accents, but never rely on color alone to communicate ownership/status.

### 7.1 Mobile-first requirements

- Support 320 px to desktop; target comfortable use on typical 360–430 px phones.
- Use bottom navigation on mobile if helpful: `Today`, `Schedule`, `Topics`, `Discuss`, with Settings accessible from header; on desktop use compact sidebar/top nav.
- Interactive targets at least approximately 44×44 CSS px where practical.
- No horizontal overflow, tiny fixed-width tables, or hover-only controls.
- Sticky controls must not hide content; respect viewport safe areas.
- Support light theme; optional dark theme only after core implementation.
- Plain fonts/system stacks unless small optimized assets are justified.
- Provide accessible labels, keyboard navigation, visible focus state, semantic headings and form error messages.

### 7.2 Key states

Design actual states, not just the happy path: first load, device pending approval, profile selection, empty day, empty discussions, loading, saving, saved, permission denied, Firebase unavailable, offline, invalid config, no schedule imported, seed import incomplete. Avoid blank screens.

### 7.3 Accessibility and meaning

Color + text labels such as `Joint`, `Kyle`, `David`, `Rest`, `Buffer`. Accessible progress text and correct aria descriptions. Respect `prefers-reduced-motion`. Use date strings with weekday names in Africa/Johannesburg rather than shifting a date at UTC midnight.

---

## 8. Technical implementation guidelines

### 8.1 Files and ES modules

Suggested structure (adapt if simpler, but keep the publishable root as `website/`):

```text
shared-study-tracker/
├── README.md
├── AGENTS.md
├── SHARED_STUDY_TRACKER_SOURCE_OF_TRUTH.md
├── docs/
│   ├── source-schedule.md
│   ├── import-report.md
│   ├── firebase-setup.md
│   ├── deployment.md
│   ├── security.md
│   └── testing.md
├── data/
│   └── seed-schedule.json
├── scripts/
│   ├── parse-schedule.mjs
│   ├── seed-firestore.mjs
│   └── validate-seed.mjs
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .github/workflows/
│   ├── deploy-pages.yml
│   └── validate.yml
├── tests/
│   ├── dates.test.mjs
│   ├── importer.test.mjs
│   └── rules/
├── website/
│   ├── index.html
│   ├── 404.html                 # optional
│   ├── favicon.svg
│   ├── styles/
│   │   └── main.css
│   ├── js/
│   │   ├── main.js
│   │   ├── firebase-config.js
│   │   ├── firebase-client.js
│   │   ├── data-service.js
│   │   ├── auth.js
│   │   ├── date-utils.js
│   │   ├── state.js
│   │   ├── ui.js
│   │   └── views/
│   │       ├── dashboard.js
│   │       ├── schedule.js
│   │       ├── topics.js
│   │       └── discussions.js
│   └── assets/
└── package.json                # dev/test tooling only, optional
```

Do not insist on exactly this many files if simpler is easier to maintain. Use relative paths and path-aware routing so a repo URL such as `https://OWNER.github.io/REPO/` works. No hard-coded root `/js/...` URLs that break under `/REPO/`. A single-page hash router (`#today`, `#schedule`) is sufficient; no server-side rewrite rules.

### 8.2 Firebase client

- Use one initialized Firebase app, one auth instance and one Firestore instance.
- Subscribe to relevant collections with `onSnapshot`; route data into an in-memory state/store that views render.
- Do not create duplicate listeners on every navigation or checkbox interaction.
- Debounce text-area updates and save on blur or explicit Save; avoid a Firestore write for every keystroke.
- Save status changes individually and visibly handle failures.
- Use `updateDoc` on existing progress, `setDoc` for first creation with deterministic ID, and transactions only where needed.
- Store only local presentation settings in `localStorage`. Do not treat `localStorage` as canonical shared progress.
- Avoid excessive full-collection refreshes; for a small tracker, a handful of scoped listeners is appropriate.
- Sanitize user text with DOM `textContent`; do not render user-supplied Markdown or notes through unsafe `innerHTML`.

### 8.3 Dates

Study days are **calendar dates** in Africa/Johannesburg. They are not a UTC instant. Implement tested functions for parsing, displaying, comparing, and counting date-only strings. `new Date('YYYY-MM-DD')` can be interpreted as UTC; do not directly use it for local-calendar logic. Countdown = local calendar day difference between current Johannesburg date and confirmed exam date. If exam date has passed, say “Exam date passed” rather than displaying a negative countdown.

### 8.4 Performance

Keep startup small. Do not add large UI frameworks/charts libraries for simple status bars. Cache loaded view data in memory and use realtime listeners efficiently. Avoid re-rendering the entire application with every checkbox change if easy to scope. Measure network and Firestore usage during testing.

---

## 9. Seed/import implementation details

### 9.1 Parsing stages

1. Read source Markdown in UTF-8.
2. Identify module, exam date, people, topics and session/day sections.
3. Extract structured data while keeping exact user-visible topic titles.
4. Resolve date formats from schedule context; detect ambiguous day/month formats and report them.
5. Associate independent/joint assignments with topic IDs.
6. Identify `rest`, `buffer`, `practice`, `exam` and `joint` explicitly.
7. Generate stable normalized IDs and deterministic ordering.
8. Validate referential integrity, dates, duplicates and required fields.
9. Write `data/seed-schedule.json` with `schemaVersion`, `sourceHash`, `importedAt`, and collections.
10. Write `docs/import-report.md` listing assumptions, detected ambiguities, number of topics and sessions, days with no planned work, and warnings.
11. **Review imported structure** before initializing Firestore.
12. Seed only after explicit `--apply` or equivalent; default is `--dry-run`.

### 9.2 Import safeguards

An importer may be one-time human-assisted if the source format is irregular; don't create a fake generic parser that silently loses data. A manually curated seed file, audited against the Markdown, is preferable to incorrect automatic extraction. The reproducible parser should either parse reliably or fail with a useful report. Keep import logic separate from the browser.

### 9.3 Planned vs actual

A schedule statement “Kyle studies chapter 2 on Tuesday” creates a **planned session**; it does not create a `completed` progress record. The database starts with `not_started` progress (or absence thereof) unless the supplied source explicitly confirms completed work. Even if the calendar date is in the past, do not automatically mark it completed or missed until confirmed/marked by users.

### 9.4 Future schedule revisions

Treat source schedule as the **initial plan** and Firestore as the **live operational record** after launch. Changes to source Markdown must not silently overwrite Firestore. Generate a diff (added/removed/changed topics and sessions) and apply only consciously; preserve user progress and modifications. A clear conflict report is preferable to destructive merges.

---

## 10. Security and no-login onboarding

### 10.1 Threat model / unavoidable trade-off

GitHub Pages is publicly accessible (subject to repo/pages visibility and plan settings). Firebase browser configuration is public. **Picking “Kyle” or “David” does not authenticate identity.** If security rules allow open writes, strangers can read/modify the tracker, and may generate usage. A shared PIN stored in client JavaScript or localStorage does **not** provide real server-enforced protection. Anonymous Authentication without restrictions similarly does **not** limit access to the two intended people: any visitor can create an anonymous account.

**Default v1 protection:** silent anonymous auth + **explicit Firebase UID allowlist** for exactly the two enrolled browsers. This is a one-time manual approval step and does not show a login form. It prevents arbitrary anonymous visitors from reading or writing Firestore. It is not identity proof; if someone uses an enrolled device or its credentials they can act as that device. If users clear browser storage, use another browser, or change devices, the anonymous UID may change and must be re-approved. Explain this trade-off in UI/docs.

### 10.2 Enrolment procedure

1. In Firebase Console create the project and enable **Authentication → Anonymous**.
2. Deploy strict Security Rules that permit only approved UIDs; initially the allowlist is empty, so all study-data access is denied.
3. Deploy site. Kyle and David each open it in their intended browser/device. The site silently signs in and shows **Approval required** with UID (without exposing data).
4. Kyle collects both UIDs through a private channel.
5. Owner enters the two UIDs in a **trusted owner-only deployment config**: either hard-coded equality checks in Firestore rules for a tiny app, or a secure `approvedDevices/{uid}` allowlist managed **only** with Firebase Console/Admin SDK. Never allow browser clients to add UIDs to the allowlist.
6. Deploy the updated rules; both browsers immediately gain access on recheck or refresh.
7. Choose Kyle or David in the website selector and begin.

**Preferred rules design:** use `request.auth != null` plus an owner-managed allowlist document check or UID equality; deny access to allowlist documents from public clients unless there is a justified minimal `get` for their own approval status. The app may infer approval from a denied/readable workspace request or a safe own-UID status check. Avoid enumerating the allowlist. Include precise setup scripts and test rules with Firebase emulator before deployment.

### 10.3 Firestore rules requirements

The committed `firestore.rules` must:

- Deny by default.
- Gate every workspace read/write by the two-approved-UID mechanism.
- Explicitly deny browser writes to access-control/allowlist records.
- Permit only the necessary document paths and allowed operations.
- Enforce field-key allowlists and types for create/update; prevent arbitrary nested content or unexpected huge fields.
- Enforce enum values, permitted profile names and workspace ID.
- Prevent deletion of canonical imported topics unless an explicitly documented admin path exists.
- Prevent clients from updating sensitive workspace metadata such as `schemaVersion`, `sourceScheduleFilename`, or exam date by ordinary progress actions.
- Treat server timestamps according to Firestore Rules semantics; test creation/update constraints with the emulator.
- Avoid broad catch-all allow rules.

For simple v1 rules, allow both enrolled devices to edit either profile (because profile switching is intentionally supported). If strict per-person ownership is desired later, require real user authentication; do not pretend localStorage-profile selection enforces identity.

### 10.4 Deliberate lower-security alternative (only with explicit operator approval)

If Kyle **explicitly accepts public read/write access**, a no-auth demonstration can use narrowly path-scoped and schema-validated rules. It is **not private**, and anyone with access to the public app/config could exploit writes even with field validation. Never present obscurity, a shared client-side code, or anonymous-only auth as genuine access control. Recommend the approved-device default instead. Document any intentional insecure choice and keep the app free of sensitive information.

### 10.5 Firebase App Check

Consider App Check as optional defense against non-app traffic, not a substitute for authorization. If enabled, configure its supported web provider and test on GitHub Pages; do not block launch on App Check if allowlist rules are correctly configured. Do not promise it stops a determined user of the public site from editing data.

---

## 11. Firebase owner setup (operator/agent handoff)

Use **Firebase Spark/free plan** if the service and region support the required functionality. Choose Cloud Firestore **Standard edition**, one free-eligible database, and a suitable region (evaluate Johannesburg support and free-tier availability at setup time; location cannot be casually changed later). Firebase project setup may require operator console interaction.

1. Create Firebase project (single owner Google account).
2. Register a **Web app**; copy public web config to `website/js/firebase-config.js` using an included example template.
3. Enable **Cloud Firestore** in production/locked mode, never default test mode as a deployed final state.
4. Enable **Authentication → Anonymous**.
5. Install/use Firebase CLI locally to deploy rules and indexes if the agent has authenticated authorization; otherwise provide exact console instructions.
6. Configure and deploy allowlist according to §10.
7. Run the owner-only seed import after validating the input and reviewing the dry-run.
8. Confirm Firestore is populated and authorization works on both devices.
9. Monitor Firestore quotas in Firebase Console, especially if the website is accidentally made accessible to unknown devices.

**Config:** Provide `website/js/firebase-config.example.js` with documented fields; build can fail gracefully with a clear `Firebase configuration missing` view rather than crashing. The public runtime config may be committed after project creation. Do not commit private service account data.

**Free-tier note:** Current documentation lists Cloud Firestore Standard free quotas of **1 GiB stored**, **50,000 document reads/day**, **20,000 writes/day**, **20,000 deletes/day**, and **10 GiB outbound/month**. Verify before enabling paid services; these are not a guarantee of zero charges if owner enables billing or additional products.

---

## 12. GitHub repository and Pages deployment

### 12.1 Repository

Default suggested repo name: `cos326-shared-study-tracker` (change only on operator request or name conflict; document the actual name). Initialize git if needed. Push `main` to the authorized GitHub account/repo with normal credentials already available in the agent's environment. Do **not** require a token pasted into a prompt or saved in git history.

README must contain purpose, screenshot (optional if generated legitimately), setup, profiles, security caveat, local run steps, Firebase configuration, seeding, testing, GitHub Pages URL, and how to amend the schedule safely.

### 12.2 Publishing

Create `.github/workflows/deploy-pages.yml` using current supported GitHub Actions for checkout, Pages configuration, artifact upload from `website/`, and `deploy-pages`, with proper `pages: write` and `id-token: write` permissions. Trigger on `main` pushes and manual dispatch. Use `concurrency` to avoid overlapping deployments. In GitHub repo Settings → Pages, set source to **GitHub Actions**.

**No Node build is required for the site** if using browser modules directly. For testing/import scripts, Node may be used in CI as a development dependency; do not ship Node source/test tooling into `website/` unnecessarily.

### 12.3 Live deployment check

After push, verify workflow success and that the published URL actually loads. Check mobile viewport, JavaScript module paths, favicon, Firebase initialization, Firestore permission handling and response headers. Confirm editing a topic persists after refresh and syncs between two authorized browsers. If workflow status or URL cannot be checked, report “deployed but not verified” or “deployment pending manual action”, never claim success.

### 12.4 Repository hygiene

Add `.gitignore` for `.env*`, service accounts, local exports, `node_modules`, Firebase emulator state and credentials; preserve safe `.example` files. Ensure secrets are not embedded into history, Actions logs, commit messages or screenshots. Use minimal GitHub Actions permissions. Avoid generating pointless placeholder logos or unrelated assets.

---

## 13. Tests and acceptance criteria

### 13.1 Functional tests (required)

| ID | Scenario | Pass condition |
|---|---|---|
| F01 | First-time browser visits | Sees silent sign-in then approval gate, not a crash |
| F02 | Unapproved UID | Cannot read/write study data |
| F03 | Approved UID | Can select Kyle/David and open live tracker |
| F04 | Remember profile | Refresh retains chosen profile |
| F05 | Switch profile | Can switch intentionally; header updates |
| F06 | Kyle completes topic | Kyle progress updates; David progress unchanged |
| F07 | David edits same topic separately | Own progress updates without changing Kyle |
| F08 | Two authorized browsers | Other browser sees Firestore change without refresh |
| F09 | Calendar filters | Individual/joint/rest/buffer views consistent with seed |
| F10 | Session rescheduled | New planned date persists; progress unchanged |
| F11 | Mark missed | No automatic progress deduction or accidental completion |
| F12 | Add discussion | Appears on both browsers; can resolve independently |
| F13 | Rest/golf day | Clearly marked; not auto-filled by catch-up logic |
| F14 | Final revision day | Preserved; not used for automatically shifted new content |
| F15 | Reload after change | All saved changes remain |
| F16 | Firebase unavailable | Informative error and retry, no fake success |
| F17 | Empty schedule | Helpful empty/seed-required state |
| F18 | Past exam date | No negative countdown |
| F19 | GitHub Pages repo subpath | JS/CSS/assets resolve correctly |
| F20 | Import rerun | No duplicate records; user progress preserved |

### 13.2 Automated tests

- Date calculations across month/year boundary, including Johannesburg local-date handling.
- Parser coverage for actual Markdown patterns in source schedule; duplicate/date validation.
- Deterministic stable ID generation and idempotent seed diff.
- Progress computations with both profiles and missing records.
- Firestore Security Rules emulator: approved vs unapproved UIDs; blocked modifications; malformed fields; no browser ability to alter allowlist; valid profile/status changes.
- Basic smoke tests of page navigation and event handlers at desktop and mobile widths.

### 13.3 Manual QA checklist

- Test mobile at 320, 375 and 430 px; laptop ≥ 1280 px.
- Test keyboard tab navigation and accessible input labels.
- Test both participants viewing simultaneously.
- Test network disconnect/reconnect and rejected write UI.
- Test clearing localStorage/browser storage and document the re-enrolment effect.
- Check import report against the Markdown **line by line** for topics, dates and reserved days.
- Verify no fabricated study tasks or wrong chapter order.
- Check GitHub Pages deployment URL is correct and repository remains reproducible.

---

## 14. Work plan for coding agent

### Phase 1 — Inspection & decisions

- Inventory working directory and identify schedule file.
- Read schedule and this specification fully.
- Determine if GitHub auth, Firebase auth/CLI, Node and testing tools are already available.
- Create `docs/import-report.md` with all factual extracted constraints.
- Do not ask for inputs that are already explicit in the source schedule.

### Phase 2 — Seed and baseline

- Build normalized seed JSON from actual schedule, verifying all chapters and dates.
- Implement date utilities and validation tests.
- Generate archived schedule and docs.
- Set up vanilla static site and first-pass layouts.

### Phase 3 — Firebase implementation

- Implement config, silent auth, approval gate, profile selection.
- Implement read subscriptions, write operations, status notifications, error handling.
- Implement restrictive Firestore rules and emulator tests.
- Implement reliable owner-only seed script with dry run and diff.

### Phase 4 — Real screens

- Today dashboard and progress counters.
- Schedule agenda/calendar and filters.
- Topics and independent completion controls.
- Shared discussion queue.
- Edit/reschedule/missed-day and settings flows.

### Phase 5 — Test and polish

- Execute automated tests.
- Run mobile and desktop manual QA.
- Check schedule fidelity, security and concurrency.
- Fix defects and simplify UI; remove dead features.

### Phase 6 — Publish

- Create/push repo if authorized and available.
- Configure GitHub Pages Actions deployment.
- Support Firebase project creation and trusted UID onboarding.
- Seed data, verify live site, and provide handoff report.

**Do not stop after Phase 2.** The target deliverable is a functioning deployed app where account access allows.

---

## 15. Operator action matrix

| Need | Agent can usually do | Kyle must do if unavailable |
|---|---|---|
| Supply current schedule | Read file placed in workspace | Place the finalized `.md` alongside source files |
| Create GitHub repo | GitHub CLI/API if authenticated | Authorize CLI or create repo manually |
| Push site | Git push if authorized | Approve authentication / push |
| Enable Pages | GitHub API/UI if authorized | Settings → Pages → GitHub Actions |
| Create Firebase project | Potentially CLI if authenticated, but console often easiest | Create project in Firebase Console |
| Enable Anonymous Auth | Console / authorized CLI workflow | Toggle provider on |
| Create Firestore database | Authorized workflow where supported | Select Standard database, locked mode and region |
| Set public web config | Agent after receiving project config | Copy Firebase web config from Console |
| Approve two devices | Agent with owner-level access | Collect UIDs and register in protected allowlist |
| Deploy Firestore rules | CLI if authorized | Use Console/CLI with owner account |
| Seed Firestore | Owner-only script if credentials accessible | Run documented script locally |
| Verify live behavior | Agent browser/testing tools if available | Test Kyle and David devices |

No agent should claim to have access to Firebase/GitHub accounts that it does not actually have. Ask for **authorization/access**, not for password or private credentials pasted into chat or source files. Avoid automatic billable resource creation or enabling a paid plan without explicit approval.

---

## 16. Definition of done

The project is done only when:

- [ ] The agent has read the supplied schedule and archived it without altering content.
- [ ] Seeded topics/dates exactly reflect source; all ambiguities are documented.
- [ ] Kyle and David can each select a profile and the device remembers it.
- [ ] Unapproved browser UIDs cannot access study content.
- [ ] Each user's progress can change independently and persist in Firestore.
- [ ] Both authorized browsers receive real-time updates.
- [ ] Schedule displays individual, joint, practice, rest, buffer and exam days where supplied.
- [ ] Discussions can be added and resolved separately from completion.
- [ ] Missed work can be rescheduled without rewriting existing progress.
- [ ] Rest days and final revision-only days are not silently overridden.
- [ ] Site works on mobile and GitHub Pages repo subpath.
- [ ] GitHub Actions publishes `website/` and deployment is verified, or clearly documented as blocked.
- [ ] Firebase Security Rules have been tested and no broad public-write rule remains.
- [ ] README, docs, scripts, smoke tests and setup instructions are committed.
- [ ] Final agent report states exact verified URLs, test results and remaining manual actions.

---

## 17. Explicit decisions and extension policy

### Locked decisions

- Exactly two named logical profiles: Kyle and David.
- One Firebase project, one Firestore workspace, one GitHub Pages repository.
- No visible login and no independent Google/email account required for either participant.
- Silent Firebase Anonymous Auth with owner-approved device UIDs as the secure default.
- All runtime updates live in Firestore, not in GitHub commits.
- Source Markdown drives initial schedule, not fabricated fixtures.
- Vanilla JS and mobile-first architecture.
- Review/revision day and rest day respected if present in schedule.

### Can be adjusted without scope creep

- Colors/typography and UI iconography.
- List or week-grid default depending on mobile usability.
- Exact module split and naming under `website/js/`.
- Whether to seed no explicit `not_started` documents and derive defaults.
- Small accessibility and reliability improvements.

### Deferred ideas (do not build in v1)

- Google sign-in / verified per-person identity.
- Calendar export (.ics), recurring meeting rules, notification reminders.
- Personal productivity trends, Pomodoro, flashcards, streaks, gamification.
- Offline-first multi-device conflict resolution.
- Additional subjects, groups or participants.
- AI study plans or automatic rescheduling algorithms.

---

## 18. Documentation and trustworthy external references

Keep implementation aligned with current official documentation and note SDK versions used. This source-of-truth file captures the design; official vendor docs control any evolving SDK syntax, quotas, and deployment requirements.

- Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Firestore Security Rules: https://firebase.google.com/docs/firestore/security/get-started
- Firestore rules and auth conditions: https://firebase.google.com/docs/firestore/security/rules-conditions
- Firebase Anonymous Authentication: https://firebase.google.com/docs/auth/web/anonymous-auth
- Firebase Web API key semantics: https://firebase.google.com/docs/projects/api-keys
- Firebase pricing: https://firebase.google.com/pricing
- GitHub Pages with GitHub Actions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

---

## 19. Copyable launch instruction for Claude Code / Codex

> **Read `SHARED_STUDY_TRACKER_SOURCE_OF_TRUTH.md` completely.** Locate the separate COS326 study schedule Markdown file in this working directory and read it completely too. Treat the specification as the authoritative implementation plan and the schedule as the authoritative source for chapter names, study allocations, dates, joint meetings, rest/buffer days, and revision requirements. **Build the complete functional project, not a mockup:** vanilla JS website entirely under `website/`, Firestore data model and real-time listeners, silent anonymous Firebase authentication with owner-approved UID allowlist (no visible login), Kyle/David profile selector, individual progress, calendar, discussions, session editing/rescheduling, schedule import/seed scripts, Firestore rules, tests, docs, GitHub Actions deployment. Do not fabricate any schedule details or claim deployments without verification. Use existing authenticated GitHub/Firebase tools where available; never expose secrets. Complete as much as possible autonomously, run tests, create/push/deploy the repository where authorized, and provide exact manual steps for blocked Firebase/account actions. Report what actually works, what was verified, and what remains.

---

## 20. Clarification if setup friction becomes a problem

The primary security design has a small **one-time device-approval step**, not a daily login. This is an intentional compromise between “literally anybody can write to a public database” and “two people must sign in each visit.” If device approval is too inconvenient, the next sensible alternative is **Google Sign-In with an exact two-email allowlist**: one tap per device, then persisted sessions. Do **not** claim that a profile dropdown, secret URL, or hardcoded shared password is a secure substitute. If the operator explicitly chooses a completely open anonymous prototype, limit its content to non-sensitive data, use strict collection/field rules, and disclose that anybody who can access the app may modify the data.

**End of source of truth.**
