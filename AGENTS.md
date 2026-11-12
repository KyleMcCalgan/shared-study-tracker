# Notes for coding agents

- Read `SHARED_STUDY_TRACKER_SOURCE_OF_TRUTH.md` (architecture) and `docs/source-schedule.md` (academic content). The schedule wins on course facts. The module is **COS330**, even where the spec says COS326.
- Vanilla HTML/CSS/ES modules only. The published site is `website/` and nothing else. No build step.
- Never invent schedule data. Change `docs/source-schedule.md`, run `npm run parse`, and review `docs/import-report.md`.
- `website/js/config.js` constants must match `firestore.rules`. If you add a topic, update `topicIdList()` in the rules (a test enforces this).
- User text is rendered with `textContent` only (`ui.js` → `h()`); never use `innerHTML` with data.
- Never commit credentials. Admin scripts read `GOOGLE_APPLICATION_CREDENTIALS` from outside the repo.
- Run `npm run test:all` before pushing.
