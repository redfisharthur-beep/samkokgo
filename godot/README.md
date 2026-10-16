# Godot 4 combat prototype

This branch contains an isolated Godot 4.3 prototype. The existing browser game and Cloudflare deployment remain untouched on `main`.

## Playable systems in this prototype

- A 6-minute survivors-style run with a Morandi woodland battlefield.
- Liu Bei moves with WASD/arrow keys or by dragging from any touch point.
- Automatic nearest-enemy spear shots with hit sparks and impact particles.
- Chasing melee soldiers and retreating ranged soldiers that fire aimed projectiles, with projectile visuals relayed to the full team.
- Shared enemy, pickup, team XP, and upgrade state, plus visible teammate movement and attacks.
- Team health snapshots, downed/eliminated states, and a 3-second nearby revive window; downed players are eliminated after 25 seconds.
- Experience drops, level-up choices, an elite boss at minute five, and victory/defeat screens.
- The lobby can create or quick-join through the existing Cloudflare room API.

GitHub Actions checks the Worker and browser scripts, imports and launches the Godot project headlessly, exports a Godot Web build, and stores that browser build as a downloadable artifact for 14 days.

## Current scope

Co-op synchronization is an early prototype. The room host owns enemy simulation and team progression; teammate movement, attacks, shared drops, player health, and revive progress are synchronized through snapshots and Worker events. The host simulates ranged attacks and damage while all connected players render the relayed projectile path. A live 4–6 player playtest is still outstanding. A live 4–6 player playtest is still outstanding. The figures and battlefield are temporary procedural shapes, not the requested detailed pixel-art assets or final 2.5D models. The Web export is built automatically, and `godot4-integration` deploys to the **isolated preview** Worker `samkokgo-godot-preview` (subject to successful GitHub Actions and configured Cloudflare secrets). The production `samkokgo` Worker is not overwritten. Both clients now advertise protocol v1, but incompatible combat rulesets are segregated until crossplay is implemented. See `../shared/PROTOCOL.md`.

For manual deployments on this integration branch, `npm run deploy` targets the separate `samkokgo-browser-preview` Worker, not production. The Godot Web build uses the dedicated GitHub Actions preview workflow and `wrangler.godot-preview.toml` instead.

## Cross-engine co-op preview

The Godot and Three.js browsers can now share a `crossplay-v1` test room via the same preview Worker. The Godot client is mounted at `/godot/`, the Three.js client at `/`. Enemy combat, rewards, upgrades, revives and final result are computed by Cloudflare, not the host browser. Preview can be deployed only after the Godot build passes and Cloudflare secrets are configured; mixed-client gameplay requires live verification.
