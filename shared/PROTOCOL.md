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
