import { DurableObject } from "cloudflare:workers";
import { PROTOCOL_VERSION, RULESETS, resolveRuleset, sameRuleset, durationForRuleset } from "./shared/protocol.mjs";

const MAX_PLAYERS = 6;
const WORLD_LIMIT = 48;
const WORLD_DEPTH_LIMIT = 27;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname === "/ws") {
      const id = env.GAME_HUB.idFromName("samkokgo-lobby");
      const hub = env.GAME_HUB.get(id);
      return hub.fetch(request);
    }
    if (url.pathname === "/index.wasm") {
      return serveWasm(env, request.url);
    }
    return env.ASSETS.fetch(request);
  }
};

async function serveWasm(env, requestUrl) {
  const assetHeaders = new Headers({ "accept-encoding": "identity" });
  const manifestResponse = await env.ASSETS.fetch(
    new Request(new URL("/index.wasm.parts.json", requestUrl), { headers: assetHeaders })
  );
  if (!manifestResponse.ok) return new Response("WebAssembly parts are unavailable.", { status: 503 });

  let manifest;
  try {
    manifest = await manifestResponse.json();
  } catch {
    return new Response("WebAssembly manifest is invalid.", { status: 503 });
  }
  if (!Number.isSafeInteger(manifest.size) || !Array.isArray(manifest.parts) ||
      manifest.parts.length < 1 || manifest.parts.length > 8) {
    return new Response("WebAssembly manifest is invalid.", { status: 503 });
  }

  const responses = await Promise.all(manifest.parts.map((path) =>
    env.ASSETS.fetch(new Request(new URL(path, requestUrl), { headers: assetHeaders }))
  ));
  if (responses.some((response) => !response.ok || !response.body ||
      response.headers.get("content-type")?.includes("text/html"))) {
    return new Response("A WebAssembly part could not be loaded.", { status: 503 });
  }

  const body = new ReadableStream({
    async start(controller) {
      let totalBytes = 0;
      try {
        for (const response of responses) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            controller.enqueue(value);
          }
        }
        if (totalBytes !== manifest.size) throw new Error("WebAssembly size mismatch");
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
  return new Response(body, {
    headers: {
      "content-type": "application/wasm",
      "content-length": String(manifest.size),
      "cache-control": "public, max-age=0, must-revalidate"
    }
  });
}

/**
 * A single lobby object is enough for the first small-scale prototype.
 * It owns matchmaking and room presence; each room is separated by WebSocket tags.
 */
export class GameHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    // Both renderers speak protocol v1 but use separate combat rulesets.
    if (url.pathname === "/api/protocol" && request.method === "GET") {
      return json({ protocolVersion: PROTOCOL_VERSION, rulesets: RULESETS });
    }
    const requestedRuleset = resolveRuleset(url.searchParams.get("ruleset"));
    if (!requestedRuleset) return json({ error: "Unknown game ruleset" }, 400);
    const clientVersion = url.searchParams.get("protocol");
    if (clientVersion !== null && Number(clientVersion) !== PROTOCOL_VERSION) {
      return json({ error: "Unsupported protocol version", supported: PROTOCOL_VERSION }, 426);
    }
    // Godot sends an empty JSON body with room-creation and quick-join POSTs.
    // Consume bodies these routes do not use before returning a response; workerd
    // reports an exception if a Durable Object leaves the request body unread.
    if ((url.pathname === "/api/create" || url.pathname === "/api/quick-join") && request.body) {
      await request.arrayBuffer();
    }
    if (url.pathname === "/api/rooms" && request.method === "GET") {
      return json({ rooms: await this.listRooms(requestedRuleset) });
    }
    if (url.pathname === "/api/create" && request.method === "POST") {
      const room = await this.createRoom(requestedRuleset);
      return json({ roomId: room.id });
    }
    if (url.pathname === "/api/quick-join" && request.method === "POST") {
      const room = await this.quickJoin(requestedRuleset);
      return json({ roomId: room.id });
    }
    if (url.pathname === "/ws") {
      return this.connect(request, url);
    }
    return json({ error: "Not found" }, 404);
  }

  async listRooms(requestedRuleset) {
    const rooms = (await this.ctx.storage.get("rooms")) ?? {};
    const visible = [];
    for (const room of Object.values(rooms)) {
      if (!sameRuleset(room.ruleset, requestedRuleset)) continue;
      this.cleanDisconnected(room);
      const connected = this.ctx.getWebSockets(tagFor(room.id)).length;
      const players = connected + Object.keys(room.disconnected ?? {}).length;
      if (connected === 0) continue;
      if (this.canJoinPlaying(room) && !room.locked && players < room.maxPlayers) {
        visible.push({ id: room.id, players, maxPlayers: room.maxPlayers, mapId: room.mapId,
          difficulty: room.difficulty, status: room.status, ruleset: room.ruleset ?? "threejs-alpha",
          roundSeconds: durationForRuleset(room.ruleset) });
      }
    }
    return visible.sort((a, b) => b.players - a.players).slice(0, 20);
  }

  async createRoom(requestedRuleset) {
    const rooms = (await this.ctx.storage.get("rooms")) ?? {};
    const id = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    const room = {
      id,
      maxPlayers: MAX_PLAYERS,
      locked: false,
      status: "waiting",
      ruleset: requestedRuleset,
      protocolVersion: PROTOCOL_VERSION,
      roundSeconds: durationForRuleset(requestedRuleset),
      hostId: null,
      startedAt: null,
      mapId: "forest",
      difficulty: "normal",
      disconnected: {},
      createdAt: Date.now()
    };
    rooms[id] = room;
    await this.ctx.storage.put("rooms", rooms);
    return room;
  }

  async quickJoin(requestedRuleset) {
    const rooms = (await this.ctx.storage.get("rooms")) ?? {};
    const room = Object.values(rooms)
      .filter((candidate) => sameRuleset(candidate.ruleset, requestedRuleset) && this.canJoinPlaying(candidate) && !candidate.locked)
      .map((candidate) => {
        this.cleanDisconnected(candidate);
        const connected = this.ctx.getWebSockets(tagFor(candidate.id)).length;
        return { candidate, count: connected + Object.keys(candidate.disconnected ?? {}).length, connected };
      })
      .filter(({ candidate, count, connected }) => connected > 0 && count < candidate.maxPlayers)
      .sort((a, b) => b.count - a.count)[0]?.candidate;
    return room ?? this.createRoom(requestedRuleset);
  }

  async connect(request, url) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "WebSocket upgrade required" }, 426);
    }
    const roomId = (url.searchParams.get("room") ?? "").toUpperCase();
    if (!/^[A-F0-9]{8}$/.test(roomId)) return json({ error: "Room unavailable" }, 404);
    const rooms = (await this.ctx.storage.get("rooms")) ?? {};
    const room = rooms[roomId];
    if (!room) return json({ error: "Room unavailable" }, 404);
    if (!sameRuleset(room.ruleset, resolveRuleset(url.searchParams.get("ruleset"))) ||
        (room.protocolVersion ?? PROTOCOL_VERSION) !== PROTOCOL_VERSION) {
      return json({ error: "Incompatible room ruleset or protocol" }, 409);
    }
    this.cleanDisconnected(room);
    const tag = tagFor(roomId);
    const existing = this.ctx.getWebSockets(tag);
    room.disconnected ??= {};
    const resumeToken = url.searchParams.get("resume");
    const resumed = resumeToken ? room.disconnected[resumeToken] : null;
    const canResume = Boolean(resumed && Date.now() - (resumed.disconnectedAt ?? 0) <= 30000);
    if ((room.locked && !canResume) || (!this.canJoinPlaying(room) && !canResume)) return json({ error: "Room is closed" }, 409);
    if (!resumed && existing.length + Object.keys(room.disconnected).length >= room.maxPlayers) return json({ error: "Room is full" }, 409);
    if (resumed) delete room.disconnected[resumeToken];

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const playerId = resumed?.playerId ?? crypto.randomUUID();
    const hostId = room.hostId ?? playerId;
    const spawnPoints = [[0, 0], [-3, 0], [3, 0], [0, -3], [-2, 3], [2, 3]];
    const [spawnX, spawnZ] = spawnPoints[existing.length] ?? [0, 0];
    const attachment = resumed ? { ...resumed, roomId, host: playerId === hostId } : {
      roomId,
      playerId,
      host: playerId === hostId,
      x: spawnX,
      z: spawnZ,
      colorIndex: existing.length % 6,
      moveX: 0,
      moveZ: 0,
      heroId: sanitizeHeroId(url.searchParams.get("hero")),
      resumeToken: crypto.randomUUID()
    };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server, [tag]);
    room.hostId = hostId;
    rooms[roomId] = room;
    await this.ctx.storage.put("rooms", rooms);
    server.send(JSON.stringify({ type: "welcome", selfId: playerId, resumeToken: attachment.resumeToken, snapshot: this.snapshot(room, [...existing, server]), gameState: room.gameState ?? null }));
    this.broadcast(roomId, { type: "presence", snapshot: this.snapshot(room, [...existing, server]) }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, rawMessage) {
    let message;
    try {
      message = JSON.parse(typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage));
    } catch {
      return;
    }
    const attachment = socket.deserializeAttachment();
    if (!attachment?.roomId) return;
    const rooms = (await this.ctx.storage.get("rooms")) ?? {};
    const room = rooms[attachment.roomId];
    if (!room) return;

    if (message.type === "input") {
      attachment.moveX = clampNumber(message.x, -1, 1);
      attachment.moveZ = clampNumber(message.z, -1, 1);
      attachment.x = clampNumber(message.px, -WORLD_LIMIT, WORLD_LIMIT);
      attachment.z = clampNumber(message.pz, -WORLD_DEPTH_LIMIT, WORLD_DEPTH_LIMIT);
      socket.serializeAttachment(attachment);
      this.broadcast(room.id, { type: "players", players: this.playerList(room.id, room) });
      return;
    }
    if (message.type === "player-pickup" && room.status === "playing") {
      const now = Date.now();
      const pickupId = String(message.pickupId ?? "").slice(0, 32);
      if (now - (attachment.lastPickupAt ?? 0) < 120 || !/^p-[0-9]{1,8}$/.test(pickupId)) return;
      attachment.lastPickupAt = now;
      socket.serializeAttachment(attachment);
      this.broadcast(room.id, {
        type: "player-pickup",
        playerId: attachment.playerId,
        pickupId
      }, socket);
      return;
    }
    if (message.type === "player-attack" && room.status === "playing") {
      const now = Date.now();
      const lastAttackAt = attachment.lastAttackAt ?? 0;
      const targetId = String(message.targetId ?? "").slice(0, 32);
      if (now - lastAttackAt < 250 || !/^e-[0-9]{1,8}$/.test(targetId)) return;
      attachment.lastAttackAt = now;
      socket.serializeAttachment(attachment);
      this.broadcast(room.id, {
        type: "player-attack",
        playerId: attachment.playerId,
        targetId,
        damage: clampNumber(message.damage, 1, 40)
      }, socket);
      return;
    }
    if (message.type === "game-state" && attachment.playerId === room.hostId && room.status === "playing") {
      const state = sanitizeGameState(message.state, durationForRuleset(room.ruleset));
      if (state) {
        this.broadcast(room.id, { type: "game-state", state }, socket);
        if (Date.now() - (room.gameStateSavedAt ?? 0) > 1500) {
          room.gameState = state;
          room.gameStateSavedAt = Date.now();
          rooms[room.id] = room;
          await this.ctx.storage.put("rooms", rooms);
        }
      }
      return;
    }
    if (message.type === "attack-fx" && attachment.playerId === room.hostId && room.status === "playing") {
      const from = sanitizePoint(message.from);
      const to = sanitizePoint(message.to);
      const heroId = ["liubei", "caocao", "sunquan", "lvbu"].includes(message.heroId) ? message.heroId : "liubei";
      const playerId = String(message.playerId ?? attachment.playerId).slice(0, 64);
      if (from && to) this.broadcast(room.id, { type: "attack-fx", from, to, heroId, playerId }, socket);
      return;
    }
    if (message.type === "enemy-shot-fx" && attachment.playerId === room.hostId && room.status === "playing") {
      const from = sanitizePoint(message.from);
      const to = sanitizePoint(message.to);
      const targetId = String(message.targetId ?? "").slice(0, 64);
      const shotId = String(message.shotId ?? "").slice(0, 80);
      const damage = clampNumber(message.damage, 1, 20);
      if (from && to && targetId && shotId) {
        this.broadcast(room.id, { type: "enemy-shot-fx", from, to, targetId, shotId, damage }, socket);
      }
      return;
    }
    if (message.type === "ability" && room.status === "playing") {
      this.broadcast(room.id, {
        type: "ability",
        playerId: attachment.playerId,
        x: attachment.x,
        z: attachment.z
      });
      return;
    }
    if (message.type === "level-choice" && attachment.playerId === room.hostId && room.status === "playing") {
      const upgradeId = ["power", "tempo", "reach", "speed"].includes(message.upgradeId) ? message.upgradeId : null;
      if (upgradeId) this.broadcast(room.id, { type: "level-choice", playerId: attachment.playerId, upgradeId });
      return;
    }
    if (message.type === "lock" && attachment.playerId === room.hostId && room.status !== "ended") {
      room.locked = !room.locked;
      rooms[room.id] = room;
      await this.ctx.storage.put("rooms", rooms);
      this.broadcast(room.id, { type: "room", room: this.publicRoom(room), players: this.playerList(room.id, room) });
      return;
    }
    if (message.type === "configure" && attachment.playerId === room.hostId && room.status === "waiting") {
      if (message.mapId !== undefined) room.mapId = sanitizeMapId(message.mapId);
      if (message.difficulty !== undefined) room.difficulty = sanitizeDifficulty(message.difficulty);
      const reservedCount = this.ctx.getWebSockets(tagFor(room.id)).length + Object.keys(room.disconnected ?? {}).length;
      if ([2, 4, 6].includes(message.maxPlayers) && message.maxPlayers >= reservedCount) room.maxPlayers = message.maxPlayers;
      rooms[room.id] = room;
      await this.ctx.storage.put("rooms", rooms);
      this.broadcast(room.id, { type: "room", room: this.publicRoom(room), players: this.playerList(room.id, room) });
      return;
    }
    if (message.type === "start" && attachment.playerId === room.hostId && room.status === "waiting") {
      room.status = "playing";
      room.startedAt = Date.now();
      room.gameState = null;
      room.gameStateSavedAt = 0;
      rooms[room.id] = room;
      await this.ctx.storage.put("rooms", rooms);
      this.broadcast(room.id, { type: "start", startedAt: room.startedAt, duration: durationForRuleset(room.ruleset), mapId: room.mapId, difficulty: room.difficulty });
    }
  }

  async webSocketClose(socket, code, reason) {
    await this.removePlayer(socket, code, reason);
  }

  async webSocketError(socket) {
    await this.removePlayer(socket);
  }

  async removePlayer(socket, code = 1006, reason = "") {
    const attachment = socket.deserializeAttachment();
    const roomId = attachment?.roomId;
    if (!roomId) return;
    const rooms = (await this.ctx.storage.get("rooms")) ?? {};
    const room = rooms[roomId];
    if (!room) return;
    const players = this.ctx.getWebSockets(tagFor(roomId)).filter((candidate) => candidate !== socket);
    room.disconnected ??= {};
    const voluntary = code === 1000 && reason === "left";
    if (!voluntary && attachment.resumeToken) room.disconnected[attachment.resumeToken] = { ...attachment, host: false, disconnectedAt: Date.now() };
    if (voluntary && attachment.resumeToken) delete room.disconnected[attachment.resumeToken];
    this.cleanDisconnected(room);
    if (players.length === 0 && Object.keys(room.disconnected).length === 0) {
      delete rooms[roomId];
    } else {
      if (players.length && room.hostId === attachment.playerId) {
        const nextHost = players[0].deserializeAttachment();
        if (nextHost) {
          nextHost.host = true;
          players[0].serializeAttachment(nextHost);
          room.hostId = nextHost.playerId;
        }
      }
      if (players.length === 0) room.hostId = null;
      rooms[roomId] = room;
    }
    await this.ctx.storage.put("rooms", rooms);
    if (rooms[roomId] && players.length) this.broadcast(roomId, { type: "presence", snapshot: this.snapshot(room, players) });
  }

  playerList(roomId, room) {
    const connected = this.ctx.getWebSockets(tagFor(roomId)).map((socket) => socket.deserializeAttachment()).filter(Boolean)
      .map((player) => this.publicPlayer(player));
    const disconnected = Object.values(room?.disconnected ?? {}).map((player) => this.publicPlayer(player, true));
    return [...connected, ...disconnected];
  }

  snapshot(room, sockets) {
    return {
      room: this.publicRoom(room),
      players: [...sockets.map((socket) => socket.deserializeAttachment()).filter(Boolean).map((player) => this.publicPlayer(player)),
        ...Object.values(room.disconnected ?? {}).map((player) => this.publicPlayer(player, true))]
    };
  }

  publicRoom(room) {
    return { id: room.id, maxPlayers: room.maxPlayers, locked: room.locked, status: room.status,
      ruleset: room.ruleset ?? "threejs-alpha", protocolVersion: room.protocolVersion ?? PROTOCOL_VERSION,
      roundSeconds: durationForRuleset(room.ruleset),
      startedAt: room.startedAt, mapId: room.mapId ?? "forest", difficulty: room.difficulty ?? "normal" };
  }

  publicPlayer(player, offline = false) {
    return { id: player.playerId, x: player.x, z: player.z, colorIndex: player.colorIndex, host: player.host, heroId: player.heroId, offline };
  }

  cleanDisconnected(room) {
    room.disconnected ??= {};
    for (const [token, player] of Object.entries(room.disconnected)) {
      if (Date.now() - (player.disconnectedAt ?? 0) > 30000) delete room.disconnected[token];
    }
  }

  canJoinPlaying(room) {
    if (room.status === "waiting") return true;
    if (room.status !== "playing" || !room.startedAt) return false;
    const elapsed = Date.now() - room.startedAt;
    return elapsed <= 6 * 60 * 1000 && !room.gameState?.boss;
  }

  broadcast(roomId, payload, except = null) {
    const data = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets(tagFor(roomId))) {
      if (socket === except) continue;
      try { socket.send(data); } catch { /* closed socket is removed by the runtime */ }
    }
  }
}

