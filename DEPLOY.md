# Put THE LAST RITUAL online (beginner guide)

You will do 4 things: **GitHub** (store the code) → **Render** (the multiplayer server) → **Netlify** (the website) → **play with friends**.
All of it is free. Do the steps in order.

---

## Step 1 – Push the game to GitHub

1. Install Git: https://git-scm.com/download/win (click Next on everything).
2. Make a free account at https://github.com.
3. On GitHub click **+ → New repository**. Name it `last-ritual`. Choose **Private** or Public. Do **not** tick "Add a README". Click **Create repository**. Keep the page open; it shows your address like `https://github.com/YOURNAME/last-ritual.git`.
4. Open **PowerShell** and run these one at a time (replace the address with yours):

```powershell
cd "F:\Horror multiplay"
git config --global user.name "YourName"
git config --global user.email "you@example.com"
git add .
git commit -m "The Last Ritual"
git branch -M main
git remote add origin https://github.com/YOURNAME/last-ritual.git
git push -u origin main
```

5. A browser window asks you to sign in to GitHub. Do it. If it asks for a password in the terminal, use a **token**: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate, tick `repo`, paste it as the password.
6. Refresh the GitHub page. Your files are there. (The big `characters/` folder, `node_modules` and `dist` are skipped on purpose.)

Later, to upload changes: `git add .` → `git commit -m "update"` → `git push`.

---

## Step 2 – Deploy the server on Render

1. Make an account at https://render.com (**Sign in with GitHub** is easiest).
2. Click **New + → Blueprint**. Connect your `last-ritual` repo. Render reads `render.yaml` automatically. Click **Apply / Deploy**.
   - If Blueprint gives trouble, use **New + → Web Service** instead, with: Root Directory = (leave empty), Build Command = `cd server && npm install`, Start Command = `cd server && npm start`, Instance = Free, Health Check Path = `/health`, Environment variable `NODE_VERSION` = `20`.
3. Wait until it says **Live** (a few minutes). Copy the address at the top, like `https://last-ritual-server.onrender.com`.
4. Test it: open `https://YOUR-ADDRESS.onrender.com/health` – you should see `{"ok":true,...}`.

Notes:
- The free server **falls asleep** after 15 minutes of no use. The first visit afterwards takes about 50 seconds. Open the `/health` link before playing to wake it.

### Optional (recommended): keep accounts forever
Render's free disk is wiped on restart, so accounts/profiles would reset. To avoid it:
1. Make a free account at https://upstash.com → **Create database** (Redis, any region, free).
2. On the database page, find the **REST API** section, copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Render → your service → **Environment** → add both variables with those values → Save (it redeploys).

---

## Step 3 – Build the `dist` folder and put it on Netlify

1. Install Node.js (LTS) from https://nodejs.org if you haven't.
2. In PowerShell:

```powershell
cd "F:\Horror multiplay\client"
npm install
npm run build
```

3. Open `F:\Horror multiplay\client\dist\config.js` in Notepad. Replace `PASTE_YOUR_RENDER_URL_HERE` with your Render address (keep the quotes, no slash at the end):

```js
window.TLR_SERVER_URL = "https://last-ritual-server.onrender.com";
```
Save. (A `dist` folder is already built for you; you only need to edit this file.)

4. Go to https://app.netlify.com/drop (make a free account). **Drag the whole `dist` folder** onto the page. You get a link like `https://random-name.netlify.app`. You can rename it in Site settings → Change site name.

---

## Step 4 – Lock the server to your website (optional but safer)
Render → your service → Environment → `CLIENT_ORIGIN` = your Netlify address (e.g. `https://random-name.netlify.app`, no slash at the end) → Save. Leave `*` if you just want it to work with anything.

---

## Play with friends
1. Open the `/health` link of your Render server first (wakes it).
2. Everyone opens the Netlify link, makes an account (or Guest), and clicks **Multiplayer / Create lobby**.
3. Send the lobby **code** to your friends; they click Join and enter it. The host starts the match. Empty spots are filled by NPCs.

## If something goes wrong
- **"Cannot connect" / stuck loading**: server is asleep – open `/health`, wait a minute, refresh. Also check `dist/config.js` has the right address and you re-uploaded `dist` after editing it.
- **Blocked by CORS**: `CLIENT_ORIGIN` on Render must exactly match your Netlify address, or be `*`.
- **`git push` rejected**: run `git pull origin main --rebase` then `git push`.
- **Accounts vanished**: do the Upstash step above.
- **Changed the game code?** Re-run `npm run build`, edit `dist/config.js` again, and drag `dist` to Netlify (Deploys tab → drag again). Push server changes with `git push`; Render redeploys itself.
- Netlify via GitHub (alternative to drag & drop): New site → Import from Git → pick the repo; `netlify.toml` has the settings; add environment variable `VITE_SERVER_URL` = your Render address.

