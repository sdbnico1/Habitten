# Setting up Habitten (web app version)

This runs as a real website but installs like an app on your iPhone and Mac. Three things to set up, all free: hosting, sync, and daily reminders. Takes about 20-30 minutes total.

## 1. Host it (GitHub Pages — free)

PWAs need to be served over HTTPS from a real URL — that's what makes "Add to Home Screen" and notifications work.

1. Create a free GitHub account if you don't have one: github.com
2. Create a new repository, name it `habitten` (Settings can be public or private — Pages works either way on GitHub)
3. Upload every file from this project folder into that repo, keeping the same folder structure (`css/`, `js/`, `icons/`, `index.html`, `manifest.json`, `service-worker.js`)
4. In the repo, go to **Settings → Pages**
5. Under "Build and deployment", set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`
6. Save. After a minute or two, it'll give you a URL like `https://yourusername.github.io/habitten/`

That URL is your app from now on.

## 2. Set up sync (Supabase — free tier)

1. Go to supabase.com and create a free account and a new project
2. Once it's ready, go to the **SQL Editor** and run this to create the storage table:

```sql
create table app_state (
  id text primary key,
  data jsonb,
  updated_at timestamptz default now()
);

alter table app_state enable row level security;

create policy "allow all for anon"
on app_state for all
using (true)
with check (true);
```

(This keeps it simple since it's just for you — anyone with your exact Supabase URL/key combo could technically read it, but that's not published anywhere public, so treat those keys like a password and don't share the repo publicly with them inside it.)

3. Go to **Settings → API** in Supabase. Copy the **Project URL** and the **anon public key**.
4. Open `js/config.js` in your repo and paste them in:

```js
SUPABASE_URL: "https://xxxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJ...",
```

5. Commit that change. Sync is now live — add a habit on one device, it'll show up on the other within a couple seconds.

## 3. Add it to your Home Screen

**On iPhone:**
1. Open your GitHub Pages URL in **Safari** (must be Safari, not Chrome)
2. Tap the Share icon → **Add to Home Screen**
3. It now opens full-screen with its own icon, no browser bar

**On Mac:**
1. Open the URL in Safari
2. File menu → **Add to Dock** (or on newer Safari: Share icon → Add to Dock)

## 4. Daily reminder notifications (OneSignal — free tier)

Real push notifications on iOS PWAs need a push service behind them — OneSignal handles this for free with no server code from you.

1. Go to onesignal.com, create a free account and a new app
2. When it asks for platform, choose **Web Push** → **Safari (iOS/macOS) + Chrome/others**, and give it your GitHub Pages URL as the site URL
3. OneSignal's setup wizard will hand you a small script snippet — add it right before the closing `</body>` tag in `index.html`, and it'll also tell you if you need to drop an extra file (like `OneSignalSDKWorker.js`) at the root of your repo. Follow its instructions exactly since these file names occasionally change on their end.
4. Copy your **OneSignal App ID** from Settings → Keys & IDs, and paste it into `js/config.js`:
```js
ONESIGNAL_APP_ID: "your-app-id-here",
```
5. Commit and push. Reopen the app on your iPhone once (from the home screen icon) and allow notifications when prompted.
6. In the OneSignal dashboard, go to **Messages → New Push → Automated (Journey)**, set it to send daily at whatever time you want, with whatever nudge text you like ("Don't break the streak 🔥"). No code needed — this is entirely dashboard-configured.

## Using it day to day

- Every change you make (checking off a habit, adding a journal entry) saves instantly to your phone/Mac and quietly syncs to the cloud in the background — no "save" button to remember, no loading spinners.
- If you're offline, it still works fully; it just syncs once you're back online.
- Points = 1 per habit completion, shown in Stats. Easy to change the formula in `app.js` (`renderStats` function) if you want something else later.

## If you want to update the app later

Any time you want a change (new feature, different colors, etc.), just edit the files in your GitHub repo (or ask me to write the updated code) and commit — GitHub Pages auto-redeploys within a minute or two. Refresh the app on your devices to get the update.
