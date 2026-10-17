import { test } from "node:test";
import assert from "node:assert/strict";
import {
  freshProfile, loadProfile, saveProfile, summonHero, claimRun, equipGear,
  equippedBonuses, SUMMON_COST
} from "../public/progression.mjs";

function memoryStorage(initial = null) {
  const values = new Map(initial ? [["samkokgo-progression-v1", initial]] : []);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("new profile offers three starting generals and saves safely", () => {
  const storage = memoryStorage();
  const profile = loadProfile(storage);
  assert.deepEqual(profile.unlockedHeroes, ["liubei", "caocao", "sunquan"]);
  assert.equal(profile.seals, 0);
  profile.seals = 125;
  assert.equal(saveProfile(profile, storage), true);
  assert.equal(loadProfile(storage).seals, 125);
});

test("summon spends clear reward and unlocks a locked general", () => {
  const profile = freshProfile();
  profile.seals = SUMMON_COST;
  const draw = summonHero(profile, () => 0);
  assert.deepEqual(draw, { ok: true, heroId: "lvbu" });
  assert.equal(profile.seals, 0);
  assert.equal(summonHero(profile).reason, "not-enough-seals");
});

test("completed run awards seals, random gear and next map once", () => {
  const profile = freshProfile();
  const random = () => 0.99;
  const reward = claimRun(profile, { runId: "room-A", result: "victory", mapId: "forest", random });
  assert.equal(reward.seals, 100);
  assert.equal(profile.seals, 100);
  assert.deepEqual(profile.unlockedMaps, ["forest", "camp"]);
  assert.equal(profile.inventory.length, 1);
  assert.equal(claimRun(profile, { runId: "room-A", result: "victory", random }), null);
});

test("equipment modifies battle stats and defeat still drops gear", () => {
  const profile = freshProfile();
  const reward = claimRun(profile, { runId: "room-B", result: "defeat", random: () => 0.99 });
  assert.equal(reward.seals, 0);
  assert.equal(equipGear(profile, reward.gear.id), true);
  const bonuses = equippedBonuses(profile);
  assert.ok(bonuses.attack > 0 || bonuses.defense > 0);
  assert.equal(equipGear(profile, "missing"), false);
});

test("web menu gates the fourth general and carries equipment to Godot", async () => {
  const { readFileSync } = await import("node:fs");
  const js = readFileSync(new URL("../public/main.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const godot = readFileSync(new URL("../godot/scripts/main.gd", import.meta.url), "utf8");
  assert.match(js, /if \(!profile\.unlockedHeroes\.includes\(heroId\)\) return/);
  assert.match(js, /equippedBonuses\(profile\), appState\.room\?\.mapId/);
  for (const id of ["heroPanel", "recruitPanel", "gearPanel", "drawGeneral", "gearList"]) assert.ok(html.includes(`id="${id}"`));
  assert.ok(godot.includes("gear_attack_bonus"));
  assert.ok(godot.includes("gear_defense_bonus"));
  assert.ok(godot.includes("gear_speed_bonus"));
});
