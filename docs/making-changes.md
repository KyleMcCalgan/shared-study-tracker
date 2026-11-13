# Making changes: what each kind of change involves

How to change the tracker safely: what to edit, what to run, what deploys (and how), and which tests are affected.

---

## 1. The three separate places things live

Changes reach users through three independent routes. Knowing which one a change goes through answers most "do I need to…?" questions.

| Where | What lives there | How it gets updated | Automatic? |
|---|---|---|---|
| **GitHub → GitHub Pages** | The website code: everything in `website/` | `git push` to `main` → the *Deploy* workflow publishes `website/` | ✅ Yes, about 1 minute after a push that touches `website/` |
| **Firebase security rules** | Who may read and write what (`firestore.rules`) | `npm run deploy:rules` from your PC | ❌ No. Pushing to GitHub does **not** change the live rules |
| **Firestore data** | Schedule (topics, sessions), progress, ticks, discussions | Schedule: `npm run seed`. Progress: the app itself | ❌ Schedule never re-imports by itself; progress is live |

Daily study progress (ticks, statuses, notes) **never needs a commit or deploy**. It goes straight from the app to Firestore.

---

## 2. Quick reference: change type → what to do

| I want to change… | Edit | Then run | Deploys via | Tests likely to need edits |
|---|---|---|---|---|
| Colours, fonts, spacing, sizes | `website/styles/main.css` | preview → `npm run test:smoke` | push | **None** |
| Wording of text / labels | `website/js/views/*.js` | `npm run test:smoke`, `npm run test:e2e` | push | Only tests that look for that exact text (see §5) |
| Layout / screen structure / interactions | `website/js/views/*.js`, `ui.js`, `main.js`, CSS | `npm run test:all` | push | Smoke + e2e selectors for the parts you moved |
| App logic (stats, dates, reschedule rules) | `website/js/model.js`, `date-utils.js` | `npm test` | push | `tests/unit/*` if behaviour changes |
| What gets saved (new field, new status, new kind) | `config.js` + `actions.js` + **`firestore.rules`** | `npm run test:all` | push **and** `npm run deploy:rules` | Rules tests + unit tests |
| Security rules only | `firestore.rules` | `npm run test:rules` | `npm run deploy:rules` | `tests/rules/*` |
| The study plan itself | `docs/source-schedule.md` | `npm run parse` → `npm run seed` | `npm run seed -- --apply` | Importer unit tests if the Markdown *structure* changed |
| Firebase project / web config | `website/js/firebase-config.js` | open the live site | push | None |
| npm packages | `package.json` | `npm install` → `npm run test:all` | push (CI only) | Possibly any |

---

## 3. The standard workflow (any code change)

1. **Preview locally.** Use Live Server with the project folder as the workspace, or `npm run serve`. Open `…/website/?preview`. Sample data, nothing saved, no sign-in needed.
   - `?preview=signedout`, `?preview=notallowed`, `?preview=empty`, `?preview=error` show the other screens.
   - Live Server reloads on every save, which resets preview data. That's expected.
2. **Run the relevant tests** from the table above, or everything with `npm run test:all` (about 3 minutes).
3. **Commit and push** to `main`. Commits are authored as Kyle only.
4. **GitHub does the rest:**
   - *Deploy website to GitHub Pages* runs **only if `website/` changed**, and publishes in about 20 seconds.
   - *Validate* runs every test suite on Linux for **every** push, in about 2 minutes. Check the **Actions** tab for green ticks.
5. **Check the live site.** Browsers may keep the old version for **up to 10 minutes** (GitHub Pages caches files for 600 s). Pull to refresh or hard-reload (Ctrl+Shift+R) if you don't see the change.

If *Validate* fails after a push, the site has **already deployed**: Validate doesn't block deployment. Fix forward, or revert (§7).

---

## 4. Specific change types in detail

### 4.1 Visual design (CSS only)

