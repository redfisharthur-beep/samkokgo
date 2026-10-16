Warning: truncated output (original token count: 26254)
Total output lines: 2091

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { godotBattlePath, handoffKey, acceptedResult } from "/lobby-flow.mjs";

const COLORS = [0x77877d, 0xb67b6d, 0x8097a0, 0xb49b6e, 0x8e8290, 0x68766b];
const HEROES = {
  liubei: { name: "劉備", color: COLORS[0], speed: 11, damage: 1, cadence: 780, range: 17, role: "support" },
  caocao: { name: "曹操", color: COLORS[5], speed: 10.4, damage: 2, cadence: 980, range: 20, role: "commander" },
  sunquan: { name: "孫權", color: COLORS[2], speed: 11.6, damage: 1, cadence: 610, range: 19, role: "ranged" },
  lvbu: { name: "呂布", color: COLORS[1], speed: 10, damage: 3, cadence: 1250, range: 12, role: "vanguard" }
};
const MAPS = {
  forest: { ground: 0xc4c8b6, path: 0xd1c7b2, sky: 0xc7d0c9, leaf: 0x839184 },
  camp: { ground: 0xc9c0aa, path: 0xb7a589, sky: 0xd2cabb, leaf: 0x9a846c },
  city: { ground: 0xbfc4b9, path: 0xd2cec1, sky: 0xc3cbc7, leaf: 0x79847e }
};
const MAP_ORDER = ["forest", "camp", "city"];
const DIFFICULTIES = ["easy", "normal", "hard"];
const PIXEL_SKIN_COLORS = new Set([0xd6b99d, 0xcdb59e, 0xd7bda3, 0xd2b196, 0xc5a58d, 0xc9aa91, 0xcdb39a, 0xc8aa91, 0xb8957f]);
const WORLD = { x: 48, z: 27 };
const ROUND_SECONDS = 12 * 60;
const PROTOCOL_VERSION = 1;
const RULESET = new URLSearchParams(location.search).get("classic") === "1" ? "threejs-alpha" : "crossplay-v1";
const protocolPath = (path) => `${path}${path.includes("?") ? "&" : "?"}ruleset=${RULESET}&protocol=${PROTOCOL_VERSION}`;
const $ = (id) => document.getElementById(id);
const ui = {
  home: $("home"), room: $("room"), hud: $("gameHud"), result: $("result"),
  roomDrawer: $("roomDrawer"), roster: $("roster"), partyStrip: $("partyStrip"),
  heroChoices: $("heroChoices"),
  mapSelect: $("mapSelect"), difficultySelect: $("difficultySelect"), sizeSelect: $("sizeSelect"),
  timer: $("timer"), xpFill: $("xpFill"), toast: $("toast"), stick: $("touchStick"),
  rotateHint: $("rotateHint"), resultSeal: $("resultSeal"), skillRow: $("skillRow"),
  healthFill: $("healthFill"), specialAbility: $("specialAbility"),
  levelChoice: $("levelChoice"), levelChoiceCards: $("levelChoiceCards"),
  bossHealth: $("bossHealth"), bossHealthFill: $("bossHealthFill"), reviveHint: $("reviveHint"),
  soundToggle: $("soundToggle"), soundToggleHud: $("soundToggleHud")
};
const UPGRADE_OPTIONS = {
  power: { label: "攻擊", max: 5 },
  tempo: { label: "攻速", max: 5 },
  reach: { label: "射程", max: 5 },
  speed: { label: "移速", max: 5 }
};

function drawPixelIcon(canvas, kind) {
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const C = { bg: "#e7dfca", shade: "#c5b99e", dark: "#454a43", ink: "#5a5549", gold: "#c2a56f", light: "#f3ead3", steel: "#82918b", clay: "#b77b6d", moss: "#718779", blue: "#8097a0" };
  const p = (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(x * 8, y * 8, 8, 8); };
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x * 8, y * 8, w * 8, h * 8); };
  rect(0, 0, 16, 16, C.bg);
  rect(0, 0, 16, 1, C.shade); rect(0, 15, 16, 1, C.shade); rect(0, 0, 1, 16, C.shade); rect(15, 0, 1, 16, C.shade);
  for (let i = 2; i < 14; i += 4) { p(i, 2, C.light); p(13, i, C.shade); }
  if (kind === "power") {
    [[9,2],[8,3],[7,4],[6,5],[5,6],[4,7],[3,8]].forEach(([x,y]) => p(x,y,C.light));
    [[10,2],[9,3],[8,4],[7,5],[6,6],[5,7],[4,8]].forEach(([x,y]) => p(x,y,C.gold));
    [[11,2],[10,3],[9,4],[8,5],[7,6],[6,7],[5,8]].forEach(([x,y]) => p(x,y,C.steel));
    rect(3, 9, 6, 1, C.dark); rect(5, 10, 2, 3, C.ink); rect(4, 13, 4, 1, C.dark); rect(5, 13, 2, 1, C.gold);
  } else if (kind === "tempo") {
    rect(4, 2, 8, 1, C.dark); rect(3, 3, 1, 2, C.dark); rect(12, 3, 1, 2, C.dark);
    rect(2, 5, 1, 6, C.dark); rect(13, 5, 1, 6, C.dark); rect(3, 11, 1, 2, C.dark); rect(12, 11, 1, 2, C.dark); rect(4, 13, 8, 1, C.dark);
    rect(4, 4, 8, 8, C.light); rect(7, 5, 2, 4, C.clay); rect(8, 8, 4, 2, C.clay); p(11,8,C.gold);
    rect(5, 2, 6, 1, C.gold); rect(3, 6, 1, 4, C.blue); rect(12, 6, 1, 4, C.blue);
  } else if (kind === "reach") {
    rect(3, 3, 10, 1, C.dark); rect(3, 12, 10, 1, C.dark); rect(3, 4, 1, 8, C.dark); rect(12, 4, 1, 8, C.dark);
    rect(5, 5, 6, 1, C.clay); rect(5, 10, 6, 1, C.clay); rect(5, 6, 1, 4, C.clay); rect(10, 6, 1, 4, C.clay);
    rect(7, 7, 2, 2, C.gold); p(7,4,C.light); p(7,11,C.light); p(4,7,C.light); p(11,7,C.light);
    rect(1, 7, 3, 1, C.steel); rect(12, 7, 3, 1, C.steel); rect(7, 1, 1, 3, C.steel); rect(7, 12, 1, 3, C.steel);
  } else if (kind === "special") {
    rect(7, 1, 2, 2, C.light); rect(6, 3, 4, 2, C.gold); rect(4, 5, 8, 2, C.clay);
    rect(2, 7, 12, 2, C.gold); rect(4, 9, 8, 2, C.clay); rect(6, 11, 4, 2, C.gold); rect(7, 13, 2, 1, C.light);
    p(4,3,C.blue); p(11,3,C.blue); p(3,11,C.moss); p(12,11,C.moss); p(2,4,C.light); p(13,4,C.light);
  } else {
    rect(3, 4, 4, 2, C.dark); rect(2, 6, 6, 2, C.dark); rect(3, 8, 8, 2, C.dark); rect(5, 10, 7, 2, C.dark); rect(8, 12, 5, 1, C.dark);
    rect(4, 5, 2, 1, C.moss); rect(3, 7, 4, 1, C.moss); rect(5, 9, 5, 1, C.gold); rect(8, 11, 3, 1, C.clay);
    rect(1, 5, 2, 1, C.blue); rect(1, 8, 2, 1, C.blue); rect(2, 11, 2, 1, C.blue); rect(11, 3, 2, 1, C.light);
  }
}

function pixelIcon(kind, className = "pixel-icon") {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  canvas.setAttribute("aria-hidden", "true");
  drawPixelIcon(canvas, kind);
  return canvas;
}

let skillIconSignature = null;
function renderSkillIcons() {
  const upgrades = appState.playerProgress[appState.selfId]?.upgrades ?? {};
  const signature = Object.keys(UPGRADE_OPTIONS).map((kind) => upgrades[kind] ?? 0).join(":");
  if (signature === skillIconSignature) return;
  skillIconSignature = signature;
  ui.skillRow.replaceChildren();
  for (const [kind, upgrade] of Object.entries(UPGRADE_OPTIONS)) {
    const rank = upgrades[kind] ?? 0;
    const token = document.createElement("span");
    token.className = `skill-token${rank ? " unlocked" : ""}`;
    token.title = `${upgrade.label}${rank ? ` ${rank}/${upgrade.max}` : ""}`;
    token.setAttribute("aria-label", token.title);
    token.append(pixelIcon(kind, "pixel-icon"));
    const level = document.createElement("b");
    level.textContent = rank ? String(rank) : "";
    token.append(level);
    ui.skillRow.append(token);
  }
}

const appState = {
  screen: "home", roomId: null, room: null, selfId: null, host: false,
  heroId: localStorage.getItem("samkokgo-hero") ?? "liubei",
  mapId: "forest", difficulty: "normal",
  players: new Map(), socket: null, cameraMode: 0, startedAt: null,
  secondsLeft: ROUND_SECONDS, xp: 0, level: 1, muted: false, lastInput: 0,
  pointer: null, move: { x: 0, z: 0 }, moveCurrent: { x: 0, z: 0 }, enemies: [], pickups: [], projectiles: [],
  nextSpawn: 0, nextAttack: 0, lastGameSync: 0, enemySequence: 0,
  nextPlayerAttacks: new Map(), energy: 0, abilityPending: false,
  nextTeamHit: 0, bursts: [], toastTimer: 0, pickupSequence: 0,
  playerProgress: {}, playerVitals: {}, bossesSpawned: new Set(), finalBossDefeated: false,
  reconnectAttempts: 0, reconnectTimer: 0, transferringToGodot: false
};
let audioContext = null;
let musicStep = 0;
let audioEnabled = localStorage.getItem("samkokgo-sound") === "on";

