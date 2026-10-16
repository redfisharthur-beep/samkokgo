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