- All styling is in `website/styles/main.css`. It is mobile-first (the phone design); the desktop design (sidebar, glyph icons, Helvetica-style type) is one `@media (min-width: 960px)` block that redefines the same variables. Colours, fonts and radii are variables at the top of each (`--bg`, `--green-*`, `--pink-*`, `--terra`, `--font`, …), so most re-themes are a few lines.
- The design references live in `designs/` (desktop PNGs are 1.5× of a 1464×767 window; phone PNGs are ~1.83× of a 430 px wide screen).
- Tests: **no changes**. The smoke tests still check that nothing overflows sideways at 320/375/430/1280 px and that no screen shows `null`/`undefined`. Run `npm run test:smoke` to confirm.
- The phone font (Figtree) comes from Google Fonts (`<link>` in `website/index.html`); desktop uses the system Helvetica/Arial stack. If you swap it, keep a system-font fallback in `--font`.

### 4.2 Screens and interactions (view code)

- Each tab is one file: `views/dashboard.js` (Today), `schedule.js`, `topics.js` (Topics), `discussions.js`, `settings.js` (Settings plus the full-screen gates). Shared session cards and dialogs are in `views/session-card.js`. Building blocks (`h()`, cards, pills, sheets, filter pills) are in `ui.js`. Icons and the two illustrations are in `icons.js` (line icons for phones, glyph icons for desktop).
- Topics and Discuss render a different structure per layout (desktop: list + inline detail panel; phone: cards + bottom sheet), chosen with `isDesktop()` and rebuilt when the window crosses 960 px. Small desktop/phone differences in text or icons use `bp()` / `dualIcon()` and the `.only-desk` / `.only-mob` classes.
- **Always build DOM with `h()`**, never `innerHTML` with data; that is how user notes are kept safe. Inside `h()`, `null`/`false` children are skipped. The browser's own `element.append(x)` prints `null` as text, so filter first (the smoke tests catch this).
- Writes must go through `actions.js` so that "Saving… / Synced", error toasts and the activity feed keep working.
- Tests: the smoke and e2e tests find things by **role + visible text** (e.g. the "Mark done" button, the "In progress" radio), by **ids** (`#session-<id>`, `#topic-<id>`, `#daypill-<date>`) and by **`data-test` hooks** (`data-test="session"`, `"chapter-ch05"`, `"progress-kyle"`, `"profile-button"`, `"sync"`, …; statuses are read from `data-status-of` / `data-status` attributes, not text). Keep those hooks when you restyle and the tests won't need to change. A failing test prints the selector it couldn't find.

### 4.3 What gets saved (data model)

This is the only kind of code change that needs **two deploys**: push the website, then deploy rules.

Example: adding a "confidence 1–5" field to chapter progress.

1. `website/js/config.js`: add any new constants (allowed values, limits).
2. `website/js/actions.js`: include the field when writing.
3. **`firestore.rules`**: allow the new key in `validProgress()` (the `keys` list) and validate it. Without this, every save is rejected with *permission denied*. The rules only accept fields they know about, by design.
4. `tests/rules/rules.test.mjs`: add a case that accepts a valid value and rejects an invalid one.
5. `npm run test:rules` → `npm run test:all`.
6. Push, **then** `npm run deploy:rules` (set the key path first, see §6).
   - Order matters a little. Deploy the rules first if old app versions might still be open, because new rules that *also* accept the old shape are safe either way.

Adding a new chapter or topic ID means updating `topicIdList()` in `firestore.rules`. A test fails if the rules and the seed disagree.

### 4.4 Security rules

- Edit `firestore.rules` → `npm run test:rules` (runs against a local emulator, never the real database) → `npm run deploy:rules`.
- The deploy script refuses rules containing `allow read, write: if true`.
- To roll back, check out the previous version of the file and deploy again.

### 4.5 Changing the study plan

The Markdown is the source of truth for the plan. The app never reads it at runtime.

1. Replace `docs/source-schedule.md` with the new version, verbatim.
2. `npm run parse`. This regenerates `data/seed-schedule.json` and `docs/import-report.md`. Read the report.
   - If the parser stops with an error, the Markdown's structure changed (a renamed section or a different table). It fails loudly rather than losing data. Adjust `scripts/lib/schedule-parser.mjs` and `tests/unit/importer.test.mjs`.
