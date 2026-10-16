# Godot 4 integration scaffold

This branch adds a separate Godot 4 client scaffold while keeping the current browser game and Cloudflare Worker in place.

## What it proves

- Godot client can call the existing `/api/rooms`, `/api/create`, and `/api/quick-join` routes.
- It joins the existing `/ws?room=…&hero=…` WebSocket endpoint and parses the existing welcome, presence, and start messages.
- Web builds derive the service origin from the page URL. Native builds use `http://127.0.0.1:8787` unless `worker_base_url` is set in the `CloudflareRoom` node.
- The project uses Godot 4's Compatibility renderer, suitable for its WebGL 2 export path.

## Open and run

Open this folder in Godot 4.x and run the main scene. For local testing, run the existing Worker with `npm run dev` from the repository root. For native testing against a deployed Worker, set `worker_base_url` to the Worker HTTPS origin in the CloudflareRoom node.

The scene is a networking harness, not the finished game. Character art, combat simulation, skill effects, input controls, and the Godot export preset still need to be migrated and validated in Godot. The deployed browser version is unchanged.

## Next migration steps

1. Port the combat loop and input into Godot nodes while preserving the current room message schema.
2. Replace procedural block figures with coherent 128×128 pixel-art sprite sheets or authored 2.5D models and animation states.
3. Validate 2–6 browser clients and mobile touch controls in a Web export.
4. Add an export preset and place validated Web export files under the Cloudflare Assets directory.
