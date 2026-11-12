# Deployment

## GitHub Pages

- Repository: https://github.com/KyleMcCalgan/shared-study-tracker (public; free GitHub Pages needs a public repo).
- **Settings → Pages → Source: GitHub Actions.**
- `.github/workflows/deploy-pages.yml` publishes **only `website/`** on every push to `main` that touches `website/`. You can also run it manually from the **Actions** tab. There is no build step and no secrets.
- Live URL: https://kylemccalgan.github.io/shared-study-tracker/
- All paths are relative and routing uses `#hash`, so the `/shared-study-tracker/` subpath works with no server rewrites.

`validate.yml` runs every test suite on each push and pull request.

## Changing the code

Edit, run `npm run test:all`, then commit and push to `main`. Pages redeploys in about a minute. Day-to-day study progress **never** needs a commit; it lives in Firestore.

## Changing the Firebase rules

Edit `firestore.rules`, run `npm run test:rules`, then `npm run deploy:rules`. Pushing to GitHub does **not** deploy rules.

## Checking a deployment

1. **Actions** tab: the "Deploy website to GitHub Pages" run is green.
2. Open the live URL. On a phone the approval screen or the Today view should load without errors.
3. ⚙️ Settings → Connection shows "Connected. All changes saved."