3. `npm run seed`: a **dry run**, showing new / changed / removed items. Writes nothing.
4. `npm run seed -- --apply`: adds new items only.
   - `--update-changed` also refreshes the text of already-imported sessions and chapters.
   - `--archive-removed` hides items that are no longer in the plan.
5. Commit the new Markdown, seed JSON and report.

What the import **never** touches: progress, ticks, discussion status and notes, and any session you moved, marked or annotated in the app. If the plan moves a session that you had already rescheduled, your date wins, and the dry run tells you so.

---

## 5. Tests: what each suite protects

| Suite | Command | Depends on the design? | Breaks when… |
|---|---|---|---|
| Seed validation | `npm run validate` | No | Source Markdown changed without `npm run parse` |
| Unit (20) | `npm test` | No | Logic changes: dates, stats, reschedule rules, task labels, parser |
| Security rules (16) | `npm run test:rules` | No | Rules or the data model change |
| Seed import (3) | `npm run test:seed` | No | Import or merge behaviour changes |
| Browser smoke (24) | `npm run test:smoke` | **Yes** | Text, roles, ids or classes it looks for change; anything overflows on a phone; "null" appears |
| End-to-end (9) | `npm run test:e2e` | **Yes**, a little | Approval, profile or chapter-sheet controls change |

Requirements: Node 20+, Java 21+ (for the emulator tests), Edge or Chrome. Firebase emulators run locally. **Tests never touch the real database.**

If an emulator test fails with "port taken", a leftover Java process from a previous run is holding the port. The `pretest:*` hooks normally free it; if not, run `node scripts/free-emulator-ports.mjs`.

---

## 6. Admin commands (need the private key)

The admin key lives in `secrets/` (git-ignored, never committed). In PowerShell, once per terminal:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "$PWD\secrets\study-planner-80983-firebase-adminsdk-fbsvc-3b35af4398.json"
```

| Command | Does |
|---|---|
| `npm run deploy:rules` | Publishes `firestore.rules` to the live project |
| `npm run seed` / `-- --apply` | Dry-run / apply the schedule import |
| `npm run allow -- <email> --profile kyle|david` | Gives a Google account access as that person (one per profile unless `--allow-more`) |
| `npm run allow -- --list` / `--revoke <email>` | Lists / removes allowed accounts (removal is instant) |

---

## 7. Undoing a change

| What went wrong | Fix |
|---|---|
| Bad website change | `git revert <commit>` → push. Pages redeploys the previous version in about a minute (allow up to 10 for caches) |
| Bad rules | Restore the previous `firestore.rules` (`git checkout <commit> -- firestore.rules`) → `npm run deploy:rules` |
| Wrong schedule import | Imports only add or update and never delete. Fix the Markdown, then re-run with `--update-changed` / `--archive-removed` |
| Wrong progress entered | Change it back in the app; there's no deploy involved |

---

## 8. Signing in when developing

- Use `?preview` locally: sample data, no sign-in, nothing saved.
- Without `?preview`, the local site uses the **real** database and you sign in with Google as usual. `localhost` is an authorised domain by default. For Live Server on `127.0.0.1` you must add `127.0.0.1` under **Authentication → Settings → Authorized domains**, or use `http://localhost:5500/website/` instead.
- Each address (e.g. `localhost:5500` vs the GitHub Pages site) keeps its own sign-in, so you may be asked to sign in once per address.

---

## 9. Pre-push checklist

- [ ] Previewed at phone width (about 375 px) and desktop
- [ ] `npm run test:all` passes, or at least the suites from §2
- [ ] Data-model change? `firestore.rules` updated, tested **and** `npm run deploy:rules` run
- [ ] Schedule change? `npm run parse` run and the import report read; seed dry-run checked before `--apply`
- [ ] Nothing from `secrets/` staged (`git status`)
- [ ] After pushing: both workflows green in **Actions**; live site checked after a hard refresh
