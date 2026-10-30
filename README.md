# THE LAST RITUAL

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
node chasetest.js         # running monster catches a running survivor; logs block survivors
node featuretest.js       # traps, chests & loot, windows, enchant reveal
node pickuptest.js        # picking up a crawling downed survivor
node mptest.mjs           # needs the server running: 2 clients lobby + match
```

Accounts: the server stores accounts and profiles (level, XP, coins, shards, unlocks, achievements)
in `server/data/accounts.json` (set `DATA_DIR` to move it — on Render use a persistent disk).
Passwords and recovery keys are salted scrypt hashes. Players without the server can play as guests
(progress kept in the browser).

## Deploy

### 1. Push to GitHub
```bash
git add -A
git commit -m "The Last Ritual"
git branch -M main
git remote add origin https://github.com/<you>/hollow-vigil.git
git push -u origin main
```

### 2. Backend on Render
1. Go to https://dashboard.render.com and choose **New ? Blueprint**, then pick your repo. Render reads `render.yaml`.
   *(Or do it manually: **New ? Web Service**, Runtime **Node**, Root Directory *(empty)*,
   Build `cd server && npm install`, Start `cd server && npm start`, Health check `/health`.)*
2. Wait for the deploy, then open `https://<name>.onrender.com/health` to check it.
3. Copy the URL, e.g. `https://hollow-vigil-server.onrender.com`.

> The free Render plan sleeps after 15 minutes idle, and the first connection takes about 50s to wake it.
> The game waits up to 60s and shows a message while it does. Use a paid instance if you want it always on.

### 3. Frontend on Netlify
1. Go to https://app.netlify.com and choose **Add new site ? Import an existing project**, then pick the same repo.
   Netlify reads `netlify.toml` (base `client`, build `npm install && npm run build`, publish `dist`).
2. **Site configuration ? Environment variables ? Add**:
   `VITE_SERVER_URL = https://hollow-vigil-server.onrender.com` (no trailing slash).
3. **Deploys ? Trigger deploy** (Vite bakes the variable in at build time, so you must redeploy after changing it).

### 4. Lock CORS (recommended)
In Render, go to **Environment** and set `CLIENT_ORIGIN = https://<your-site>.netlify.app`.
Separate multiple origins with commas. Then save, which redeploys the server.

## How to play
| Survivor | | Monster | |
|---|---|---|---|
| WASD / Shift | move / run (no stamina limit) | LMB | attack |
| C / X | crouch / crawl (hide in tall grass) | Q | special ability |
| hold E | enchant tomb, rescue, heal, place keys, disarm | RMB hold/release | trident (Stalker) / string (Puppeteer) |
| Space | skill check / struggle when hanged / **jump** (vault fences, sills, tombs, wrecks) | R | rev chainsaw (Ravager) |
| F / G / V | hold candle / place-pick up / light-snuff | T | set trap |
| A / D | wiggle when carried | hold E / Z | pick up, hang, kill, damage tombs / drop |

**Rules:** enchanting 1 tomb seals the monster's special. 2 tombs make it slower with shorter reach. 3 tombs spawn 3 keys; bring them to the gate.
You have 2 lives. On the first, a downed survivor is hanged and can be rescued. On the second, the monster kills instantly and you return as a **mouse** (scanned rat model): Shift to scurry fast, Space to leap, Tab to spectate survivors. Only other dead players can see mice. The dead see everything on the mini-map (monster, survivors, tombs, gate, keys) and see the monster's aura.

**Map:** a two-storey mansion in the centre (stairs on the north wall, jump out of an upstairs window to escape), two farmhouses and two wrecked houses, a walled cemetery in a south corner, and ruined walls with **pallets**: press **E** beside one (even mid-sprint) to slam it across the doorway. It stuns a monster caught under it, blocks the monster until it's smashed (hold E), and survivors can vault it with Space. Tomb enchanting throws SPACE skill checks with a 'GET READY' beat, a slow needle and a wide zone. **Auras (like DbD):** a failed skill check reveals that survivor to the monster for 5s (through walls + on its mini-map), and hanging a survivor reveals the monster to the others for 6s. The monster's mini-map shows tombs, gate and keys, but survivors only while their aura shows. Survivors see allies, gate and keys. **Fallen logs** are solid: jump them (SPACE). The monster climbs over them slowly. The **monster runs** (Shift, faster than survivors) and attacks with a short **lunge** (LMB), seen in first person with its hands, weapon and animations. The mansion has a furnished old corridor running east-west through the ground floor, rooms off it, a furnished loft, and candle sconces, chandeliers and fireplaces for light.

## Assets
Realistic models and PBR textures (dead trees, mossy rocks, shrubs, ferns, cars, barrels, iron gate, street lamps, stone/plank/slate textures) are **CC0 from [Poly Haven](https://polyhaven.com)**. They live in `client/public/assets` (~86 MB, committed so Netlify serves them). To re-download or change the list: `node tools/fetch-assets.mjs`.

## Settings
The main menu and in-game ESC menu have Graphics (Low / Medium / High presets), Video (brightness, FOV, vignette, optional film grain, FPS counter), Audio (master / ambience / effects), Controls (sensitivity, invert Y, rebind every key) and Interface (mini-map on/off and size). **M** toggles the mini-map.

## Credits
Characters are the rigged models in `/characters` (one per monster + the survivor). They're optimized into `client/public/models/chars/*.glb` (WebP textures, root motion removed, clips renamed Walk / Run / InjuredRun / Jump) by `node .tools/convert-chars.mjs` (run `npm install` in `.tools` first). Survivors share one model and are told apart by a per-skin clothing tint.
Everything else (textures, props, audio) is generated procedurally in code.
To change a character, replace its GLB in ``/characters`` (same 52-bone Mixamo-style skeleton) and re-run the converter.
