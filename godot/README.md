# Godot 4 combat prototype

This branch contains an isolated Godot 4.3 prototype. The existing browser game and Cloudflare deployment remain untouched on `main`.

## Playable systems in this prototype

- A 6-minute survivors-style run with a Morandi woodland battlefield.
- Liu Bei moves with WASD/arrow keys or by dragging from any touch point.
- Automatic nearest-enemy spear shots with hit sparks and impact particles.
- Chasing melee soldiers and retreating ranged soldiers that fire aimed projectiles.
- Experience drops, level-up card choices, stat upgrades, an elite boss at minute five, and victory/defeat screens.
- The lobby can create or quick-join through the existing Cloudflare room API.

Run the main scene in Godot 4.3. The GitHub Actions workflow imports the project and starts it headlessly after each change.

## Current scope

The combat is a single-player prototype. The room API can connect players, but their positions, enemies, combat state, and upgrades are not yet synchronized. The figures and battlefield are temporary procedural shapes, not the requested detailed pixel-art assets or final 2.5D models. A validated Godot Web export and Cloudflare hosting configuration are still to be added. The deployed browser game is unchanged.
