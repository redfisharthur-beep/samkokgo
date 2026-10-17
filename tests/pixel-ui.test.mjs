import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = relative => readFileSync(new URL("../" + relative, import.meta.url), "utf8");
const html = read("public/index.html");
const js = read("public/main.js");
const css = read("public/pixel-ui.css");
const godot = read("godot/scripts/battle/battle_art_main.gd");
const project = read("godot/project.godot");

test("new RPG homepage ships actual pixel assets and portrait panels", () => {
  assert.match(html, /href="\/pixel-ui\.css\?v=home-ui-20261017b"/);
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
test("room setup shows the selected map, difficulty, and party size", () => {
  for (const id of ["mapValue", "difficultyValue", "sizeValue"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(js, /\$\("difficultyValue"\)\.textContent = difficultyName/);
  assert.match(js, /\$\("mapValue"\)\.textContent = mapName/);
  assert.match(css, /\.room-config \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});
test("all screens share the 1672 by 941 pixel-art frame", () => {
  assert.match(project, /window\/size\/viewport_width=1672/);
  assert.match(project, /window\/size\/viewport_height=941/);
  assert.match(css, /width: min\(100vw, 177\.7778vh\)/);
  assert.match(css, /height: min\(100vh, 56\.25vw\)/);
  assert.match(css, /\.hero-picker[\s\S]*lobby-pixel\.webp/);
  assert.match(css, /\.home-screen \.kingdom-vista[\s\S]*lobby-pixel\.webp/);
  assert.match(css, /\.room-screen \.kingdom-vista[\s\S]*lobby-pixel\.webp/);
  assert.ok(existsSync(new URL("../public/assets/ui/lobby-pixel.webp", import.meta.url)));
});
test("hero archive keeps portraits and controls available when WebGL is blocked", () => {
  assert.match(js, /catch \(error\) \{[\s\S]*WebGL unavailable/);
  assert.match(js, /renderer = \{ setSize\(\) \{\}, render\(\) \{\} \}/);
  for (const hero of ["liubei", "caocao", "sunquan", "lvbu"]) {
    assert.match(html, new RegExp(`class="hero-card-art" src="/assets/pixel/actors/${hero}-premium\\.png"`));
  }
  assert.match(html, /天下名將錄/);
  assert.match(html, /id="heroShowcase"/);
  assert.match(js, /WebGL2RenderingContext[\s\S]*graphicsNotice/);
  assert.match(html, /此瀏覽器無法啟動戰鬥畫面/);
  assert.match(js, /heroStat\$\{key\}/);
  assert.match(css, /\.hero-archive-layout \{[\s\S]*grid-template-columns: minmax\(430px/);
});
test("lost mouse or window focus always stops browser movement", () => {
  assert.match(js, /const clearMovementInput = \(event = null\) =>/);
  assert.match(js, /appState\.moveCurrent = \{ x: 0, z: 0 \}/);
  assert.match(js, /window\.addEventListener\("blur", \(\) => clearMovementInput\(\)\)/);
  assert.match(js, /document\.addEventListener\("visibilitychange"/);
});

test("fullscreen can be toggled from the lobby and Godot battle HUD", () => {
  assert.match(html, /id="fullscreen" aria-label="全螢幕"/);
  assert.match(html, /id="fullscreenGame" aria-label="進入全螢幕"/);
  assert.match(css, /\.home-screen \.home-controls \{[\\s\\S]*display:flex !important/);
  assert.match(js, /async function toggleFullscreen\(\)/);
  assert.match(js, /document\.exitFullscreen\(\)/);
  assert.match(js, /document\.addEventListener\("fullscreenchange", syncFullscreenButtons\)/);
  assert.match(godot, /切換全螢幕/);
  const main = read("godot/scripts/main.gd");
  assert.match(main, /func _toggle_web_fullscreen\(\)/);
  assert.match(main, /document\.documentElement\.requestFullscreen/);
});
