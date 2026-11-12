# Security model

## What protects the data

1. **Google Sign-In.** Each person signs in once per device with their Google account ("Continue with Google") and stays signed in.
2. **Owner-managed allowlist.** `allowedUsers/{email}` holds exactly two entries, `{ profile: 'kyle' }` and `{ profile: 'david' }`. Only the owner can change it, using the Admin SDK (`npm run allow`) or the Firebase Console. **The rules deny every browser write to it.** An account can read only its own entry, to learn whether it has access. The email addresses live **only in the database, never in this public repository.**
3. **Deny-by-default rules** ([`firestore.rules`](../firestore.rules)). Every read and write requires a **verified Google account** whose email is on the allowlist. Writes are checked for:
   - **ownership:** your account maps to one profile, so you can only change **your own** progress, ticks, notes and authored discussion items. Shared things (session dates and status, discussion status) are editable by both;
   - allowed keys only; types, enums and length limits (titles ≤ 160, notes ≤ 2,000);
   - real calendar dates and `HH:MM` times;
   - `updatedAt == request.time` and `updatedByUid == auth.uid`;
   - imported sessions: only date, status and note fields can change; content and provenance are immutable;
   - topics and workspace metadata (exam date, schema version, source) are read-only;
   - progress, checklist and discussion docs can't be deleted; the activity log is append-only;
   - rest, exam and "other" entries can't be marked completed, and the exam can't be moved.

Tested in `tests/rules/` (emulator: signed-out, anonymous, unlisted, unverified and cross-profile attempts all refused) and end to end in `tests/e2e/` (real SDK with emulated Google accounts).

## Managing access (owner)

```bash
npm run allow -- you@gmail.com --profile kyle
npm run allow -- david@gmail.com --profile david
npm run allow -- --list
npm run allow -- --revoke someone@gmail.com     # instant: their open app locks
```

Each profile can have one account unless you pass `--allow-more`.

## Trade-offs

- **Access belongs to a Google account, not a device.** Anyone signed in to your Google account on a device you leave unlocked could use the tracker as you. Use Settings → Sign out on shared computers.
- **The Firebase web config is public.** That is normal and safe. It identifies the project but grants nothing without an allowed account.
- **Anyone can sign in with *some* Google account,** which uses a tiny amount of quota. They see "No access" and can't read or write anything.
- The site is `noindex`, but GitHub Pages is public. Don't store anything sensitive in notes.
- **Firebase Console requirement:** `kylemccalgan.github.io` must be in **Authentication → Settings → Authorized domains**, otherwise Google sign-in is refused on the live site. `localhost` is allowed by default.

## Never commit

Service-account JSON, private keys, Firebase CLI tokens or GitHub tokens. The admin key lives in the git-ignored `secrets/` folder. `.gitignore` blocks the common names, the scripts refuse a key that git doesn't ignore, and the Pages workflow refuses to publish credential-like files.

## If something goes wrong

- Lost phone or compromised Google account: `npm run allow -- --revoke <email>` (takes effect immediately), then secure the Google account.
- Suspected admin-key leak: Firebase Console → Project settings → Service accounts → manage keys in Google Cloud → delete the key, then generate a new one.

## History

v1 used silent anonymous sign-in plus per-device approval codes (spec §10). It was replaced by Google Sign-In with a two-account allowlist (spec §20) on 13 Nov 2026 at Kyle's request, to avoid device codes and to make identity real.
