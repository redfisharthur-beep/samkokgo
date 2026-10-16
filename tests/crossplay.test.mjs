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