const renderer = new THREE.WebGLRenderer({ canvas: $("world"), antialias: true, alpha: false, powerPreference: "low-power" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc7d0c9);
scene.fog = new THREE.Fog(0xc7d0c9, 75, 190);
const camera = new THREE.OrthographicCamera(-18, 18, 10, -10, 0.1, 220);
const clock = new THREE.Clock();
const world = new THREE.Group();
scene.add(world);
let mapDecor = new THREE.Group();

const hemi = new THREE.HemisphereLight(0xf2eee4, 0x77786c, 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4df, 2.0);
sun.position.set(-36, 60, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD.x * 2, WORLD.z * 2),
  new THREE.MeshStandardMaterial({ color: 0xc4c8b6, roughness: 1 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
world.add(floor);
const blockGeometryCache = new Map();
const blockMaterialCache = new Map();
const pixelTextureCache = new Map();
function pixelTexture(kind = "cloth", variant = 0, style = "world") {
  const cacheKey = `${kind}:${style}`;
  if (pixelTextureCache.has(cacheKey)) return pixelTextureCache.get(cacheKey);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const seedByKind = { cloth: 17, armor: 31, stone: 47, wood: 59, grass: 71, skin: 83 };
  const styleSeed = [...style].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 0);
  let seed = ((seedByKind[kind] ?? 101) + styleSeed + Number(variant)) >>> 0;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = "#f4f1e8";
  ctx.fillRect(0, 0, 128, 128);
  const shades = { cloth: [220, 248], armor: [203, 252], stone: [214, 248], wood: [213, 248], grass: [217, 249], skin: [229, 253] }[kind] ?? [218, 249];
  const pixel = 2;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const value = Math.round(shades[0] + random() * (shades[1] - shades[0]));
    ctx.fillStyle = `rgb(${value},${value},${value})`;
    ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
    if (kind === "armor" && y % 8 === 0 && x % 8 !== 0) {
      ctx.fillStyle = `rgb(${Math.min(255, value + 10)},${Math.min(255, value + 10)},${Math.min(255, value + 10)})`;
      ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
      if (x % 8 === 2) { ctx.fillStyle = "rgb(184,159,108)"; ctx.fillRect(x * pixel, y * pixel, pixel, pixel); }
    }
    if (kind === "cloth" && y % 8 === 3 && x % 4 === 1) {
      ctx.fillStyle = `rgb(${Math.max(0, value - 17)},${Math.max(0, value - 17)},${Math.max(0, value - 17)})`;
      ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
      if ((style === "liubei" || style === "caocao" || style === "sunquan" || style === "lvbu") && x % 16 === 5) {
        ctx.fillStyle = "rgb(248,230,183)";
        ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
      }
    }
    if ((kind === "stone" || kind === "grass") && random() > .91) {
      const shade = Math.max(0, value - 18);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
    }
    if (kind === "skin" && ((x + styleSeed) % 19 === 0) && y % 16 > 3 && y % 16 < 9) {
      ctx.fillStyle = "rgb(255,250,235)";
      ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
    }
    if (kind === "wood" && x % 11 === (styleSeed % 5) && y % 8 > 1) {
      ctx.fillStyle = `rgb(${Math.max(0, value - 16)},${Math.max(0, value - 16)},${Math.max(0, value - 16)})`;
      ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
    }
  }
  if (kind === "cloth" && ["liubei", "caocao", "sunquan", "lvbu", "grunt", "runner", "archer", "elite", "boss"].includes(style)) {
    const motif = style === "liubei" ? 0 : style === "caocao" ? 1 : style === "sunquan" ? 2 : style === "lvbu" ? 3 : style === "archer" ? 4 : style === "boss" ? 5 : style === "elite" ? 6 : style === "runner" ? 7 : 8;
    const cx = 8 + (motif % 4) * 12;
    for (let band = 0; band < 4; band++) {
      const y = 6 + band * 16;
      ctx.fillStyle = motif % 2 ? "rgb(237,216,171)" : "rgb(235,231,210)";
      ctx.fillRect((cx + band % 2 * 4) * pixel, y * pixel, 2 * pixel, 2 * pixel);
      ctx.fillRect((cx + 2 + band % 2 * 4) * pixel, (y + 2) * pixel, 2 * pixel, 2 * pixel);
      ctx.fillStyle = "rgb(198,169,116)";
      ctx.fillRect((cx + 4 + band % 2 * 4) * pixel, (y + 4) * pixel, 2 * pixel, 2 * pixel);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  pixelTextureCache.set(cacheKey, texture);
  return texture;
}
function blockGeometry(width, height, depth) {
  const key = `${width}|${height}|${depth}`;
  if (!blockGeometryCache.has(key)) blockGeometryCache.set(key, new THREE.BoxGeometry(width, height, depth));
  return blockGeometryCache.get(key);
}
function addBlock(parent, size, color, position, materialOptions = {}) {
  const options = { color, roughness: .82, metalness: .02, ...materialOptions };
  const textureKind = options.metalness > .1 ? "armor" : PIXEL_SKIN_COLORS.has(color) ? "skin" : color === 0x9b8063 || color === 0x8b745c || color === 0x746954 ? "wood" : options.roughness >= .95 ? "stone" : "cloth";
  let owner = parent;
  while (owner && !owner.userData?.pixelStyle) owner = owner.parent;
  const pixelStyle = owner?.userData?.pixelStyle ?? "world";
  options.map = pixelTexture(textureKind, color, pixelStyle);
  const key = `${textureKind}|${pixelStyle}|${Object.entries(options).filter(([name]) => name !== "map").sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${name}:${value}`).join("|")}`;
  if (!blockMaterialCache.has(key)) blockMaterialCache.set(key, new THREE.MeshStandardMaterial(options));
  const material = blockMaterialCache.get(key);
  const mesh = new THREE.Mesh(blockGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
buildMapDecor();

let localPlayer = makeWarrior(HEROES[appState.heroId]?.color ?? COLORS[0], true, appState.heroId);
localPlayer.group.position.set(0, 0, 0);
world.add(localPlayer.group);
const playerVisuals = new Map();
const enemyGroup = new THREE.Group();
world.add(enemyGroup);
const pickupGroup = new THREE.Group();
world.add(pickupGroup);
const projectileGroup = new THREE.Group();
world.add(projectileGroup);

function buildMapDecor() {
  if (mapDecor.parent) mapDecor.parent.remove(mapDecor);
  mapDecor.traverse((object) => {
    if (object.geometry && ![...blockGeometryCache.values()].includes(object.geometry)) object.geometry.dispose();
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.map && ![...pixelTextureCache.values()].includes(material.map)) material.map.dispose();
      if (![...blockMaterialCache.values()].includes(material)) material.dispose();
    }
  });
  mapDecor = new THREE.Group();
  const palette = MAPS[appState.mapId] ?? MAPS.forest;
  floor.material.color.setHex(palette.ground);
  floor.material.map = pixelTexture("grass", palette.ground);
  floor.material.map.repeat.set(WORLD.x / 3, WORLD.z / 3);
  floor.material.map.needsUpdate = true;
  scene.background.setHex(palette.sky);
  scene.fog.color.setHex(palette.sky);
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(26, WORLD.z * 2),
    new THREE.MeshStandardMaterial({ color: palette.path, roughness: 1, map: pixelTexture("stone", palette.path) })
  );
  path.material.map.repeat.set(26 / 3, WORLD.z / 3);
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.015;
  path.receiveShadow = true;
  mapDecor.add(path);
  const crossPath = path.clone();
  crossPath.geometry = new THREE.PlaneGeometry(WORLD.x * 2, 16);
  crossPath.material = path.material.clone();
  crossPath.material.map = path.material.map.clone();
  crossPath.material.map.repeat.set(WORLD.x / 3, 16 / 3);
  crossPath.rotation.x = -Math.PI / 2;
  mapDecor.add(crossPath);

  // Muted hills and trees mark the edges without making the playable field feel boxed in.
  const rng = seeded(47);
  for (let i = 0; i < (appState.mapId === "forest" ? 42 : appState.mapId === "camp" ? 24 : 18); i++) {
    const edge = Math.floor(rng() * 4);
    const x = edge < 2 ? (rng() * 2 - 1) * WORLD.x : (edge === 2 ? -1 : 1) * (WORLD.x - 2);
    const z = edge >= 2 ? (rng() * 2 - 1) * WORLD.z : (edge === 0 ? -1 : 1) * (WORLD.z - 2);
    const tree = makeTree(rng() > 0.55 ? palette.leaf : 0x9a9d87, appState.mapId === "camp" ? 0x746954 : 0x8b745c);
    tree.position.set(x, 0, z);
    tree.scale.setScalar(.75 + rng() * .7);
    mapDecor.add(tree);
  }
  for (const [x, z] of [[-17, -10], [17, -10], [-17, 10], [17, 10]]) {
    addBlock(mapDecor, [3.4, .32, 3.4], 0xa9a28b, [x, .16, z]);
    addBlock(mapDecor, [2.75, .25, 2.75], 0xc4b995, [x, .42, z]);
    addBlock(mapDecor, [.48, .6, .48], 0x8f8a76, [x - .85, .78, z - .85]);
    addBlock(mapDecor, [.48, .6, .48], 0x8f8a76, [x + .85, .78, z + .85]);
  }
  if (appState.mapId === "camp") {
    for (const [x, z] of [[-12,-8],[12,-8],[-12,8],[12,8]]) {
      addBlock(mapDecor, [4.2, 1.55, 3.2], 0x9f8064, [x, .82, z]);
      const roof = addBlock(mapDecor, [4.7, .34, 3.7], 0xb49b7b, [x, 1.76, z]);
      roof.rotation.z = -.28;
      addBlock(mapDecor, [.18, 2.4, .18], 0x796d58, [x - 1.8, 1.15, z - 1.25]);
      addBlock(mapDecor, [.18, 2.4, .18], 0x796d58, [x + 1.8, 1.15, z - 1.25]);
      addBlock(mapDecor, [.75, 1.45, .12], 0x6f6657, [x, .74, z + 1.63]);
    }
  }
  if (appState.mapId === "city") {
    for (const [x,z,rotation] of [[-33,-15,0],[-33,15,0],[33,-15,0],[33,15,0],[-15,-20,Math.PI/2],[15,20,Math.PI/2]]) {
      const length = rotation ? 25 : 17;
      const wall = addBlock(mapDecor, [rotation ? length : 2.2, 3.6, rotation ? 2.2 : length], 0x9b9a89, [x, 1.8, z]);
      wall.rotation.y = rotation;
      const cap = addBlock(mapDecor, [rotation ? length : 2.7, .3, rotation ? 2.7 : length], 0xb9b49f, [x, 3.75, z]);
      cap.rotation.y = rotation;
      for (let i = 0; i < 5; i++) {
        const offset = -length / 2 + 1.5 + i * (length - 3) / 4;
        const merlon = addBlock(mapDecor, [.85, .75, .85], 0x898b80, [x + (rotation ? offset : 0), 4.1, z + (rotation ? 0 : offset)]);
        merlon.rotation.y = rotation;
      }
    }
  }
  world.add(mapDecor);
}

function updateMapVisual(mapId) {
  if (!MAPS[mapId]) return;
  appState.mapId = mapId;
  buildMapDecor();
}

function makeTree(leafColor, trunkColor) {
  const group = new THREE.Group();
  addBlock(group, [.5, 1.55, .5], trunkColor, [0, .78, 0]);
  addBlock(group, [.22, .85, .22], 0x9b8063, [-.25, 1.16, 0]);
  const layers = [
    { w: 2.25, h: .92, d: 1.9, y: 2.05, color: leafColor },
    { w: 1.8, h: .88, d: 1.55, y: 2.78, color: leafColor },
    { w: 1.2, h: .82, d: 1.08, y: 3.45, color: 0x9ba58f }
  ];
  for (const layer of layers) {
    addBlock(group, [layer.w, layer.h, layer.d], layer.color, [0, layer.y, 0]);
    addBlock(group, [layer.w * .28, .16, layer.d * .25], 0xb2b29a, [-layer.w * .25, layer.y + .08, layer.d * .18]);
  }
  addBlock(group, [2.5, .22, 2.2], 0xaeb49e, [0, .11, 0]);
  return group;
}

function addProgressionEquipment(group, heroId) {
  const color = ({ liubei: 0xb9aa78, caocao: 0xa69b7d, sunquan: 0x91a9a8, lvbu: 0xb77b6d }[heroId] ?? 0xb9aa78);
  const firstUpgrade = new THREE.Group();
  addBlock(firstUpgrade, [.53, .24, .56], color, [-.67, 1.72, 0], { metalness: .18, roughness: .5 });
  addBlock(firstUpgrade, [.53, .24, .56], color, [.67, 1.72, 0], { metalness: .18, roughness: .5 });
  addBlock(firstUpgrade, [.62, .2, .13], color, [0, 1.46, .42], { metalness: .16, roughness: .5 });
  addBlock(firstUpgrade, [.13, .13, .15], 0xf0dfaa, [0, 1.46, .51], { metalness: .2, roughness: .4 });
  firstUpgrade.visible = false;
  group.add(firstUpgrade);
  const secondUpgrade = new THREE.Group();
  addBlock(secondUpgrade, [.78, .98, .12], 0x555f54, [0, 1.17, -.42]);
  addBlock(secondUpgrade, [.9, .17, .13], color, [0, .72, -.43], { metalness: .16, roughness: .5 });
  addBlock(secondUpgrade, [.1, .62, .11], color, [-.28, 1.34, -.5], { metalness: .2, roughness: .45 });
  addBlock(secondUpgrade, [.1, .62, .11], color, [.28, 1.34, -.5], { metalness: .2, roughness: .45 });
  secondUpgrade.visible = false;
  group.add(secondUpgrade);
  const thirdUpgrade = new THREE.Group();
  for (const side of [-1, 1]) {
    const wing = addBlock(thirdUpgrade, [.22, 1.12, .15], color, [side * .7, 1.84, -.12], { metalness: .18, roughness: .5 });
    wing.rotation.z = side * -.35;
    addBlock(thirdUpgrade, [.32, .16, .16], 0xe4d7bb, [side * .79, 2.24, -.1], { metalness: .12 });
  }
  addBlock(thirdUpgrade, [.24, .46, .2], 0xc3a56f, [0, 2.12, -.5], { metalness: .2, roughness: .42 });
  thirdUpgrade.visible = false;
  group.add(thirdUpgrade);
  const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false });
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(.78, .88, 36), ringMaterial.clone());
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = .07;
  floorRing.visible = false;
  group.add(floorRing);
  const waistRing = new THREE.Mesh(new THREE.TorusGeometry(.72, .035, 7, 32), ringMaterial.clone());
  waistRing.rotation.x = Math.PI / 2;
  waistRing.position.y = 1.55;
  waistRing.visible = false;
  group.add(waistRing);
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(.54, .028, 6, 28), ringMaterial.clone());
  crownRing.rotation.x = Math.PI / 2;
  crownRing.position.y = 3.05;
  crownRing.visible = false;
  group.add(crownRing);
  const jewels = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(.105, 0), new THREE.MeshBasicMaterial({ color: i === 1 ? 0x9cae8d : color, transparent: true, opacity: .9 }));
    jewels.add(jewel);
  }
  jewels.visible = false;
  group.add(jewels);
  return { floorRing, waistRing, crownRing, jewels, firstUpgrade, secondUpgrade, thirdUpgrade };
}

function updateProgressionEquipment(visual, progress, now, delta) {
  if (!visual?.progression) return;
  const level = Math.max(1, progress?.level ?? 1);
  const tier = level >= 10 ? 3 : level >= 6 ? 2 : level >= 3 ? 1 : 0;
  const targetGrowth = 1 + Math.min(.24, (level - 1) * .018);
  visual.currentGrowth ??= 1;
  visual.currentGrowth += (targetGrowth - visual.currentGrowth) * (1 - Math.exp(-Math.min(delta, .05) * 4.5));
  visual.group.scale.setScalar((visual.baseScale ?? 1) * visual.currentGrowth);
  const gear = visual.progression;
  gear.floorRing.visible = tier >= 1;
  gear.waistRing.visible = tier >= 2;
  gear.crownRing.visible = tier >= 3;
  gear.jewels.visible = tier >= 2;
  gear.firstUpgrade.visible = tier >= 1;
  gear.secondUpgrade.visible = tier >= 2;
  gear.thirdUpgrade.visible = tier >= 3;
  gear.floorRing.scale.setScalar(1 + tier * .1);
  gear.waistRing.rotation.y = now * .00055;
  gear.crownRing.rotation.y = -now * .00072;
  gear.jewels.rotation.y = now * .001;
  gear.jewels.children.forEach((jewel, index) => {
    const angle = now * .0012 + index * Math.PI * 2 / 3;
    jewel.position.set(Math.cos(angle) * .88, 1.75 + Math.sin(angle * 1.4) * .12, Math.sin(angle) * .4);
  });
}

function makeWarrior(color, hero = false, heroId = "liubei", enemyKind = "grunt") {
  const group = new THREE.Group();
  enemyKind = hero ? null : enemyKind;
  group.userData.pixelStyle = hero ? heroId : enemyKind;
  const schemes = {
    liubei: { cloth: 0x718779, armor: 0x685f4e, trim: 0xc0a66e, dark: 0x3d4943, skin: 0xd6b99d, accent: 0x9dac8d },
    caocao: { cloth: 0x4d5554, armor: 0x7b7161, trim: 0xc0a66e, dark: 0x343b3a, skin: 0xcdb59e, accent: 0x876f68 },
    sunquan: { cloth: 0x708b8d, armor: 0x6c7060, trim: 0xc5aa72, dark: 0x3f5558, skin: 0xd7bda3, accent: 0x9ba887 },
    lvbu: { cloth: 0x8a5f59, armor: 0x484a49, trim: 0xc3a56e, dark: 0x343637, skin: 0xd2b196, accent: 0x69514d },
    grunt: { cloth: 0x86635e, armor: 0x5d5550, trim: 0xa68b66, dark: 0x403f3d, skin: 0xc5a58d, accent: 0xa5786d },
    runner: { cloth: 0x9a8464, armor: 0x626158, trim: 0xbba16f, dark: 0x45443d, skin: 0xc9aa91, accent: 0xb08e68 },
    archer: { cloth: 0x657b80, armor: 0x545e5c, trim: 0xb09a6d, dark: 0x394447, skin: 0xcdb39a, accent: 0x87989a },
    elite: { cloth: 0x77756a, armor: 0x464a47, trim: 0xc1a56f, dark: 0x343a37, skin: 0xc8aa91, accent: 0x9a746a },
    boss: { cloth: 0x66585d, armor: 0x383e3e, trim: 0xc1a56f, dark: 0x292f30, skin: 0xb8957f, accent: 0xb47e72 }
  };
  const palette = schemes[hero ? heroId : enemyKind] ?? schemes.grunt;
  const rig = new THREE.Group();
  group.add(rig);
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 1.38;
  rig.add(bodyPivot);
  const body = addBlock(bodyPivot, [1.02, .9, .62], palette.cloth, [0, 0, 0]);
  addBlock(bodyPivot, [.9, .12, .66], palette.trim, [0, -.36, .015]);
  addBlock(bodyPivot, [.36, .2, .69], palette.accent, [0, -.36, .02]);
  addBlock(bodyPivot, [.82, .46, .16], palette.armor, [0, .12, .39], { metalness: .12, roughness: .58 });
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      addBlock(bodyPivot, [.23, .105, .045], row === 1 && col === 1 ? palette.accent : palette.trim,
        [-.25 + col * .25, .28 - row * .135, .49], { metalness: .18, roughness: .5 });
    }
  }
  for (const side of [-1, 1]) {
    const skirt = addBlock(bodyPivot, [.44, .66, .14], palette.cloth, [side * .31, -.64, .25]);
    skirt.rotation.x = -.08;
    addBlock(bodyPivot, [.46, .13, .17], palette.accent, [side * .31, -.43, .31]);
    const shoulder = addBlock(bodyPivot, [.42, .28, .48], palette.armor, [side * .63, .36, .015], { metalness: .1 });
    shoulder.rotation.z = side * -.08;
  }
  if (enemyKind === "boss") {
    addBlock(bodyPivot, [1.18, .28, .62], 0x383e3e, [0, .48, -.02], { metalness: .14, roughness: .55 });
    addBlock(bodyPivot, [.3, .42, .16], 0xb47e72, [0, .08, .51], { metalness: .12 });
    for (const side of [-1, 1]) {
      const spike = addBlock(bodyPivot, [.18, .52, .2], 0xc1a56f, [side * .82, .55, -.04], { metalness: .22, roughness: .42 });
      spike.rotation.z = side * -.42;
    }
    addBlock(bodyPivot, [.76, .14, .13], 0x332f34, [0, -.82, -.08]);
  } else if (enemyKind === "elite") {
    addBlock(bodyPivot, [.34, .46, .18], palette.trim, [0, .03, .52], { metalness: .18, roughness: .48 });
    addBlock(bodyPivot, [.2, .15, .12], palette.accent, [0, -.06, .63]);
  } else if (enemyKind === "runner") {
    for (const side of [-1, 1]) {
      addBlock(bodyPivot, [.42, .17, .48], palette.accent, [side * .3, -.88, .03]);
      addBlock(bodyPivot, [.14, .3, .14], palette.trim, [side * .43, -.25, .23], { metalness: .12 });
    }
  }
  const headGroup = new THREE.Group();
  headGroup.position.set(0, .78, .015);
  bodyPivot.add(headGroup);
  addBlock(headGroup, [.62, .62, .54], palette.skin, [0, 0, .035]);
  addBlock(headGroup, [.7, .16, .6], palette.dark, [0, .28, -.015]);
  addBlock(headGroup, [.7, .1, .55], palette.trim, [0, .22, .03]);
  addBlock(headGroup, [.16, .11, .025], 0xf0e6d6, [-.15, -.015, .314]);
  addBlock(headGroup, [.16, .11, .025], 0xf0e6d6, [.15, -.015, .314]);
  addBlock(headGroup, [.055, .09, .035], palette.dark, [-.15, -.015, .335]);
  addBlock(headGroup, [.055, .09, .035], palette.dark, [.15, -.015, .335]);
  addBlock(headGroup, [.08, .04, .04], palette.dark, [0, -.12, .33]);
  if (heroId === "liubei" && hero) {
    addBlock(headGroup, [.12, .2, .1], palette.dark, [0, -.3, .2]);
    addBlock(headGroup, [.42, .1, .16], palette.dark, [0, -.26, .3]);
    addBlock(headGroup, [.28, .1, .08], palette.accent, [0, .4, -.02]);
    addBlock(headGroup, [.17, .17, .12], 0x96a978, [0, .38, .04], { metalness: .16, roughness: .35 });
    addBlock(headGroup, [.08, .23, .08], palette.trim, [0, .42, -.02]);
  } else if (heroId === "lvbu" && hero) {
    addBlock(headGroup, [.14, .55, .16], palette.trim, [-.27, .46, -.02]);
    addBlock(headGroup, [.14, .55, .16], palette.trim, [.27, .46, -.02]);
    addBlock(headGroup, [.78, .12, .65], palette.armor, [0, .29, 0]);
  } else if (heroId === "caocao" && hero) {
    addBlock(headGroup, [.78, .2, .68], palette.dark, [0, .34, -.01]);
    addBlock(headGroup, [.5, .27, .18], palette.trim, [0, .48, -.12]);
  } else if (heroId === "sunquan" && hero) {
    addBlock(headGroup, [.8, .14, .66], palette.trim, [0, .3, -.01]);
    addBlock(headGroup, [.16, .28, .16], palette.accent, [0, .45, -.14]);
  } else {
    addBlock(headGroup, [.78, .17, .68], palette.armor, [0, .3, -.01]);
    if (enemyKind === "boss" || enemyKind === "elite") {
      addBlock(headGroup, [.12, .42, .14], palette.trim, [-.3, .48, -.05]);
      addBlock(headGroup, [.12, .42, .14], palette.trim, [.3, .48, -.05]);
    }
  }
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  leftLeg.position.set(-.27, .62, 0);
  rightLeg.position.set(.27, .62, 0);
  rig.add(leftLeg, rightLeg);
  for (const [leg, side] of [[leftLeg, -1], [rightLeg, 1]]) {
    addBlock(leg, [.34, .66, .4], palette.dark, [0, -.28, 0]);
    addBlock(leg, [.4, .21, .55], palette.armor, [0, -.57, .09]);
    addBlock(leg, [.42, .09, .57], palette.trim, [0, -.63, .09]);
  }
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  leftArm.position.set(-.62, 1.7, .01);
  rightArm.position.set(.62, 1.7, .01);
  rig.add(leftArm, rightArm);
  for (const [arm, side] of [[leftArm, -1], [rightArm, 1]]) {
    addBlock(arm, [.34, .38, .42], palette.armor, [0, -.13, 0]);
    addBlock(arm, [.3, .47, .36], palette.cloth, [0, -.53, .06]);
    addBlock(arm, [.27, .23, .29], palette.skin, [0, -.83, .1]);
    addBlock(arm, [.36, .12, .43], palette.trim, [0, -.75, .11]);
  }
  const weapon = new THREE.Group();
  rightArm.add(weapon);
  weapon.position.set(0, -.8, .12);
  if (!hero && enemyKind === "archer" || heroId === "sunquan" && hero) {
    addBlock(weapon, [.1, .22, .12], palette.dark, [0, -.05, 0]);
    addBlock(weapon, [.12, .56, .12], palette.trim, [0, .34, 0]);
    const bowTop = addBlock(weapon, [.12, .38, .12], palette.trim, [.02, .76, 0]);
    const bowBottom = addBlock(weapon, [.12, .38, .12], palette.trim, [.02, -.08, 0]);
    bowTop.rotation.z = -.28;
    bowBottom.rotation.z = .28;
    addBlock(weapon, [.035, .95, .035], 0xd8c9aa, [.1, .33, .04]);
    if (!hero) {
      for (let i = 0; i < 3; i++) addBlock(bodyPivot, [.055, .64, .055], palette.trim, [-.38 + i * .1, .02, -.42]);
    }
  } else if (heroId === "caocao" && hero || !hero && enemyKind !== "runner") {
    addBlock(weapon, [.12, 1.0, .12], palette.dark, [0, .34, 0]);
    addBlock(weapon, [.22, .62, .08], palette.trim, [0, .85, .025], { metalness: .2, roughness: .42 });
    addBlock(weapon, [.45, .11, .16], palette.trim, [0, .52, 0]);
  } else {
    addBlock(weapon, [.09, 1.55, .09], palette.dark, [0, .48, 0]);
    addBlock(weapon, [.26, .28, .16], palette.trim, [0, 1.25, 0], { metalness: .16 });
    addBlock(weapon, [.1, .34, .1], palette.trim, [0, 1.48, 0]);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(hero ? .8 : .68, 20), new THREE.MeshBasicMaterial({ color: 0x455047, transparent: true, opacity: .22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .035;
  group.add(shadow);
  const baseScale = hero && heroId === "lvbu" ? 1.12 : 1;
  group.scale.setScalar(baseScale);
  const visual = { group, rig, bodyPivot, headGroup, leftArm, rightArm, leftLeg, rightLeg, weapon, body, color, heroId, enemyKind, hero, moving: false, attackAt: -Infinity, animationOffset: Math.random() * Math.PI * 2, baseScale };
  if (hero) visual.progression = addProgressionEquipment(group, heroId);
  return visual;
}

function updateWarriorMotion(visual, now) {
  if (!visual?.rig) return;
  const phase = now * (visual.moving ? .014 : .0022) + (visual.animationOffset ?? 0);
  const stride = visual.moving ? Math.sin(phase) : 0;
  const attackAge = (now - visual.attackAt) / 1000;
  const attack = attackAge >= 0 && attackAge < .42;
  const strike = attack ? Math.sin(Math.min(1, Math.max(0, attackAge / .42)) * Math.PI) : 0;
  visual.leftLeg.rotation.x = stride * .62;
  visual.rightLeg.rotation.x = -stride * .62;
  visual.leftArm.rotation.x = -stride * .4;
  visual.rightArm.rotation.x = stride * .4 + (attack ? -.25 + strike * 1.15 : 0);
  visual.rightArm.rotation.z = attack ? -.25 - strike * .72 : -.12;
  visual.leftArm.rotation.z = .12 + (attack ? strike * .15 : 0);
  visual.bodyPivot.position.y = 1.38 + (visual.moving ? Math.abs(stride) * .055 : Math.sin(phase) * .012);
  visual.bodyPivot.rotation.x = attack ? -.05 + strike * .11 : 0;
  visual.headGroup.rotation.x = attack ? -strike * .07 : 0;
}


const PIXEL_GENERAL_LORE = {
  liubei: ["劉備 · 仁德之主", "蜀國主公 · 綠金甲冑，重視同伴生存與支援。"],
  caocao: ["曹操 · 亂世梟雄", "魏國主公 · 黑金重甲，擅長統帥與強力攻擊。"],
  sunquan: ["孫權 · 江東霸主", "吳國主公 · 青藍戰袍，快速遠距離壓制敵軍。"],
  lvbu: ["呂布 · 無雙戰神", "群雄猛將 · 赤金戰鎧，以重擊突破重圍。"]
};
const portraitCache = new Map();
function paintGeneral(canvas, heroId) {
  if (!canvas || !PIXEL_GENERAL_LORE[heroId]) return;
  if (!portraitCache.has(heroId)) {
    const pic = new Image();
    const ready = new Promise((resolve) => {
      pic.onload = () => resolve(pic);
      pic.onerror = () => resolve(null);
    });
    pic.src = `/assets/pixel/actors/${heroId}-premium.png`;
    portraitCache.set(heroId, ready);
  }
  portraitCache.get(heroId).then((pic) => {
    if (!pic || !canvas.isConnected) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 56, 72);
    ctx.drawImage(pic, 0, 0, 56, 72, 0, 0, 56, 72);
  });
}
function refreshGeneralPresentation(heroId) {
  const lore = PIXEL_GENERAL_LORE[heroId] ?? PIXEL_GENERAL_LORE.liubei;
  if ($("heroInfoTitle")) $("heroInfoTitle").textContent = lore[0];
  if ($("heroInfo")) $("heroInfo").textContent = lore[1];
  if ($("currentHeroName")) $("currentHeroName").textContent = HEROES[heroId]?.name ?? "劉備";
  if (ui.home) ui.home.dataset.hero = heroId;
}
function showGeneralPicker(show) {
  const panel = $("heroPicker");
  if (!panel) return;
  panel.classList.toggle("hidden", !show);
  if (show) panel.querySelector(".hero-choice.selected")?.focus();
}
function initializeGeneralArt() {
  document.querySelectorAll("canvas[data-portrait]").forEach(c => paintGeneral(c, c.dataset.portrait));
  $("pickHero")?.addEventListener("click", () => showGeneralPicker(true));
  $("closeHeroPicker")?.addEventListener("click", () => showGeneralPicker(false));
  $("confirmHero")?.addEventListener("click", () => showGeneralPicker(false));
  $("heroPicker")?.addEventListener("keydown", (e) => { if (e.key === "Escape") showGeneralPicker(false); });
}

function setHero(heroId) {
  if (!HEROES[heroId]) return;
  appState.heroId = heroId;
  localStorage.setItem("samkokgo-hero", heroId);
  ui.heroChoices.querySelectorAll("[data-hero]").forEach((button) => button.classList.toggle("selected", button.dataset.hero === heroId));
  refreshGeneralPresentation(heroId);
  if (appState.screen === "home") {
    const position = localPlayer.group.position.clone();
    world.remove(localPlayer.group);
    localPlayer = makeWarrior(HEROES[heroId].color, true, heroId);
    localPlayer.group.position.copy(position);
    world.add(localPlayer.group);
  }
}

function createProgress() { return { xp: 0, level: 1, upgrades: { power: 0, tempo: 0, reach: 0, speed: 0 }, pendingChoices: [] }; }
function ensureProgress(playerId) { return appState.playerProgress[playerId] ??= createProgress(); }
function ensureVital(playerId) { return appState.playerVitals[playerId] ??= { hp: 100, maxHp: 100, downed: false, eliminated: false, reviveProgress: 0 }; }

function grantPlayerXp(playerId, amount) {
  const progress = ensureProgress(playerId);
  progress.xp += amount;
  const threshold = 5 + (progress.le…8254 tokens truncated…span");
      name.className = "roster-name";
      name.textContent = HEROES[members[i].heroId]?.name ?? "英雄";
      slot.append(name);
    }
    slot.setAttribute("aria-label", members[i] ? "玩家已加入" : "等待玩家");
    ui.roster.append(slot);
  }
  ui.roomStatus.dataset.count = `${count}/${appState.room?.maxPlayers ?? 6}`;
  if ($("roomCode")) $("roomCode").textContent = `房間 ${appState.roomId ?? "--------"} · ${count}/${appState.room?.maxPlayers ?? 6} 人`;
  ui.roomStatus.title = `${count}/${appState.room?.maxPlayers ?? 6}`;
  const locked = Boolean(appState.room?.locked);
  $("lockRoom").classList.toggle("selected", locked);
  $("lockRoom").setAttribute("aria-label", locked ? "解鎖房間" : "鎖定房間");
  $("lockRoom").innerHTML = locked
    ? '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="21" width="32" height="23" rx="5"/><path d="M15 21v-7a9 9 0 0 1 18 0M24 29v7"/></svg>'
    : '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="21" width="32" height="23" rx="5"/><path d="M15 21v-7a9 9 0 0 1 18 0v7M24 29v7"/></svg>';
  $("startGame").disabled = !appState.host;
  $("startGame").style.opacity = appState.host ? "1" : ".42";
  const canConfigure = appState.host && appState.room?.status === "waiting";
  for (const button of [ui.mapSelect, ui.difficultySelect, ui.sizeSelect]) button.disabled = !canConfigure;
  const mapName = ({ forest: "山林", camp: "軍營", city: "城池" })[appState.room?.mapId ?? "forest"];
  const difficultyName = ({ easy: "簡單", normal: "普通", hard: "困難" })[appState.room?.difficulty ?? "normal"];
  const playerLimit = appState.room?.maxPlayers ?? 6;
  $("mapValue").textContent = mapName;
  $("difficultyValue").textContent = difficultyName;
  $("sizeValue").textContent = `${playerLimit} 人`;
  ui.difficultySelect.dataset.difficulty = appState.room?.difficulty ?? "normal";
  ui.mapSelect.title = mapName;
  ui.mapSelect.setAttribute("aria-label", `地圖：${mapName}`);
  ui.difficultySelect.title = difficultyName;
  ui.difficultySelect.setAttribute("aria-label", `難度：${difficultyName}`);
  ui.sizeSelect.title = `${appState.room?.maxPlayers ?? 6}人房`;
  ui.sizeSelect.setAttribute("aria-label", `人數上限：${appState.room?.maxPlayers ?? 6}`);
}

function renderGameLock() {
  const button = $("gameLock");
  if (!button) return;
  const locked = Boolean(appState.room?.locked);
  button.disabled = !appState.host;
  button.classList.toggle("selected", locked);
  button.setAttribute("aria-label", locked ? "解鎖房間" : "鎖定房間");
  button.title = locked ? "解鎖房間" : "鎖定房間";
  button.innerHTML = locked
    ? '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="14" width="22" height="15" rx="3"/><path d="M10 14V9a6 6 0 0 1 12 0M16 19v5"/></svg>'
    : '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="14" width="22" height="15" rx="3"/><path d="M10 14V9a6 6 0 0 1 12 0v5M16 19v5"/></svg>';
}

function renderPartyStrip() {
  ui.partyStrip.replaceChildren();
  [...appState.players.values()].slice(0, 6).forEach((player) => {
    const dot = document.createElement("span");
    dot.className = `party-dot${appState.playerVitals[player.id]?.downed || appState.playerVitals[player.id]?.eliminated ? " down" : ""}`;
    dot.style.setProperty("--party-color", colorCss(HEROES[player.heroId]?.color ?? COLORS[player.colorIndex % COLORS.length]));
    ui.partyStrip.append(dot);
  });
}

async function refreshRooms() {
  if (appState.screen !== "home") return;
  try {
    const data = await api(protocolPath("/api/rooms"));
    ui.roomDrawer.replaceChildren();
    if (!(data.rooms ?? []).length) {
      const empty = document.createElement("p");
      empty.className = "rooms-empty";
      empty.textContent = "目前沒有公開房間，率先建立一支隊伍吧。";
      ui.roomDrawer.append(empty);
    }
    for (const room of data.rooms ?? []) {
      const card = document.createElement("button");
      card.className = "room-card";
      card.setAttribute("aria-label", `加入房間，${room.players} 位玩家`);
      card.innerHTML = `<span class="room-people">${Array.from({ length: room.maxPlayers }, (_, i) => `<i class="${i < room.players ? "person-dot" : "room-empty"}"></i>`).join("")}</span><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="#718078" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      card.addEventListener("click", () => joinRoom(room.id));
      ui.roomDrawer.append(card);
    }
  } catch { /* Local preview can still be explored without the room API. */ }
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) } });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function closeSocket() {
  clearTimeout(appState.reconnectTimer);
  appState.reconnectTimer = 0;
  if (appState.roomId) localStorage.removeItem(`samkokgo-resume-${appState.roomId}`);
  if (appState.socket) {
    const socket = appState.socket;
    appState.socket = null;
    socket.close(1000, "left");
  }
  appState.roomId = null;
  appState.selfId = null;
  appState.room = null;
  appState.host = false;
  appState.players.clear();
  for (const visual of playerVisuals.values()) world.remove(visual.group);
  playerVisuals.clear();
}

