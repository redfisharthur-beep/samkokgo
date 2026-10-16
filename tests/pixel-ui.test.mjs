import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = relative => readFileSync(new URL("../" + relative, import.meta.url), "utf8");
const html = read("public/index.html");
const js = read("public/main.js");
const css = read("public/pixel-ui.css");
const godot = read("godot/scripts/battle/battle_art_main.gd");

test("new RPG homepage ships actual pixel assets and portrait panels", () => {
  assert.match(html, /href="\/pixel-ui\.css"/);
  assert.match(html, /SamkokGo/);
  for (const hero of ["liubei","caocao","sunquan","lvbu"]) {
    assert.match(html, new RegExp('data-hero="' + hero + '"'));
    assert.match(html, new RegExp('data-portrait="' + hero + '"'));
    assert.ok(existsSync(new URL("../public/assets/pixel/actors/" + hero + ".svg", import.meta.url)));
  }
  assert.ok(existsSync(new URL("../public/assets/ui/kingdom-vista.svg", import.meta.url)));
});
test("game UX retains actionable controls and a functional hero picker", () => {
  const ids = ["heroPicker","heroChoices","pickHero","confirmHero","closeHeroPicker",
    "quickJoin","createRoom","refreshRooms","roomDrawer","roomStatus","roster","startGame",
    "mapSelect","difficultySelect","sizeSelect","leaveRoom","inviteButton",
    "resultHeading","resultMessage","playAgain","toHome"];
  for (const id of ids) {
    const matches = html.match(new RegExp('id="' + id + '"', "g")) ?? [];
    assert.equal(matches.length, 1, "Missing/duplicate control " + id);
  }
  assert.match(js, /function paintGeneral\(/);
  assert.match(js, /function initializeGeneralArt\(/);
  assert.match(js, /initializeGeneralArt\(\);/);
  assert.match(js, /showGeneralPicker\(true\)/);
  assert.match(js, /refreshGeneralPresentation\(heroId\)/);
});
test("UI is responsive and retains battle state networking", () => {
  assert.match(css, /@media\(max-height:580px\)/);
  assert.match(css, /@media\(orientation:portrait\)/);
  assert.match(js, /function transferToGodot\(/);
  assert.match(js, /socket\.close\(4100, "handoff"\)/);
  assert.match(godot, /func _draw_hud\(size: Vector2\)/);
  assert.match(godot, /ability_ready_at/);
  assert.match(godot, /boss_max_hp/);
});
