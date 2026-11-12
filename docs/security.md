# Security model

## What protects the data

1. **Silent anonymous sign-in.** Every browser gets a Firebase UID with no login screen.
2. **Owner-managed allowlist.** `approvedDevices/{uid}` lists the approved browsers. Only the owner can change it, using the Admin SDK (`npm run approve`) or the Firebase Console. **The rules deny every browser write to it.** A browser can read only its own entry, to learn whether it is approved.
3. **Deny-by-default rules** ([`firestore.rules`](../firestore.rules)). Every workspace read and write requires an approved UID. Writes are checked for:
   - allowed keys only; types, enums and length limits (titles ≤ 160, notes ≤ 2,000);
   - real calendar dates and `HH:MM` times;
   - `updatedAt == request.time` and `updatedByUid == auth.uid`;
   - imported sessions: only date, status and note fields can change; content and provenance are immutable;
   - topics and workspace metadata (exam date, schema version, source) are read-only;
   - progress, checklist and discussion docs can't be deleted; the activity log is append-only;
   - rest, exam and "other" entries can't be marked completed, and the exam can't be moved.

These are tested in `tests/rules/` (emulator) and end to end in `tests/e2e/`.

## Trade-offs (read this)

- **Picking "Kyle" or "David" is not authentication.** Either approved device can edit either profile; this is intentional so profiles can be switched. The header always shows the active profile to prevent mistakes.
- **Approval belongs to a browser, not a person.** Anyone using an approved browser has access. Clearing site data, private windows, or a new browser or device produce a new UID that must be approved again.
- **The Firebase web config is public.** That is normal and safe. It identifies the project; it grants nothing without an approved UID.
- **Anyone can create an anonymous account** and so use a small amount of quota (sign-ins and one denied read). They still can't read or write study data.
- The site is `noindex`, but GitHub Pages is public. Don't store anything sensitive in notes.

## Never commit

Service-account JSON, private keys, Firebase CLI tokens or GitHub tokens. `.gitignore` blocks the common names, the scripts refuse a key inside the repo, and the Pages workflow refuses to publish credential-like files.

## If something goes wrong

- Lost or stolen device: `npm run approve -- --revoke <uid>` (list IDs with `--list`). It takes effect immediately.
- Suspected key leak: Firebase Console → Project settings → Service accounts → manage keys in Google Cloud → delete the key, then generate a new one.

## Stronger option (not built)

If per-person identity matters, switch to Google Sign-In with an exact two-email allowlist in the rules (spec §20).
