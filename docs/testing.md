# Testing

Requirements: Node 20+, Java 21+ (Firestore emulator), Microsoft Edge or Google Chrome (headless browser tests).

| Command | What it checks | Spec tests |
|---|---|---|
| `npm run validate` | Seed matches `docs/source-schedule.md` (hash + re-parse); referential integrity, dates, duplicates | §9.1 |
| `npm test` | Unit: Johannesburg dates across month/year, countdown, parser output vs source, deterministic IDs, seed diff idempotency, stats denominators, reschedule guards, validation | F18, F20 |
| `npm run test:rules` | Firestore rules in the emulator: unapproved denied, allowlist untouchable, malformed fields, immutable fields, batches | F02, F03, F06, F07, F10–F12 |
| `npm run test:seed` | Seeding twice against the emulator: no duplicates, user progress/dates/notes preserved, `--update-changed` gating | F20 |
| `npm run test:smoke` | Browser (preview backend): all gate states, profile remember/switch, independent progress, ticks, rejected writes, filters, protected days, missed + reschedule, add/delete session, discussions, no horizontal overflow at 320/375/430/1280 px, keyboard skip link | F01, F03–F07, F09–F17 |
| `npm run test:e2e` | **Real Firebase SDK** against Auth + Firestore emulators with the real rules: approval gate, live unlock, unapproved denial, two browsers syncing live, persistence after reload, live revoke | F01–F03, F08, F12, F15 |
| `npm run test:all` | All of the above | |

Save smoke-test screenshots with `SMOKE_SCREENSHOTS=<dir> npm run test:smoke`. To use Chrome instead of Edge, set `SMOKE_BROWSER_CHANNEL=chrome`.

On Windows, the emulator's Java process can survive a run. The `pretest:*` hooks free ports 8180 and 9099 automatically.

## Manual QA checklist (live site)

- [ ] Phone (≈375 px) and laptop: Today, Schedule, Topics, Discuss and Settings load; no sideways scrolling.
- [ ] Kyle's phone and David's device open side by side: a status change on one appears on the other within seconds.
- [ ] Turn on airplane mode, tick a box: the header shows **Offline** (not "Synced"); it syncs after reconnecting.
- [ ] Settings → Switch profile → the header updates.
- [ ] A new private window shows the approval screen and no study content.
- [ ] `docs/import-report.md` checked line by line against the schedule.
