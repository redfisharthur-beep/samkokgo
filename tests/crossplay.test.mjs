import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBattle, movePlayer, advanceBattle, chooseUpgrade, useAbility, COOP_SECONDS, syncPlayers } from "../shared/crossplay.mjs";
const party = [{ playerId: "p1", heroId: "liubei", x: 0, z: 0 },
  { playerId: "p2", heroId: "sunquan", x: 1, z: 1 }];
test("server initializes same authoritative health/XP for mixed renderers", () => {
  const battle = makeBattle(0);
  syncPlayers(battle, party);
  assert.equal(battle.schema, "crossplay-v1");
  assert.equal(battle.playerVitals.p1.hp, 100);
  assert.equal(battle.playerProgress.p2.level, 1);
});
test("movement rejects client teleport by using only direction and bounded elapsed", () => {
  const p = { ...party[0] };
  movePlayer(p, 9999, 0, 200);
  assert.ok(p.x <= 2.7);
  assert.equal(p.z, 0);
});
test("boss appears at 5 minutes, end result is server-controlled", () => {
  const s = makeBattle(0);
  s.elapsed = 299.5;
  advanceBattle(s, party, 1, 300000);
  assert.equal(s.bossSpawned, true);
  assert.equal(s.bossesSpawned[0], 0);
  s.elapsed = COOP_SECONDS - 0.5;
  advanceBattle(s, party, 1, 360000);
  assert.equal(s.result, "defeat");
});
test("XP upgrades must be offered before choice; abilities have cooldown", () => {
  const s = makeBattle(0);
  syncPlayers(s, party);
  assert.equal(chooseUpgrade(s, "p1", "power"), false);
  s.playerProgress.p1.pendingChoices.push(["power", "tempo", "reach"]);
  assert.equal(chooseUpgrade(s, "p1", "power"), true);
  assert.equal(s.playerProgress.p1.upgrades.power, 1);
  assert.equal(useAbility(s, "p1", party, 1000), true);
  assert.equal(useAbility(s, "p1", party, 2000), false);
});

test("Godot keyboard and joystick both supply direction to server movement", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../godot/scripts/main.gd", import.meta.url), "utf8");
  assert.match(src, /network_direction := keys\.normalized\(\) if keys\.length\(\) > 0\.1 else move_vector/);
  assert.match(src, /send_input\(network_direction\.x, network_direction\.y/);
  assert.match(src, /func _clear_mouse_movement\(\)/);
  assert.match(src, /func _clear_movement_input\(\)/);
  assert.match(src, /if what in \[NOTIFICATION_APPLICATION_FOCUS_OUT, NOTIFICATION_WM_WINDOW_FOCUS_OUT\]/);
});

test("boss spawn remains guaranteed even when enemy slots are full", () => {
  const s = makeBattle(0);
  s.enemies = Array.from({ length: 30 }, (_, i) => ({
    id: "e-" + i, x: 0, z: 0, hp: 20, kind: "grunt", bossIndex: -1
  }));
  s.elapsed = 299.9;
  advanceBattle(s, party, 1, 300000);
  assert.equal(s.bossSpawned, true);
  assert.ok(s.enemies.some(e => e.kind === "boss"));
  assert.equal(s.enemies.length, 30);
});

test("archers and enemy generals create server-owned dodgeable projectile patterns", () => {
  const s = makeBattle(0);
  syncPlayers(s, party);
  s.enemies = [
    { id: "e-archer", x: 8, z: 0, hp: 19, kind: "archer", attackClock: 0.01 },
    { id: "e-general", x: 12, z: 0, hp: 600, kind: "boss", attackClock: 0.01, bossIndex: 0 }
  ];
  s.bossSpawned = true;
  s.boss = { hp: 600, maxHp: 600, bossIndex: 0 };
  advanceBattle(s, party, 0.1, 100);
  assert.ok(s.projectiles.some(shot => shot.pattern === "arrow"));
  assert.equal(s.projectiles.filter(shot => shot.pattern === "boss-fan").length, 5);
  assert.ok(s.projectiles.every(shot => shot.delay > 0));
});

test("treasure pickups add team XP and energy, while equipment stats affect battle", () => {
  const s = makeBattle(0);
  const geared = [{ ...party[0], gearAttack: 4, gearDefense: 4, gearSpeed: 1 }, { ...party[1] }];
  syncPlayers(s, geared);
  assert.equal(s.playerVitals.p1.maxHp, 132);
  s.pickups = [{ id: "p-treasure", x: 0, z: 0, type: "treasure" }];
  advanceBattle(s, geared, 0.1, 100);
  assert.equal(s.pickups.length, 0);
  assert.equal(s.energy, 38);
  assert.equal(s.playerProgress.p1.xp, 4);
});