function returnHome() {
  closeSocket();
  clearRun();
  setScreen("home");
}

function clearRun() {
  appState.startedAt = null;
  appState.enemies.length = 0;
  for (const pickup of appState.pickups) removePickup(pickup);
  appState.pickups.length = 0;
  for (const projectile of appState.projectiles) {
    if (projectile.warning) {
      world.remove(projectile.warning);
      projectile.warning.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
    }
    if (projectile.mesh) {
      projectileGroup.remove(projectile.mesh);
      projectile.mesh.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
    }
  }
  appState.projectiles.length = 0;
  appState.nextPlayerAttacks.clear();
  appState.enemySequence = 0;
  appState.pickupSequence = 0;
  appState.lastGameSync = 0;
  appState.playerProgress = {};
  appState.bossesSpawned.clear();
  appState.finalBossDefeated = false;
  appState.playerVitals = {};
  appState.energy = 0;
  appState.abilityAvailableAt = 0;
  appState.abilityPending = false;
  appState.nextTeamHit = 0;
  enemyGroup.clear();
  pickupGroup.clear();
  projectileGroup.clear();
  for (const burst of appState.bursts) {
    world.remove(burst.mesh);
    burst.mesh.geometry.dispose();
    burst.mesh.material.dispose();
  }
  appState.bursts.length = 0;
  appState.xp = 0;
  appState.level = 1;
  ui.levelChoice.classList.add("hidden");
  ui.bossHealth.classList.add("hidden");
  ui.xpFill.style.width = "12%";
  renderVitals();
}

