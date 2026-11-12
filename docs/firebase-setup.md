# Firebase setup (one-time, owner: Kyle)

Everything uses the free **Spark** plan. No billing account is needed, so don't add one.

## 1. Create the project

1. Go to https://console.firebase.google.com and sign in with your Google account.
2. **Create a project** → name it e.g. `cos330-study-tracker`.
3. **Google Analytics:** turn it **off** (not needed). Gemini prompts can be skipped.

## 2. Register the web app (gives the public config)

1. On the project overview, click the **Web** icon (`</>`).
2. Nickname: `study-tracker-web`. **Leave "Firebase Hosting" unticked** (we use GitHub Pages).
3. Copy the `firebaseConfig` values into `website/js/firebase-config.js`, using `website/js/firebase-config.example.js` as the template.

These values are public identifiers, not passwords. Access is enforced by the security rules.

## 3. Enable Google sign-in and authorise the site address

1. **Build → Authentication → Sign-in method → Add new provider → Google → Enable.** Pick your email as the "support email" → **Save**.
2. **Authentication → Settings → Authorized domains → Add domain** → `kylemccalgan.github.io` → **Add**. Without this, sign-in fails on the live site with "unauthorized domain". `localhost` is already listed.
3. Anonymous sign-in is no longer used and can be switched off (Sign-in method → Anonymous → Disable).

## 4. Create the Firestore database

**Build → Firestore Database → Create database**

- Edition: **Standard**
- Location: **`africa-south1` (Johannesburg)** if offered; otherwise `europe-west1`. **This can't be changed later.**
- Security: **Start in production mode** (locked). Never choose test mode.

## 5. Download an admin key (never committed)

Used only on your PC, to deploy rules, import the schedule and manage who has access.

1. **Project settings (⚙️) → Service accounts → Generate new private key.**
2. Save it in the project's **`secrets/`** folder (create it if missing). Everything in `secrets/` is git-ignored.
3. Never commit it, upload it or paste it anywhere. The scripts refuse a key inside the project unless git confirms it is ignored and untracked, and they always refuse one inside `website/`.

In PowerShell, for the current session (adjust the filename):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "$PWD\secrets\study-planner-80983-firebase-adminsdk-xxxxx-xxxxxxxxxx.json"
```

## 6. Deploy rules, import the schedule, allow the two accounts

```bash
npm run deploy:rules                                  # strict rules from firestore.rules
npm run seed                                          # dry run: shows what will be created
npm run seed -- --apply                               # import the schedule
npm run allow -- kyles-google@gmail.com --profile kyle
npm run allow -- davids-google@gmail.com --profile david
```

The emails are stored only in Firestore, never in the repo. Each person then opens the site, taps **Continue with Google**, and is in. If someone signs in before being added, their "No access" page unlocks by itself once they are.

**Fallback for rules:** if `deploy:rules` reports a permission error, open **Firestore Database → Rules**, paste the whole of `firestore.rules`, and click **Publish**.

## 7. Monitor usage

**Firestore Database → Usage.** Spark quotas (verify at https://firebase.google.com/pricing): 50,000 reads/day, 20,000 writes/day, 1 GiB stored. Two people use a tiny fraction of that. Opening the app reads roughly 100–200 documents.