function tagFor(roomId) { return `room:${roomId}`; }
function sanitizeHeroId(heroId) { return ["liubei", "caocao", "sunquan", "lvbu"].includes(heroId) ? heroId : "liubei"; }
function sanitizeMapId(mapId) { return ["forest", "camp", "city"].includes(mapId) ? mapId : "forest"; }
function sanitizeDifficulty(difficulty) { return ["easy", "normal", "hard"].includes(difficulty) ? difficulty : "normal"; }
function sanitizePoint(value) {
  if (!value || typeof value !== "object") return null;
  return {
    x: clampNumber(value.x, -WORLD_LIMIT, WORLD_LIMIT),
    z: clampNumber(value.z, -WORLD_DEPTH_LIMIT, WORLD_DEPTH_LIMIT)
  };
}
function clampNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : 0;
}
function sanitizeGameState(state, roundSeconds = 720) {
  if (!state || !Array.isArray(state.enemies)) return null;
  const enemies = state.enemies.slice(0, 36).map((enemy, index) => ({
    id: String(enemy?.id ?? index).slice(0, 32),
    x: clampNumber(enemy?.x, -WORLD_LIMIT, WORLD_LIMIT),
    z: clampNumber(enemy?.z, -WORLD_DEPTH_LIMIT, WORLD_DEPTH_LIMIT),
    hp: Math.round(clampNumber(enemy?.hp, 0, 99)),
    elite: Boolean(enemy?.elite),
    kind: ["grunt", "runner", "archer", "elite", "boss"].includes(enemy?.kind) ? enemy.kind : (enemy?.elite ? "elite" : "grunt"),
    bossIndex: Math.round(clampNumber(enemy?.bossIndex ?? -1, -1, 2))
  })).filter((enemy) => enemy.hp > 0);
  const pickups = Array.isArray(state.pickups) ? state.pickups.slice(0, 20).map((pickup, index) => ({
    id: String(pickup?.id ?? index).slice(0, 32),
    x: clampNumber(pickup?.x, -WORLD_LIMIT, WORLD_LIMIT),
    z: clampNumber(pickup?.z, -WORLD_DEPTH_LIMIT, WORLD_DEPTH_LIMIT),
    type: pickup?.type === "heal" ? "heal" : "energy"
  })) : [];
  const playerProgress = {};
  if (state.playerProgress && typeof state.playerProgress === "object") {
    for (const [playerId, progress] of Object.entries(state.playerProgress).slice(0, MAX_PLAYERS)) {
      if (!/^[\w-]{8,64}$/.test(playerId) || !progress || typeof progress !== "object") continue;
      const upgrades = progress.upgrades ?? {};
      playerProgress[playerId] = {
        xp: Math.round(clampNumber(progress.xp, 0, 999)),
        level: Math.round(clampNumber(progress.level, 1, 99)),
        upgrades: {
          power: Math.round(clampNumber(upgrades.power, 0, 5)),
          tempo: Math.round(clampNumber(upgrades.tempo, 0, 5)),
          reach: Math.round(clampNumber(upgrades.reach, 0, 5)),
          speed: Math.round(clampNumber(upgrades.speed, 0, 5))
        },
        pendingChoices: Array.isArray(progress.pendingChoices) ? progress.pendingChoices.slice(0, 8).map((offer) =>
          Array.isArray(offer) ? offer.filter((id) => ["power", "tempo", "reach", "speed"].includes(id)).slice(0, 3) : []
        ) : []
      };
    }
  }
  const boss = state.boss && typeof state.boss === "object" ? {
    hp: Math.round(clampNumber(state.boss.hp, 0, 9999)),
    maxHp: Math.round(clampNumber(state.boss.maxHp, 0, 9999)),
    bossIndex: Math.round(clampNumber(state.boss.bossIndex, 0, 2))
  } : null;
  const playerVitals = {};
  if (state.playerVitals && typeof state.playerVitals === "object") {
    for (const [playerId, vital] of Object.entries(state.playerVitals).slice(0, MAX_PLAYERS)) {
      if (!/^[\w-]{8,64}$/.test(playerId) || !vital || typeof vital !== "object") continue;
      playerVitals[playerId] = {
        hp: Math.round(clampNumber(vital.hp, 0, 200)),
        maxHp: Math.round(clampNumber(vital.maxHp, 1, 200)),
        downed: Boolean(vital.downed),
        eliminated: Boolean(vital.eliminated),
        reviveProgress: clampNumber(vital.reviveProgress, 0, 3),
        downedAt: Math.round(clampNumber(vital.downedAt, 0, Date.now()))
      };
    }
  }
  return {
    enemies,
    pickups,
    playerProgress,
    boss,
    finalBossDefeated: Boolean(state.finalBossDefeated),
    bossesSpawned: Array.isArray(state.bossesSpawned) ? state.bossesSpawned.map((value) => Math.round(clampNumber(value, 0, 2))).slice(0, 3) : [],
    playerVitals,
    xp: Math.round(clampNumber(state.xp, 0, 9999)),
    level: Math.round(clampNumber(state.level, 1, 99)),
    energy: Math.round(clampNumber(state.energy, 0, 100)),
    elapsed: clampNumber(state.elapsed, 0, roundSeconds)
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