function showToast(message) {
  clearTimeout(appState.toastTimer);
  if (!message) { ui.toast.classList.remove("show"); ui.toast.textContent = ""; return; }
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  appState.toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 1800);
}

function colorCss(hex) { return `#${hex.toString(16).padStart(6, "0")}`; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function seeded(seed) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

function updateRotateHint() {
  ui.rotateHint.classList.toggle("hidden", !(window.innerHeight > window.innerWidth && appState.screen !== "result"));
}

function updateCamera() {
  const target = localPlayer.group.position;
  const distance = appState.cameraMode === 0 ? 37 : 44;
  const elevation = appState.cameraMode === 0 ? 29 : 42;
  const zOffset = appState.cameraMode === 0 ? 31 : 8;
  camera.position.set(target.x + 24, elevation, target.z + zOffset);
  camera.lookAt(target.x, 0, target.z);
  const aspect = Math.max(1, window.innerWidth / Math.max(1, window.innerHeight));
  const viewHeight = appState.cameraMode === 0 ? 18 : 21;
  camera.left = -viewHeight * aspect / 2;
  camera.right = viewHeight * aspect / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}

function updateMovement(delta) {
  const keys = appState.keys ?? {};
  let targetX = appState.move.x || ((keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0));
  let targetZ = appState.move.z || ((keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0));
  const ownVital = appState.playerVitals[appState.selfId];
  if (ownVital?.downed || ownVital?.eliminated) { targetX = 0; targetZ = 0; }
  const smoothing = 1 - Math.exp(-Math.min(delta, .05) * (Math.hypot(targetX, targetZ) > .08 ? 22 : 26));
  appState.moveCurrent.x += (targetX - appState.moveCurrent.x) * smoothing;
  appState.moveCurrent.z += (targetZ - appState.moveCurrent.z) * smoothing;
  let x = appState.moveCurrent.x;
  let z = appState.moveCurrent.z;
  const length = Math.hypot(x, z);
  localPlayer.moving = length > .08;
  if (length > 1) { x /= length; z /= length; }
  const speedRank = appState.playerProgress[appState.selfId]?.upgrades?.speed ?? 0;
  const speed = (HEROES[appState.heroId]?.speed ?? 11) + speedRank + (speedRank >= 5 ? 2 : 0);
  localPlayer.group.position.x = clamp(localPlayer.group.position.x + x * speed * delta, -WORLD.x + 2, WORLD.x - 2);
  localPlayer.group.position.z = clamp(localPlayer.group.position.z + z * speed * delta, -WORLD.z + 2, WORLD.z - 2);
  if (length > .08) localPlayer.group.rotation.y = Math.atan2(x, z);
  if (speedRank >= 5 && length > .4 && performance.now() - (localPlayer.lastRunTrail ?? 0) > 135) {
    localPlayer.lastRunTrail = performance.now();
    showRunTrail(localPlayer.group.position.x, localPlayer.group.position.z, appState.heroId);
  }
  if (appState.socket?.readyState === WebSocket.OPEN && performance.now() - appState.lastInput > (RULESET === "crossplay-v1" ? 100 : 250)) {
    appState.lastInput = performance.now();
    appState.socket.send(JSON.stringify({ type: "input", x, z, px: localPlayer.group.position.x, pz: localPlayer.group.position.z }));
  }
}

function updateRemotePlayers(delta) {
  for (const [id, visual] of playerVisuals) {
    const player = appState.players.get(id);
    if (!player) continue;
    const target = visual.target ?? new THREE.Vector3(player.x, 0, player.z);
    const dx = target.x - visual.group.position.x;
    const dz = target.z - visual.group.position.z;
    visual.moving = Math.hypot(dx, dz) > .04;
    if (visual.moving) visual.group.rotation.y = Math.atan2(dx, dz);
    visual.group.position.lerp(target, Math.min(1, delta * 8));
  }
}

function updateAbilityBursts(delta) {
  appState.bursts = appState.bursts.filter((burst) => {
    burst.age += delta;
    const progress = Math.min(1, burst.age / (burst.duration ?? .62));
    burst.mesh.scale.setScalar(.1 + progress * ((burst.scaleTo ?? 13) - .1));
    burst.mesh.material.opacity = .82 * (1 - progress);
    if (progress < 1) return true;
    world.remove(burst.mesh);
    burst.mesh.geometry.dispose();
    burst.mesh.material.dispose();
    return false;
  });
}

function updatePickups(delta) {
  for (const pickup of appState.pickups) {
    pickup.age += delta;
    pickup.core.rotation.y += delta * 1.8;
    pickup.core.rotation.x += delta * .65;
    pickup.group.position.y = Math.sin(pickup.age * 3.2) * .12;
  }
}

function updateCombat(now, delta) {
  if (appState.screen !== "game") return;
  if (RULESET === "crossplay-v1") {
    for (const enemy of appState.enemies) {
      if (enemy.targetPosition) enemy.group.position.lerp(enemy.targetPosition, Math.min(1, delta * 9));
    }
    if (appState.startedAt) {
      const duration = appState.room?.roundSeconds ?? 360;
      appState.secondsLeft = Math.max(0, duration - Math.floor((Date.now() - appState.startedAt) / 1000));
      const minutes = String(Math.floor(appState.secondsLeft / 60)).padStart(2, "0");
      const seconds = String(appState.secondsLeft % 60).padStart(2, "0");
      ui.timer.textContent = minutes + ":" + seconds;
    }
    return; // Cloudflare authoritative combat; no local host NPC/XP/damage.
  }
  if (appState.host) {
    const elapsed = Math.floor((Date.now() - appState.startedAt) / 1000);
    const bossTimes = [180, 420, 600];
    for (let bossIndex = 0; bossIndex < bossTimes.length; bossIndex += 1) {
      if (elapsed < bossTimes[bossIndex] || appState.bossesSpawned.has(bossIndex)) continue;
      appState.bossesSpawned.add(bossIndex);
      createEnemy(null, `boss-${bossIndex}`, 25 + Math.max(1, appState.players.size) * 10 + bossIndex * 12, false, "boss", bossIndex);
      playSound("boss");
      showToast("首領來襲");
    }
    if (now > appState.nextSpawn && appState.enemies.length < 36) {
      const roll = Math.random();
      const kind = elapsed > 240 && roll < .14 ? "archer" : elapsed > 90 && roll < .32 ? "runner" : elapsed > 120 && roll > .84 ? "elite" : "grunt";
      const elite = kind === "elite";
      createEnemy(null, null, elite ? 4 : kind === "grunt" ? 2 : kind === "archer" ? 3 : 1, elite, kind);
      appState.nextSpawn = now + Math.max(520, 1550 - elapsed * .8) + Math.random() * 420;
    }
    const party = [...appState.players.values()].filter((player) => !player.offline).map((player) => ({
      id: player.id,
      position: player.id === appState.selfId
        ? localPlayer.group.position.clone()
        : new THREE.Vector3(player.x, 0, player.z)
    }));
    if (!party.length) party.push({ id: appState.selfId, position: localPlayer.group.position });
    for (const player of party) ensureVital(player.id);
    const activeParty = party.filter((player) => !ensureVital(player.id).downed && !ensureVital(player.id).eliminated);
    for (const enemy of appState.enemies) {
      const data = enemy.group.userData;
      if (!data.alive) continue;
      if ((data.stunUntil ?? 0) > Date.now()) continue;
      if ((data.hitUntil ?? 0) > now) continue;
      if (!activeParty.length) break;
      let target = activeParty[0];
      let distance = Infinity;
      for (const player of activeParty) {
        const d = enemy.group.position.distanceTo(player.position);
        if (d < distance) { target = player; distance = d; }
      }
      const dx = target.position.x - enemy.group.position.x;
      const dz = target.position.z - enemy.group.position.z;
      if (data.kind === "archer") {
        enemy.group.rotation.y = Math.atan2(dx, dz);
        enemy.moving = distance > 12 || distance < 7.5;
        if (distance > 12) {
          enemy.group.position.x += dx / Math.max(distance, .001) * data.speed * delta;
          enemy.group.position.z += dz / Math.max(distance, .001) * data.speed * delta;
        } else if (distance < 7.5) {
          enemy.group.position.x -= dx / Math.max(distance, .001) * data.speed * 1.15 * delta;
          enemy.group.position.z -= dz / Math.max(distance, .001) * data.speed * 1.15 * delta;
        }
        if (distance < 20 && now - (data.shotAt ?? 0) > 1900) {
          data.shotAt = now;
          enemy.attackAt = now;
          const shotId = `${data.id}-${Math.floor(now)}`;
          const from = { x: enemy.group.position.x, z: enemy.group.position.z };
          const to = { x: target.position.x, z: target.position.z };
          const damage = (data.kind === "boss" ? 12 : 8) * ({ easy: .72, normal: 1, hard: 1.35 }[appState.difficulty] ?? 1);
          spawnEnemyShot({ from, to, targetId: target.id, shotId, damage });
          if (appState.socket?.readyState === WebSocket.OPEN) appState.socket.send(JSON.stringify({ type: "enemy-shot-fx", from, to, targetId: target.id, shotId, damage }));
        }
        continue;
      }
      const desiredDistance = data.kind === "boss" ? 1.8 : 1.65;
      enemy.moving = distance > desiredDistance;
      enemy.group.rotation.y = Math.atan2(dx, dz);
      if (distance > desiredDistance) {
        enemy.group.position.x += dx / Math.max(distance, .001) * data.speed * delta;
        enemy.group.position.z += dz / Math.max(distance, .001) * data.speed * delta;
      } else if (now - data.hitAt > (data.kind === "boss" ? 1750 : data.kind === "archer" ? 1350 : 1100)) {
        data.hitAt = now;
        enemy.attackAt = now;
        if (now >= appState.nextTeamHit) {
          const damage = (data.kind === "boss" ? 15 : data.kind === "elite" ? 9 : data.kind === "archer" ? 6 : data.kind === "runner" ? 5 : 7) * ({ easy: .72, normal: 1, hard: 1.35 }[appState.difficulty] ?? 1);
          const vital = ensureVital(target.id);
          vital.hp = Math.max(0, vital.hp - damage);
          if (vital.hp === 0) {
            vital.downed = true; vital.downedAt = Date.now(); vital.reviveProgress = 0;
            const activeIndex = activeParty.findIndex((player) => player.id === target.id);
            if (activeIndex >= 0) activeParty.splice(activeIndex, 1);
          }
          appState.nextTeamHit = now + 650;
          if (data.kind === "boss") showAbilityBurst(target.position.x, target.position.z);
        }
        if (target.id === appState.selfId) {
          playSound("hit");
          $("combatFlash").classList.add("hit");
          setTimeout(() => $("combatFlash").classList.remove("hit"), 130);
        }
      }
    }
    for (const downed of party) {
      const vital = ensureVital(downed.id);
      if (!vital.downed || vital.eliminated) continue;
      if (Date.now() - (vital.downedAt ?? Date.now()) > 25000) {
        vital.downed = false;
        vital.eliminated = true;
        continue;
      }
      const rescuer = activeParty.find((player) => player.id !== downed.id && player.position.distanceTo(downed.position) < 2.6);
      if (rescuer) vital.reviveProgress += delta;
      else vital.reviveProgress = Math.max(0, vital.reviveProgress - delta * .45);
      if (vital.reviveProgress >= 3) {
        vital.hp = 50;
        vital.downed = false;
        vital.reviveProgress = 0;
        showAbilityBurst(downed.position.x, downed.position.z);
        playSound("revive");
      }
    }
    for (const player of party) {
      const nextAttack = appState.nextPlayerAttacks.get(player.id) ?? 0;
      if (now < nextAttack) continue;
      const heroId = appState.players.get(player.id)?.heroId ?? (player.id === appState.selfId ? appState.heroId : "liubei");
      const hero = HEROES[heroId] ?? HEROES.liubei;
      const progress = ensureProgress(player.id);
      const target = nearestEnemy(player.position);
      if (target && target.group.position.distanceTo(player.position) < hero.range + progress.upgrades.reach * 2) {
        if (player.id === appState.selfId) playSound("attack");
        makeProjectile(player.position, target.group.position, heroId, progress.upgrades);
        const attackerVisual = player.id === appState.selfId ? localPlayer : playerVisuals.get(player.id);
        if (attackerVisual) attackerVisual.attackAt = now;
        if (appState.socket?.readyState === WebSocket.OPEN) {
          appState.socket.send(JSON.stringify({
            type: "attack-fx",
            from: { x: player.position.x, z: player.position.z },
            to: { x: target.group.position.x, z: target.group.position.z },
            heroId,
            playerId: player.id
          }));
        }
        const powerRank = progress.upgrades.power;
        const reachRank = progress.upgrades.reach;
        const baseDamage = hero.damage + powerRank + (powerRank >= 5 ? 1 : 0);
        target.group.userData.hp -= baseDamage;
        target.group.userData.hitUntil = now + 85;
        const hitX = target.group.position.x - player.position.x;
        const hitZ = target.group.position.z - player.position.z;
        const hitDistance = Math.max(.01, Math.hypot(hitX, hitZ));
        const knockback = heroId === "lvbu" ? .7 : .28;
        target.group.position.x = clamp(target.group.position.x + hitX / hitDistance * knockback, -WORLD.x + 2, WORLD.x - 2);
        target.group.position.z = clamp(target.group.position.z + hitZ / hitDistance * knockback, -WORLD.z + 2, WORLD.z - 2);
        if (powerRank >= 5) {
          for (const nearby of appState.enemies) {
            if (nearby === target || !nearby.group.userData.alive || nearby.group.position.distanceTo(target.group.position) > 1.7) continue;
            nearby.group.userData.hp -= Math.max(1, Math.ceil(baseDamage * .45));
            nearby.group.userData.hitUntil = now + 85;
            if (nearby.group.userData.hp <= 0) awardKill(nearby, player.id);
          }
        }
        if (reachRank >= 5) {
          const lineX = target.group.position.x - player.position.x;
          const lineZ = target.group.position.z - player.position.z;
          const lineLengthSq = Math.max(.01, lineX * lineX + lineZ * lineZ);
          for (const pierced of appState.enemies) {
            if (pierced === target || !pierced.group.userData.alive) continue;
            const px = pierced.group.position.x - player.position.x;
            const pz = pierced.group.position.z - player.position.z;
            const along = (px * lineX + pz * lineZ) / lineLengthSq;
            const across = Math.abs(px * lineZ - pz * lineX) / Math.sqrt(lineLengthSq);
            if (along <= 0 || along >= 1 || across > .72) continue;
            pierced.group.userData.hp -= Math.max(1, Math.ceil(baseDamage * .55));
            pierced.group.userData.hitUntil = now + 85;
            if (pierced.group.userData.hp <= 0) awardKill(pierced, player.id);
          }
        }
        if (target.group.userData.hp <= 0) awardKill(target, player.id);
        const tempoScale = Math.pow(.9, progress.upgrades.tempo) * (progress.upgrades.tempo >= 5 ? .82 : 1);
        appState.nextPlayerAttacks.set(player.id, now + hero.cadence * tempoScale);
      } else appState.nextPlayerAttacks.set(player.id, now + 160);
    }
    appState.pickups = appState.pickups.filter((pickup) => {
      if (now >= pickup.expiresAt) {
        removePickup(pickup);
        return false;
      }
      const collector = activeParty.find((player) => player.position.distanceTo(pickup.group.position) < 1.7);
      if (!collector) return true;
      if (pickup.type === "heal") {
        const vital = ensureVital(collector.id);
        if (vital.downed) { vital.downed = false; vital.hp = 38; vital.reviveProgress = 0; }
        else vital.hp = Math.min(vital.maxHp, vital.hp + 28);
      }
      else appState.energy = Math.min(100, appState.energy + 32);
      showAbilityBurst(pickup.group.position.x, pickup.group.position.z);
      removePickup(pickup);
      renderVitals();
      return false;
    });
    appState.enemies = appState.enemies.filter((enemy) => enemy.group.userData.alive);
    if (appState.socket?.readyState === WebSocket.OPEN && now - appState.lastGameSync > 150) {
      appState.lastGameSync = now;
      appState.socket.send(JSON.stringify({
        type: "game-state",
        state: {
          xp: appState.xp,
          level: appState.level,
          playerProgress: appState.playerProgress,
          playerVitals: appState.playerVitals,
          energy: appState.energy,
          finalBossDefeated: appState.finalBossDefeated,
          bossesSpawned: [...appState.bossesSpawned],
          boss: (() => {
            const boss = appState.enemies.find((enemy) => enemy.group.userData.kind === "boss");
            return boss ? { hp: boss.group.userData.hp, maxHp: boss.group.userData.maxHp, bossIndex: boss.group.userData.bossIndex } : null;
          })(),
          pickups: appState.pickups.map((pickup) => ({
            id: pickup.id,
            x: pickup.group.position.x,
            z: pickup.group.position.z,
            type: pickup.type
          })),
          enemies: appState.enemies.map((enemy) => ({
            id: enemy.group.userData.id,
            x: enemy.group.position.x,
            z: enemy.group.position.z,
            hp: enemy.group.userData.hp,
            elite: enemy.group.userData.elite,
            kind: enemy.group.userData.kind,
            bossIndex: enemy.group.userData.bossIndex
          }))
        }
      }));
      renderVitals();
      const hostBoss = appState.enemies.find((enemy) => enemy.group.userData.kind === "boss");
      renderBossHealth(hostBoss ? { hp: hostBoss.group.userData.hp, maxHp: hostBoss.group.userData.maxHp } : null);
    }
    const vitals = party.map((player) => ensureVital(player.id));
    if (vitals.length && vitals.every((vital) => vital.downed || vital.eliminated)) finishRun(false);
  }
  if (!appState.host) {
    for (const enemy of appState.enemies) {
      if (!enemy.targetPosition) continue;
      const dx = enemy.targetPosition.x - enemy.group.position.x;
      const dz = enemy.targetPosition.z - enemy.group.position.z;
      enemy.moving = Math.hypot(dx, dz) > .035;
      if (enemy.moving) enemy.group.rotation.y = Math.atan2(dx, dz);
      enemy.group.position.lerp(enemy.targetPosition, 1 - Math.exp(-delta * 14));
    }
  }
  for (const projectile of appState.projectiles) {
    projectile.elapsed += delta;
    if (projectile.enemyShot) {
      if (projectile.warning) {
        const pulse = .93 + Math.sin(projectile.elapsed * 22) * .07;
        projectile.warning.scale.setScalar(pulse);
        projectile.warning.children[0].material.opacity = .1 + (Math.sin(projectile.elapsed * 22) + 1) * .035;
      }
      if (projectile.elapsed < projectile.delay) continue;
      projectile.warning.visible = false;
      projectile.mesh.visible = true;
      projectile.progress = Math.min(1, projectile.progress + delta / projectile.duration);
      projectile.mesh.position.lerpVectors(projectile.from, projectile.to, projectile.progress);
      projectile.mesh.position.y += Math.sin(projectile.progress * Math.PI) * 1.15;
      projectile.mesh.rotation.y = Math.atan2(projectile.to.x - projectile.from.x, projectile.to.z - projectile.from.z);
      continue;
    }
    if (projectile.elapsed < (projectile.delay ?? 0)) continue;
    projectile.progress += delta * 4.2;
    projectile.mesh.position.lerpVectors(projectile.from, projectile.to, Math.min(projectile.progress, 1));
    projectile.mesh.rotation.z += delta * 3.4;
  }
  appState.projectiles = appState.projectiles.filter((projectile) => {
    if (projectile.progress < 1) return true;
    if (projectile.enemyShot) {
      resolveEnemyShot(projectile);
      if (projectile.warning) {
        world.remove(projectile.warning);
        projectile.warning.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
      }
      projectileGroup.remove(projectile.mesh);
      projectile.mesh.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
      showHitBurst(projectile.to.x, projectile.to.z, "caocao", {});
      return false;
    }
    showHitBurst(projectile.to.x, projectile.to.z, projectile.heroId, projectile.upgrades);
    projectileGroup.remove(projectile.mesh);
    projectile.mesh.geometry.dispose();
    projectile.mesh.material.dispose();
    return false;
  });
  if (appState.startedAt) {
    const elapsed = Math.floor((Date.now() - appState.startedAt) / 1000);
    appState.secondsLeft = Math.max(0, ROUND_SECONDS - elapsed);
    const mins = String(Math.floor(appState.secondsLeft / 60)).padStart(2, "0");
    const secs = String(appState.secondsLeft % 60).padStart(2, "0");
    ui.timer.textContent = `${mins}:${secs}`;
    if (appState.secondsLeft === 0) finishRun(appState.finalBossDefeated);
  }
}

function finishRun(win) {
  if (RULESET === "crossplay-v1") { showWebResult(win ? "victory" : "defeat"); return; }
  if (appState.screen !== "game") return;
  playSound(win ? "win" : "loss");
  ui.resultSeal.classList.toggle("win", win);
  setScreen("result");
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .05);
  const now = performance.now();
  if (appState.screen === "game") updateMovement(delta);
  updateRemotePlayers(delta);
  updateAbilityBursts(delta);
  updatePickups(delta);
  updateCombat(now, delta);
  if (appState.screen === "home") {
    localPlayer.group.position.set(Math.sin(now * .00025) * 1.8, 0, Math.cos(now * .00025) * .9);
    localPlayer.group.rotation.y += delta * .08;
  }
  updateCamera();
  updateWarriorMotion(localPlayer, now);
  updateProgressionEquipment(localPlayer, appState.playerProgress[appState.selfId], now, delta);
  for (const visual of playerVisuals.values()) {
    updateWarriorMotion(visual, now);
    updateProgressionEquipment(visual, appState.playerProgress[visual.playerId], now, delta);
  }
  for (const enemy of appState.enemies) updateWarriorMotion(enemy, now);
  renderer.render(scene, camera);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  updateCamera();
  updateRotateHint();
}

