# SamkokGo multiplayer contract v1

Source of truth: `shared/protocol.mjs` (imported by Cloudflare Worker).

## API
- `GET /api/protocol`: supported protocol and rulesets.
- `GET /api/rooms?ruleset=godot-alpha&protocol=1`: list only compatible rooms.
- `POST /api/create?ruleset=godot-alpha&protocol=1`: create a room.
- `POST /api/quick-join?ruleset=godot-alpha&protocol=1`: join a compatible room or create one.
- `GET /ws?room=ABCD1234&hero=liubei&ruleset=godot-alpha&protocol=1`: WebSocket connection; incompatible direct invites return 409.
- Missing ruleset defaults to `threejs-alpha` for legacy browsers; unknown rulesets return HTTP 400, unsupported protocol versions HTTP 426.

## Shared wire format
Room snapshots contain `room` and `players[]`; rooms now include `ruleset`, `protocolVersion`, and `roundSeconds`. `welcome` contains `selfId`, `resumeToken`, `snapshot`, and optional `gameState`. Movement `input` has `x`, `z`, `px`, `pz`. Host `game-state` snapshots contain `enemies[]`, `pickups[]`, `boss`, `xp`, `level`, and `playerVitals`. Other messages include `start`, `players`, `presence`, `room`, `lock`, `configure`, `ability`, `level-choice`, and combat effects.

## Compatibility
- `threejs-alpha`: 12 minutes, current Three.js-specific combat and upgrade schema.
- `godot-alpha`: 6 minutes, current Godot-specific combat and pickup schema.
- The clients share the networking infrastructure, but **do not yet support one cross-engine battle**: cross-engine room matching and direct joining are blocked to avoid broken damage, health, XP and boss rules.
- Actual crossplay requires aligning enemy IDs, upgrades, pickups, combat authority, boss timing, victory conditions, and the state schema. Only then add a common ruleset (e.g., `crossplay-v1`) and integration tests.

## Deployments
- Production is the existing `main` branch, Worker `samkokgo`; it is not modified by this integration commit.
- Godot 4.3 preview builds from `godot4-integration`, Worker `samkokgo-godot-preview`, using `wrangler.godot-preview.toml`. This prevents auto-overwriting production.
- The preview Action requires repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. A passing Action and online test are still required to confirm deployment.

The `godot4-integration` branch's default `wrangler.toml` also targets `samkokgo-browser-preview` for manual `npm run deploy` commands, preventing a local deploy from overwriting production. The two preview Workers have independent Durable Object storage and cannot share room IDs until explicitly moved to one common service.

## Server-owned cross-engine battle preview (Stage 2)

The shared `crossplay-v1` ruleset is available on the isolated preview deployment.
Both renderers now default to `crossplay-v1` in this branch, while Three.js can use `?classic=1` for its legacy engine-specific mode. The two legacy rulesets remain separated for compatibility.

Cloudflare Durable Objects runs the combat simulation on 250ms alarms, handling enemy spawning and movement, hero auto-attacks, health, boss (5-minute spawn), six-minute result, experience, upgrade eligibility and revival. Movement is server-integrated from direction/delta; client-reported absolute coordinates are ignored. Direct client enemy and damage snapshots are rejected in crossplay rooms.

The Godot preview Worker serves both frontends on **one origin**:
- `/`: Three.js renderer
- `/godot/`: Godot 4.3 Web renderer
- `/api/*` and `/ws`: common multiplayer Durable Object

Important: The preview branch must pass Godot build, JavaScript tests and live mixed-engine 2-client / 4-6-client checks before claiming the experience production-ready. The `main` production deployment remains unchanged. These are prototype gameplay rules and are **not** the original engine-specific rules.

Crossplay abilities have a 20-second server cooldown; Three.js displays the server cooldown and Godot triggers the skill with Space. Server positions are reconciled against local client predictions. Browser combat simulation is disabled for the crossplay ruleset.

Mixed-engine invites: `/?room=<ID>` opens the Three.js browser, and `/godot/?room=<ID>` opens the Godot 4.3 browser. On the crossplay preview Worker both links join the **same** Durable Object room. The Three.js lobby copies both links for the room owner.
