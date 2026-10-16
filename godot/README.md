# Godot 4 combat prototype

This branch contains an isolated Godot 4.3 prototype. The existing browser game and Cloudflare deployment remain untouched on `main`.

## Playable systems in this prototype

- A 6-minute survivors-style run with a Morandi woodland battlefield.
- Liu Bei moves with WASD/arrow keys or by dragging from any touch point.
- Automatic nearest-enemy spear shots with hit sparks and impact particles.
- Chasing melee soldiers and retreating ranged soldiers that fire aimed projectiles.
- Shared enemy, pickup, team XP, and upgrade state, plus visible teammate movement and attacks.
- Team health snapshots, downed/eliminated states, and a 3-second nearby revive window; downed players are eliminated after 25 seconds.
- Experience drops, level-up choices, an elite boss at minute five, and victory/defeat screens.
- The lobby can create or quick-join through the existing Cloudflare room API.

GitHub Actions checks the Worker and browser scripts, imports and launches the Godot project headlessly, exports a Godot Web build, and stores that browser build as a downloadable artifact for 14 days.

## Current scope

Co-op synchronization is an early prototype. The room host owns enemy simulation and team progression; teammate movement, attacks, shared drops, player health, and revive progress are synchronized through snapshots and Worker events. Enemy projectile visuals are still local to the host simulation, so the ranged attack presentation needs another multiplayer pass. A live 4–6 player playtest is still outstanding. The figures and battlefield are temporary procedural shapes, not the requested detailed pixel-art assets or final 2.5D models. The Web export is built automatically, but it is not yet wired into the Cloudflare deployment. The deployed browser game is unchanged.