---

## Fixes for "stuck on Connecting to server" / "I have to log in every time"

1. **config.js must have your Render address.** In `dist\config.js` the line must say `window.TLR_SERVER_URL = "https://YOUR-NAME.onrender.com";` (not `PASTE_YOUR_RENDER_URL_HERE`). The game now tells you if this was forgotten. Re-upload `dist` to Netlify after editing.
2. **Keep the free server awake.** Make a free account at https://uptimerobot.com → Add monitor → type *HTTP(s)* → URL `https://YOUR-NAME.onrender.com/health` → every 5 minutes. The server then never sleeps, so multiplayer connects instantly. (Without it the first connection after a pause takes up to a minute, and the game now waits for it instead of giving up.)
3. **Accounts that survive restarts.** Do the Upstash step in Step 2. Without it Render wipes accounts when it restarts, which forces a new sign-up. With it, you stay signed in even after refreshing, closing the tab or a server restart.

---

## New in this version (what to do)

1. **Upload the new server code** (the weekly leaderboard, private lobbies and the speed fix are on the server too):
   `cd "F:\Horror multiplay"` then `git add .`, `git commit -m "update"`, `git push`. Render redeploys by itself (about 2 minutes).
2. **Drag the new `client\dist` folder onto Netlify** (Deploys tab → drag again). `config.js` already holds your Render address.
3. **Make the multiplayer feel instant - move the server close to the players.** The free Render server you made is in the USA by default; every click then travels around the world twice. Create it again in **Singapore** (best for India):
   Render → New → Blueprint → pick the repo (`render.yaml` now says `region: singapore`) → Apply. Copy the new address, put it in `client\dist\config.js`, upload `dist` to Netlify again, then delete the old service. (A small number next to the bottom-right corner of the game shows your ping in ms: under 90 is great.)
   Also set the same `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` variables on the new service so accounts carry over.
4. **Weekly leaderboard:** it resets every **Monday 12:30 pm India time**. To use another time zone set the Render variable `RESET_TZ_OFFSET_MIN` (minutes from UTC, e.g. `0` for London, `-300` for New York winter). The player in first place at the reset gets **10 soul shards + 400 ritual coins**; the game pays it out the next time that player opens the game.
5. **Install as app:** the first screen offers it. On Android/PC the **Install app** button installs it and copies the game files to the phone (about 19 MB for phones). On iPhone use Share → Add to Home Screen. Skip works as before.

---

## In-game "Report" button: make the reports arrive in your Gmail

Players type their Gmail + message (+ up to 2 screenshots) in the game; the **server** e-mails it to you, so players never see your address. Render's free plan blocks normal e-mail sending, so we use the free **Resend** service (100 mails/day):

1. Go to https://resend.com and sign up **with the Gmail address that should receive the reports** (important: the free test sender can only mail the address you registered with).
2. In Resend: **API Keys → Create API Key** (permission: *Sending access*) → copy the key (starts with `re_`).
3. In Render: your service → **Environment** → add two variables:
   - `RESEND_API_KEY` = the key you copied
   - `REPORT_TO_EMAIL` = your Gmail address (the one you registered at Resend)
   Save. Render restarts the server.
4. Test it: open the game → **Report** → write something → Send. The mail arrives in your inbox with the subject "[The Last Ritual] Report from …". Press **Reply** in Gmail to answer the player (the reply goes to the Gmail they typed).

Until these two variables are set, reports are only saved on the server (nothing is e-mailed). Keep the address in Render's Environment only - do not write it into files you push to GitHub.

---

## Report mail without another service (Gmail app password)

The developer address is now built into the server code **encrypted** (`server/inbox.js`), so you do not need `REPORT_TO_EMAIL` or Resend any more. The server sends the mail through Gmail itself. Gmail needs one thing from you - an *app password* (a separate password just for this server, not your real one):

1. Google Account → **Security** → turn on **2-Step Verification** (if it is off).
2. Search "App passwords" in the account settings → create one named `Last Ritual` → copy the 16 letters.
3. Render → your service → **Environment** → add `GMAIL_APP_PASSWORD` = those 16 letters (no spaces) → Save.

Important: Render's **free** plan blocks outgoing mail ports (SMTP), so on the free plan Gmail may refuse to connect. If a report cannot be sent it is kept in the server's `reports` folder instead (nothing is lost), and the old `RESEND_API_KEY` + `REPORT_TO_EMAIL` option still works as a backup route. A paid Render instance (or any host that allows SMTP) makes the Gmail route work.
