import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HANDOFF_PREFIX, validRoomId, handoffKey, godotBattlePath, acceptedResult } from "../public/lobby-flow.mjs";

test("website directs original room and hero into the Godot battlefield", () => {
  assert.equal(HANDOFF_PREFIX, "samkokgo-handoff-");
  assert.equal(handoffKey("abcdef12"), "samkokgo-handoff-ABCDEF12");
  assert.equal(godotBattlePath("abcdef12", "sunquan"), "/godot/?room=ABCDEF12&hero=sunquan");
  assert.equal(godotBattlePath("ABCDEF12", "unknown"), "/godot/?room=ABCDEF12&hero=liubei");
  assert.ok(validRoomId("ABCDEF12"));
  assert.throws(() => godotBattlePath("invalid-room"));
});
test("settlement permits only supported results", () => {
  assert.equal(acceptedResult("victory"), "victory");
  assert.equal(acceptedResult("defeat"), "defeat");
  assert.equal(acceptedResult("exit"), "exit");
  assert.equal(acceptedResult("other"), null);
});
test("browser hands off the WebSocket identity rather than reconnecting as a new player", () => {
  const js = readFileSync(new URL("../public/main.js", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(js.includes('socket.close(4100, "handoff")'));
  assert.ok(js.includes("sessionStorage.setItem(handoffKey(roomId), token)"));
  assert.ok(js.includes('if (RULESET === "crossplay-v1") { transferToGodot(); return; }'));
  assert.ok(worker.includes('code === 4100 && reason === "handoff"'));
  assert.ok(worker.includes('resumed.handoff ? 120000 : 30000'));
  assert.ok(worker.includes('room.hostId === attachment.playerId && !handoff'));
});
test("Godot restores the identity, hero, and returns to HTML results", () => {
  const gd = readFileSync(new URL("../godot/scripts/main.gd", import.meta.url), "utf8");
  const net = readFileSync(new URL("../godot/scripts/cloudflare_room.gd", import.meta.url), "utf8");
  assert.ok(gd.includes("window.sessionStorage.getItem("));
  assert.ok(gd.includes("network.join_room(room_id, selected_hero_id, handoff_token)"));
  assert.ok(net.includes('transfer_token: String = ""'));
  for (const result of ["victory", "defeat", "exit"]) {
    assert.ok(gd.includes("window.location.replace('/?result=" + result + "')"));
  }
});
test("HTML has web settlement controls", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('id="resultHeading"'));
  assert.ok(html.includes('id="resultMessage"'));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as protocol from "../shared/protocol.mjs";
import * as crossplay from "../shared/crossplay.mjs";

const workerSource = readFileSync(new URL("../worker.js", import.meta.url), "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace("export default", "const workerDefault =")
  .replace("export class GameHub", "class GameHub");

test("two-stage navigation resumes the original player without duplicating a room slot", async () => {
  let sequence = 0;
  const randomUUID = () => String(++sequence).padStart(8, "0") + "-1234-1234-1234-123412341234";
  const clone = value => JSON.parse(JSON.stringify(value));
  const stored = new Map();
  const peers = new Map();
  const socketMessages = [];
  class MockResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status ?? 200;
      this.webSocket = init.webSocket;
    }
  }
  class MockSocket {
    constructor() { this.attachment = null; }
    deserializeAttachment() { return this.attachment && clone(this.attachment); }
    serializeAttachment(value) { this.attachment = clone(value); }
    send(data) { socketMessages.push(JSON.parse(data)); }
  }
  class MockWebSocketPair {
    constructor() { return [new MockSocket(), new MockSocket()]; }
  }
  const ctx = {
    storage: {
      get: async key => clone(stored.get(key) ?? null),
      put: async (key, value) => stored.set(key, clone(value)),
      setAlarm: async () => {}
    },
    getWebSockets: tag => peers.get(tag) ?? [],
    acceptWebSocket: (socket, tags) => {
      for (const tag of tags) peers.set(tag, [...(peers.get(tag) ?? []), socket]);
    }
  };
  const dependencyNames = [...Object.keys(protocol), ...Object.keys(crossplay)];
  const Hub = new Function("DurableObject", "Response", "WebSocketPair", "crypto",
    ...dependencyNames, workerSource + "\nreturn GameHub;")(
    class {}, MockResponse, MockWebSocketPair, { randomUUID },
    ...Object.values(protocol), ...Object.values(crossplay)
  );
  const hub = new Hub(ctx, {});
  const request = (path, method = "GET", upgrade = "") => ({
    url: "https://preview.example" + path,
    method,
    body: null,
    headers: { get: name => name.toLowerCase() === "upgrade" ? upgrade : null }
  });
  const roomResponse = await hub.fetch(request("/api/create?ruleset=crossplay-v1&protocol=1", "POST"));
  assert.equal(roomResponse.status, 200);
  const id = JSON.parse(roomResponse.body).roomId;
  const tag = "room:" + id;
  const wsRoute = "/ws?room=" + id + "&ruleset=crossplay-v1&protocol=1&hero=sunquan";
  const first = await hub.fetch(request(wsRoute, "GET", "websocket"));
  assert.equal(first.status, 101);
  const originalSocket = peers.get(tag)[0];
  const original = originalSocket.deserializeAttachment();
  assert.equal(original.host, true);
  const resumeToken = original.resumeToken;
  await hub.webSocketMessage(originalSocket, JSON.stringify({ type: "start" }));
  peers.set(tag, []);
  await hub.webSocketClose(originalSocket, 4100, "handoff");
  const disconnected = (await ctx.storage.get("rooms"))[id];
  assert.equal(disconnected.hostId, original.playerId);
  assert.equal(disconnected.disconnected[resumeToken].handoff, true);
  assert.equal(disconnected.disconnected[resumeToken].heroId, "sunquan");
  const second = await hub.fetch(request(wsRoute + "&resume=" + resumeToken, "GET", "websocket"));
  assert.equal(second.status, 101);
  assert.equal(peers.get(tag).length, 1);
  const resumed = peers.get(tag)[0].deserializeAttachment();
  assert.equal(resumed.playerId, original.playerId);
  assert.equal(resumed.heroId, "sunquan");
  assert.equal(resumed.host, true);
  assert.equal(resumed.handoff, false);
  assert.ok(socketMessages.some(message => message.type === "start"));
  assert.ok(socketMessages.some(message => message.type === "welcome" && message.selfId === original.playerId));
});
