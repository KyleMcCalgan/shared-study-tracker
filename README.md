# COS330 Shared Study Tracker

A small live dashboard for **Kyle and David** to work through the COS330 (Computer Security) exam plan together. It covers each person's chapter progress, the shared calendar, joint sessions, technical-example checklists and a discussion queue. Changes sync between devices in seconds.

- **Live site:** https://kylemccalgan.github.io/shared-study-tracker/
- **Study plan source:** [`docs/source-schedule.md`](docs/source-schedule.md) (verbatim copy of `COS330_SHARED_STUDY_SCHEDULE_v3.md`)
- **What was imported:** [`docs/import-report.md`](docs/import-report.md)
- **Specification:** [`SHARED_STUDY_TRACKER_SOURCE_OF_TRUTH.md`](SHARED_STUDY_TRACKER_SOURCE_OF_TRUTH.md)

## How it works

```
GitHub Pages (website/, static) ──► Firebase JS SDK ──► Anonymous Auth (silent)
                                                    └─► Cloud Firestore ◄─realtime─► both browsers
```

- **No login screen.** Each browser signs in anonymously in the background. Kyle approves each browser once (see [Security](docs/security.md)).
- **Profiles.** After approval you pick **Kyle** or **David**. The device remembers the choice; switch in ⚙️ Settings. A profile is a convenience, **not** proof of identity: either approved device can edit either profile.
- **Progress lives in Firestore,** not in Git. Ticking a box never triggers a commit or a site rebuild.
- **The schedule is imported once** from the Markdown by an owner-only script. The site never re-reads the Markdown.

## Features

| Tab | What you can do |
|---|---|
| **Today** | Date, exam countdown (Sat 21 Nov, 15:00), your sessions with tickable MUST/SHOULD/COULD tasks, next joint session, Kyle vs David progress side by side, past sessions not yet marked, discussion queue, upcoming rest/buffer/practice/exam days, live activity feed |
| **Schedule** | Week agenda with filters (All · Kyle · David · Together · Rest & buffers). Mark sessions done, missed or cancelled; reschedule with a preview and protected-day warnings; add shared notes; add your own sessions |
| **Topics** | All 12 examinable chapters (Ch 12 excluded). Each person has an independent status (Not started → In progress → First pass completed → Needs more practice → Exam ready), the depth reached (Exposure / MV / MUST), notes, the technical-example checklist, David's Q1–Q16 queue, and "Needs discussion" |
| **Discuss** | Shared queue of questions, tricky topics and things to revisit: open → discussed / deferred. Marking an item discussed never marks a chapter complete |
| **Settings** | Switch profile, connection status, device approval and ID, refresh, JSON export, links |

Saving is shown honestly in the header: **Saving…** until Firestore confirms, then **Synced**. **Offline** and **Sync error** are shown too. Rejected writes show an error and roll back.

## Day-to-day use

1. Open the site on your phone or laptop. It opens on **Today**.
2. Tick tasks as you finish them, and change a chapter's status in **Topics**.
3. After a joint session, mark it **done** and resolve the discussion items you covered.
4. Missed a day? Use **Missed… → Mark missed and reschedule…**. The dialog suggests the explicit buffer slot and warns before you use the golf day, the practice day or exam day.

## Repository layout

```
website/            ← the ONLY folder published to GitHub Pages
  index.html, favicon.svg, styles/main.css
  js/ main.js, store.js, actions.js, model.js, date-utils.js, config.js, ui.js,
      firebase-client.js, firebase-config.js (public web config), memory-backend.js (localhost preview)
  js/views/ dashboard, schedule, topics, discussions, settings, session-card
data/seed-schedule.json   ← reviewable snapshot generated from the Markdown
docs/                     ← source schedule, import report, setup/deploy/security/testing guides
scripts/                  ← parser, validator, owner-only seed/approve/deploy-rules, dev server
tests/                    ← unit, rules (emulator), seed (emulator), smoke (browser), e2e (real SDK + emulators)
firestore.rules, firestore.indexes.json, firebase.json
.github/workflows/        ← deploy-pages.yml, validate.yml
```

## Setup and maintenance

- **Changing the code, rules or schedule (what deploys how, which tests are affected):** [`docs/making-changes.md`](docs/making-changes.md)
- **First-time Firebase setup:** [`docs/firebase-setup.md`](docs/firebase-setup.md)
- **Deployment and GitHub Pages:** [`docs/deployment.md`](docs/deployment.md)
- **Security model and trade-offs:** [`docs/security.md`](docs/security.md)
- **Running the tests:** [`docs/testing.md`](docs/testing.md)

### Run locally

```bash
npm install
npm run serve            # http://localhost:8080/website/
# Preview with the real seed data, in memory only (nothing saved, no approval):
#   http://localhost:8080/website/?preview
# VS Code Live Server also works: "Go Live" with the project folder open, then
#   http://127.0.0.1:5500/website/?preview
```

### Approve a new device (owner)

The new browser shows a device ID. Then run:

```bash
npm run approve -- <device-id> --label "Kyle phone"
npm run approve -- --list
npm run approve -- --revoke <device-id>
```

Clearing site data, private windows, or a new browser or device all create a new ID that needs approving.

### Changing the schedule safely

1. Replace `docs/source-schedule.md` with the new version (keep it verbatim).
2. Run `npm run parse`, then read the regenerated `docs/import-report.md`.
3. Run `npm run seed` (dry run) to see exactly what would be added or changed.
4. Run `npm run seed -- --apply` to add new sessions and topics. Add `--update-changed` to refresh the content of already-imported items, and `--archive-removed` to hide items no longer in the plan.

Re-running is safe: IDs are stable, nothing is duplicated, and **progress, ticks, discussion state, and any date, status or note you changed are never overwritten.**

## Tests

`npm run test:all` runs seed validation, unit tests, Firestore rules tests, seed idempotency tests, browser smoke tests and end-to-end tests (real Firebase SDK against emulators). It needs Node 20+, Java 21+ and Edge or Chrome. See [`docs/testing.md`](docs/testing.md).