function installControls() {
  window.addEventListener("keydown", (event) => {
    appState.keys ??= {};
    appState.keys[event.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  });
  window.addEventListener("keyup", (event) => { if (appState.keys) appState.keys[event.code] = false; });
  const stick = ui.stick;
  const knob = stick.querySelector(".stick-knob");
  let stickOrigin = null;
  let stickRadius = 48;
  const clearMovementInput = (event = null) => {
    if (event?.pointerId != null && appState.pointer !== event.pointerId) return;
    appState.pointer = null;
    stickOrigin = null;
    appState.keys = {};
    appState.move = { x: 0, z: 0 };
    appState.moveCurrent = { x: 0, z: 0 };
    stick.classList.remove("active");
    knob.style.transform = "translate(-50%,-50%)";
    if (localPlayer) localPlayer.moving = false;
    if (appState.socket?.readyState === WebSocket.OPEN && appState.screen === "game") {
      appState.socket.send(JSON.stringify({
        type: "input", x: 0, z: 0,
        px: localPlayer.group.position.x, pz: localPlayer.group.position.z
      }));
    }
  };
  const setStick = (event) => {
    if (!stickOrigin) return;
    const dx = event.clientX - stickOrigin.x;
    const dy = event.clientY - stickOrigin.y;
    const distance = Math.hypot(dx, dy);
    const deadzone = 7;
    const amount = Math.min(1, Math.max(0, (distance - deadzone) / (stickRadius - deadzone)));
    const directionX = distance ? dx / distance : 0;
    const directionY = distance ? dy / distance : 0;
    appState.move = { x: directionX * amount, z: directionY * amount };
    const knobDistance = Math.min(distance, stickRadius);
    knob.style.transform = `translate(calc(-50% + ${directionX * knobDistance}px), calc(-50% + ${directionY * knobDistance}px))`;
  };
  const resetStick = (event) => clearMovementInput(event);
  document.addEventListener("pointerdown", (event) => {
    if (appState.screen !== "game" || appState.pointer !== null || event.button > 0) return;
    if (event.target.closest("button, a, input, select, textarea, .level-choice, .rotate-hint")) return;
    const rect = stick.getBoundingClientRect();
    stickRadius = Math.max(32, rect.width * .43);
    stickOrigin = { x: event.clientX, y: event.clientY };
    appState.pointer = event.pointerId;
    stick.style.left = `${clamp(event.clientX - rect.width / 2, 4, window.innerWidth - rect.width - 4)}px`;
    stick.style.top = `${clamp(event.clientY - rect.height / 2, 4, window.innerHeight - rect.height - 4)}px`;
    stick.classList.add("active");
    knob.style.transform = "translate(-50%,-50%)";
    event.preventDefault();
  }, { passive: false });
  window.addEventListener("pointermove", (event) => { if (appState.pointer === event.pointerId) setStick(event); });
  window.addEventListener("pointerup", resetStick);
  window.addEventListener("pointercancel", resetStick);
  window.addEventListener("blur", () => clearMovementInput());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearMovementInput();
  });

  $("quickJoin").addEventListener("click", quickJoin);
  ui.heroChoices.querySelectorAll("[data-hero]").forEach((button) => button.addEventListener("click", () => setHero(button.dataset.hero)));
  $("createRoom").addEventListener("click", createRoom);
  $("refreshRooms").addEventListener("click", async () => {
    const open = ui.home.classList.toggle("rooms-open");
    $("refreshRooms").setAttribute("aria-expanded", String(open));
    if (open) await refreshRooms();
  });
  $("lockRoom").addEventListener("click", () => sendRoomAction("lock"));
  ui.mapSelect.addEventListener("click", () => {
    const current = appState.room?.mapId ?? "forest";
    const mapId = MAP_ORDER[(MAP_ORDER.indexOf(current) + 1) % MAP_ORDER.length];
    sendRoomAction("configure", { mapId });
  });
  ui.difficultySelect.addEventListener("click", () => {
    const current = appState.room?.difficulty ?? "normal";
    const difficulty = DIFFICULTIES[(DIFFICULTIES.indexOf(current) + 1) % DIFFICULTIES.length];
    sendRoomAction("configure", { difficulty });
  });
  ui.sizeSelect.addEventListener("click", () => {
    const sizes = [2, 4, 6].filter((size) => size >= appState.players.size);
    const current = appState.room?.maxPlayers ?? 6;
    sendRoomAction("configure", { maxPlayers: sizes[(sizes.indexOf(current) + 1) % sizes.length] ?? 6 });
  });
  $("startGame").addEventListener("click", () => sendRoomAction("start"));
  $("leaveRoom").addEventListener("click", returnHome);
  $("exitGame").addEventListener("click", returnHome);
  $("cameraToggle").addEventListener("click", () => { appState.cameraMode = 1 - appState.cameraMode; });
  ui.specialAbility.addEventListener("click", () => {
    if (ui.specialAbility.disabled || appState.socket?.readyState !== WebSocket.OPEN) return;
    appState.abilityPending = true;
    if (RULESET === "crossplay-v1") appState.abilityAvailableAt = Date.now() + 20000;
    renderVitals();
    appState.socket.send(JSON.stringify({ type: "ability" }));
    setTimeout(() => {
      if (appState.abilityPending) {
        appState.abilityPending = false;
        renderVitals();
      }
    }, 1200);
  });
  for (const button of [ui.soundToggle, ui.soundToggleHud]) button.addEventListener("click", () => setAudioEnabled(!audioEnabled));
  $("gameLock").addEventListener("click", () => sendRoomAction("lock"));
  $("inviteButton").addEventListener("click", async () => {
    if (!appState.roomId) return;
    try {
      const browserLink = `${location.origin}/?room=${appState.roomId}${RULESET === "crossplay-v1" ? "" : "&classic=1"}`;
      const invitation = browserLink;
      await navigator.clipboard.writeText(invitation);
      showToast("邀請連結已複製");
    }
    catch { showToast("請使用瀏覽器分享功能邀請"); }
  });
  $("fullscreen").addEventListener("click", () => document.documentElement.requestFullscreen?.().catch(() => {}));
  $("playAgain").addEventListener("click", quickJoin);
  $("toHome").addEventListener("click", returnHome);
}

function sendRoomAction(type, extra = {}) {
  if (appState.socket?.readyState !== WebSocket.OPEN) return showToast("連線中，請稍候");
  appState.socket.send(JSON.stringify({ type, ...extra }));
}

window.addEventListener("resize", onResize);
installControls();
initializeGeneralArt();
ui.specialAbility.replaceChildren(pixelIcon("special", "special-pixel-icon"));
setHero(appState.heroId);
setAudioEnabled(audioEnabled);
clearRun();
onResize();
animate();
const launchRoute = new URLSearchParams(location.search);
const outcome = acceptedResult(launchRoute.get("result"));
if (outcome) showWebResult(outcome);
else if (launchRoute.has("room")) joinRoom(launchRoute.get("room"));
else refreshRooms();
setInterval(() => { if (appState.screen === "home") refreshRooms(); }, 8000);
setInterval(scheduleMusic, 1800);
