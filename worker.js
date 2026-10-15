import { DurableObject } from "cloudflare:workers";

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
    return env.ASSETS.fetch(request);
  }
};

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
    if (url.pathname === "/api/rooms" && request.method === "GET") {
      return json({ rooms: await this.listRooms() });
    }
    if (url.pathname === "/api/create" && request.method === "POST") {
      const room = await this.createRoom();
      return json({ roomId: room.id });
    }
    if (url.pathname === "/api/quick-join" && request.method === "POST") {
      const room = await this.quickJoin();
      return json({ roomId: room.id });
    }
    if (url.pathname === "/ws") {
      return this.connect(request, url);
    }
    return json({ error: "Not found" }, 404);
  }

  async listRooms() {
    const rooms = (await this.ctx.storage.get("rooms")) ?? {};
    const visible = [];
    for (const room of Object.values(rooms)) {
      const players = this.ctx.getWebSockets(tagFor(room.id)).length;
      if (room.status === "waiting" && !room.locked && players < room.maxPlayers) {
        visible.push({ id: room.id, players, maxPlayers: room.maxPlayers });
      }
    }
    return visible.sort((a, b) => b.players - a.players).slice(0, 20);
  }

  async createRoom() {
    const rooms = (await this.ctx.storage.get("rooms")) ?? {};
    const id = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    const room = {
      id,
      maxPlayers: MAX_PLAYERS,
      locked: false,
      status: "waiting",
      hostId: null,
      startedAt: null,
      createdAt: Date.now()
    };
    rooms[id] = room;
    await this.ctx.storage.put("rooms", rooms);
    return room;
  }

  async quickJoin() {
    const rooms = (await this.ctx.storage.get("rooms")) ?? {};
    const room = Object.values(rooms)
      .filter((candidate) => candidate.status === "waiting" && !candidate.locked)
      .map((candidate) => ({ candidate, count: this.ctx.getWebSockets(tagFor(candidate.id)).length }))
      .filter(({ candidate, count }) => count < candidate.maxPlayers)
      .sort((a, b) => b.count - a.count)[0]?.candidate;
    return room ?? this.createRoom();
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
    const tag = tagFor(roomId);
    const existing = this.ctx.getWebSockets(tag);
    if (room.locked || room.status !== "waiting") return json({ error: "Room is closed" }, 409);
    if (existing.length >= room.maxPlayers) return json({ error: "Room is full" }, 409);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const playerId = crypto.randomUUID();
    const hostId = room.hostId ?? playerId;
    const spawnPoints = [[0, 0], [-3, 0], [3, 0], [0, -3], [-2, 3], [2, 3]];
    const [spawnX, spawnZ] = spawnPoints[existing.length] ?? [0, 0];
    const attachment = {
      roomId,
      playerId,
      host: playerId === hostId,
      x: spawnX,
      z: spawnZ,
      colorIndex: existing.length % 6,
      moveX: 0,
      moveZ: 0
    };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server, [tag]);
    room.hostId = hostId;
    rooms[roomId] = room;
    await this.ctx.storage.put("rooms", rooms);
    server.send(JSON.stringify({ type: "welcome", selfId: playerId, snapshot: this.snapshot(room, [...existing, server]) }));
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
      this.broadcast(room.id, { type: "players", players: this.playerList(room.id) });
      return;
    }
    if (message.type === "game-state" && attachment.playerId === room.hostId && room.status === "playing") {
      const state = sanitizeGameState(message.state);
      if (state) this.broadcast(room.id, { type: "game-state", state }, socket);
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
    if (message.type === "lock" && attachment.playerId === room.hostId && room.status === "waiting") {
      room.locked = !room.locked;
      rooms[room.id] = room;
      await this.ctx.storage.put("rooms", rooms);
      this.broadcast(room.id, { type: "room", room: this.publicRoom(room), players: this.playerList(room.id) });
      return;
    }
    if (message.type === "start" && attachment.playerId === room.hostId && room.status === "waiting") {
      room.status = "playing";
      room.startedAt = Date.now();
      rooms[room.id] = room;
      await this.ctx.storage.put("rooms", rooms);
      this.broadcast(room.id, { type: "start", startedAt: room.startedAt, duration: 8 * 60 });
    }
  }

  async webSocketClose(socket) {
    await this.removePlayer(socket);
  }

  async webSocketError(socket) {
    await this.removePlayer(socket);
  }

  async removePlayer(socket) {
    const attachment = socket.deserializeAttachment();
    const roomId = attachment?.roomId;
    if (!roomId) return;
    const rooms = (await this.ctx.storage.get("rooms")) ?? {};
    const room = rooms[roomId];
    if (!room) return;
    const players = this.ctx.getWebSockets(tagFor(roomId)).filter((candidate) => candidate !== socket);
    if (players.length === 0) {
      delete rooms[roomId];
    } else {
      if (room.hostId === attachment.playerId) {
        const nextHost = players[0].deserializeAttachment();
        if (nextHost) {
          nextHost.host = true;
          players[0].serializeAttachment(nextHost);
          room.hostId = nextHost.playerId;
        }
      }
      rooms[roomId] = room;
    }
    await this.ctx.storage.put("rooms", rooms);
    if (players.length) this.broadcast(roomId, { type: "presence", snapshot: this.snapshot(room, players) });
  }

  playerList(roomId) {
    return this.ctx.getWebSockets(tagFor(roomId)).map((socket) => socket.deserializeAttachment()).filter(Boolean)
      .map((player) => ({ id: player.playerId, x: player.x, z: player.z, colorIndex: player.colorIndex, host: player.host }));
  }

  snapshot(room, sockets) {
    return {
      room: this.publicRoom(room),
      players: sockets.map((socket) => socket.deserializeAttachment()).filter(Boolean)
        .map((player) => ({ id: player.playerId, x: player.x, z: player.z, colorIndex: player.colorIndex, host: player.host }))
    };
  }

  publicRoom(room) {
    return { id: room.id, maxPlayers: room.maxPlayers, locked: room.locked, status: room.status, startedAt: room.startedAt };
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
function clampNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : 0;
}
function sanitizeGameState(state) {
  if (!state || !Array.isArray(state.enemies)) return null;
  const enemies = state.enemies.slice(0, 36).map((enemy, index) => ({
    id: String(enemy?.id ?? index).slice(0, 32),
    x: clampNumber(enemy?.x, -WORLD_LIMIT, WORLD_LIMIT),
    z: clampNumber(enemy?.z, -WORLD_DEPTH_LIMIT, WORLD_DEPTH_LIMIT),
    hp: Math.round(clampNumber(enemy?.hp, 0, 99)),
    elite: Boolean(enemy?.elite)
  })).filter((enemy) => enemy.hp > 0);
  return {
    enemies,
    xp: Math.round(clampNumber(state.xp, 0, 9999)),
    level: Math.round(clampNumber(state.level, 1, 99)),
    teamHealth: Math.round(clampNumber(state.teamHealth, 0, 100)),
    energy: Math.round(clampNumber(state.energy, 0, 100))
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
