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

## 3. Enable Anonymous sign-in

**Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**

## 4. Create the Firestore database

**Build → Firestore Database → Create database**

- Edition: **Standard**
- Location: **`africa-south1` (Johannesburg)** if offered; otherwise `europe-west1`. **This can't be changed later.**
- Security: **Start in production mode** (locked). Never choose test mode.

## 5. Download an admin key (never committed)

Used only on your PC, to deploy rules, import the schedule and approve devices.

1. **Project settings (⚙️) → Service accounts → Generate new private key.**
2. Save it either outside the project, or in the project root **with its default name** (`study-planner-80983-firebase-adminsdk-….json`). `.gitignore` already ignores that name.
3. Never commit it, upload it or paste it anywhere. The scripts refuse a key inside the project unless git confirms it is ignored and untracked, and they always refuse one inside `website/`.

In PowerShell, for the current session (adjust the filename):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "$PWD\study-planner-80983-firebase-adminsdk-xxxxx-xxxxxxxxxx.json"
```

## 6. Deploy rules, import the schedule, approve devices

```bash
npm run deploy:rules            # strict rules from firestore.rules
npm run seed                    # dry run: shows what will be created
npm run seed -- --apply         # import the schedule
# each person opens the site, copies the device ID shown, sends it privately to Kyle:
npm run approve -- <id> --label "Kyle phone"
npm run approve -- <id> --label "David phone"
```

Each approved device unlocks automatically within seconds.

**Fallback for rules:** if `deploy:rules` reports a permission error, open **Firestore Database → Rules**, paste the whole of `firestore.rules`, and click **Publish**.

## 7. Monitor usage

**Firestore Database → Usage.** Spark quotas (verify at https://firebase.google.com/pricing): 50,000 reads/day, 20,000 writes/day, 1 GiB stored. Two people use a tiny fraction of that. Opening the app reads roughly 100–200 documents.
