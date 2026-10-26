# HOLLOW VIGIL

A Dead-by-Daylight-style horror game built with **Three.js**: 1 monster vs 4 survivors.

- **Singleplayer:** you plus 4 bots. The whole simulation runs in your browser.
- **Multiplayer:** up to 5 players. Empty seats are filled with bots. The match runs on the server (Render) and the client is hosted on Netlify.

```
client/   Vite + Three.js frontend (menus, lobby, rendering, audio, input)  -> Netlify
server/   Express + Socket.IO lobby & authoritative match server           -> Render
shared/   Game rules, map generator, bots (used by BOTH server and browser)
```

## Run locally

```bash
# terminal 1 – server
cd server
npm install
npm start                 # http://localhost:3000  (GET /health)

# terminal 2 – client
cd client
npm install
npm run dev               # http://localhost:5173
```

The client connects to `VITE_SERVER_URL`. If that isn't set, it uses `http://localhost:3000`.
Debug: `http://localhost:5173/?as=monster` or `?as=survivor` forces your singleplayer role.

Tests:
```bash
cd server
node simtest.js           # 5 full bot-only matches (one per monster)
node mptest.mjs           # needs the server running: 2 clients lobby + match
```

## Deploy

### 1. Push to GitHub
```bash
git add -A
git commit -m "Hollow Vigil"
git branch -M main
git remote add origin https://github.com/<you>/hollow-vigil.git
git push -u origin main
```

### 2. Backend on Render
1. Go to https://dashboard.render.com and choose **New → Blueprint**, then pick your repo. Render reads `render.yaml`.
   *(Or do it manually: **New → Web Service**, Runtime **Node**, Root Directory *(empty)*,
   Build `cd server && npm install`, Start `cd server && npm start`, Health check `/health`.)*
2. Wait for the deploy, then open `https://<name>.onrender.com/health` to check it.
3. Copy the URL, e.g. `https://hollow-vigil-server.onrender.com`.

> The free Render plan sleeps after 15 minutes idle, and the first connection takes about 50s to wake it.
> The game waits up to 60s and shows a message while it does. Use a paid instance if you want it always on.

### 3. Frontend on Netlify
1. Go to https://app.netlify.com and choose **Add new site → Import an existing project**, then pick the same repo.
   Netlify reads `netlify.toml` (base `client`, build `npm install && npm run build`, publish `dist`).
2. **Site configuration → Environment variables → Add**:
   `VITE_SERVER_URL = https://hollow-vigil-server.onrender.com` (no trailing slash).
3. **Deploys → Trigger deploy** (Vite bakes the variable in at build time, so you must redeploy after changing it).

### 4. Lock CORS (recommended)
In Render, go to **Environment** and set `CLIENT_ORIGIN = https://<your-site>.netlify.app`.
Separate multiple origins with commas. Then save, which redeploys the server.

## How to play
| Survivor | | Monster | |
|---|---|---|---|
| WASD / Shift | move / run | LMB | attack |
| C / X | crouch / crawl (hide in tall grass) | Q | special ability |
| hold E | enchant tomb, rescue, heal, place keys, disarm | RMB hold/release | trident (Stalker) / string (Puppeteer) |
| Space | skill check / struggle when hanged / **jump** (vault fences, sills, tombs, wrecks) | R | rev chainsaw (Ravager) |
| F / G / V | hold candle / place-pick up / light-snuff | T | set trap |
| A / D | wiggle when carried | hold E / Z | pick up, hang, kill, damage tombs / drop |

**Rules:** enchanting 1 tomb seals the monster's special. 2 tombs make it slower with shorter reach. 3 tombs spawn 3 keys; bring them to the gate.
You have 2 lives. On the first, a downed survivor is hanged and can be rescued. On the second, the monster kills instantly and you return as a **mouse** (scanned rat model): Shift to scurry fast, Space to leap, Tab to spectate survivors. Only other dead players can see mice.

## Assets
Realistic models and PBR textures (dead trees, mossy rocks, shrubs, ferns, cars, barrels, iron gate, street lamps, stone/plank/slate textures) are **CC0 from [Poly Haven](https://polyhaven.com)**. They live in `client/public/assets` (~86 MB, committed so Netlify serves them). To re-download or change the list: `node tools/fetch-assets.mjs`.

## Settings
The main menu and in-game ESC menu have Graphics (Low / Medium / High presets), Video (brightness, FOV, vignette, optional film grain, FPS counter), Audio (master / ambience / effects), Controls (sensitivity, invert Y, rebind every key) and Interface (mini-map on/off and size). **M** toggles the mini-map.

## Credits
The character model is `Soldier.glb` from the three.js examples (MIT). It's re-tinted in a shader per skin and paired with procedural hats and masks.
Everything else (textures, props, audio) is generated procedurally in code.
To use your own humans, replace `client/public/models/Soldier.glb` with any Mixamo-rigged GLB that has `Idle`, `Walk`, and `Run` clips.
