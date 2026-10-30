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
