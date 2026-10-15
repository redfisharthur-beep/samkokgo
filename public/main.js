import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const COLORS = [0x77877d, 0xb67b6d, 0x8097a0, 0xb49b6e, 0x8e8290, 0x68766b];
const WORLD = { x: 48, z: 27 };
const ROUND_SECONDS = 8 * 60;
const $ = (id) => document.getElementById(id);
const ui = {
  home: $("home"), room: $("room"), hud: $("gameHud"), result: $("result"),
  roomDrawer: $("roomDrawer"), roster: $("roster"), partyStrip: $("partyStrip"),
  timer: $("timer"), xpFill: $("xpFill"), toast: $("toast"), stick: $("touchStick"),
  rotateHint: $("rotateHint"), resultSeal: $("resultSeal"), skillRow: $("skillRow")
};

const appState = {
  screen: "home", roomId: null, room: null, selfId: null, host: false,
  players: new Map(), socket: null, cameraMode: 0, startedAt: null,
  secondsLeft: ROUND_SECONDS, xp: 0, level: 1, muted: false, lastInput: 0,
  pointer: null, move: { x: 0, z: 0 }, enemies: [], projectiles: [],
  nextSpawn: 0, nextAttack: 0, lastGameSync: 0, enemySequence: 0,
  nextPlayerAttacks: new Map(), toastTimer: 0
};

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
buildMapDecor();

const localPlayer = makeWarrior(COLORS[0], true);
localPlayer.group.position.set(0, 0, 0);
world.add(localPlayer.group);
const playerVisuals = new Map();
const enemyGroup = new THREE.Group();
world.add(enemyGroup);
const projectileGroup = new THREE.Group();
world.add(projectileGroup);

function buildMapDecor() {
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(26, WORLD.z * 2),
    new THREE.MeshStandardMaterial({ color: 0xd1c7b2, roughness: 1 })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.015;
  path.receiveShadow = true;
  world.add(path);
  const crossPath = path.clone();
  crossPath.geometry = new THREE.PlaneGeometry(WORLD.x * 2, 16);
  crossPath.rotation.x = -Math.PI / 2;
  world.add(crossPath);

  // Muted hills and trees mark the edges without making the playable field feel boxed in.
  const rng = seeded(47);
  for (let i = 0; i < 42; i++) {
    const edge = Math.floor(rng() * 4);
    const x = edge < 2 ? (rng() * 2 - 1) * WORLD.x : (edge === 2 ? -1 : 1) * (WORLD.x - 2);
    const z = edge >= 2 ? (rng() * 2 - 1) * WORLD.z : (edge === 0 ? -1 : 1) * (WORLD.z - 2);
    const tree = makeTree(rng() > 0.55 ? 0x839184 : 0x9a9d87, 0x8b745c);
    tree.position.set(x, 0, z);
    tree.scale.setScalar(.75 + rng() * .7);
    world.add(tree);
  }
  for (const [x, z] of [[-17, -10], [17, -10], [-17, 10], [17, 10]]) {
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.1, .45, 7), new THREE.MeshStandardMaterial({ color: 0xb8a782, roughness: 1 }));
    marker.position.set(x, .22, z);
    marker.castShadow = true;
    marker.receiveShadow = true;
    world.add(marker);
  }
}

function makeTree(leafColor, trunkColor) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.23, .35, 1.8, 7), new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 1 }));
  trunk.position.y = .8;
  trunk.castShadow = true;
  group.add(trunk);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshStandardMaterial({ color: leafColor, roughness: 1, flatShading: true }));
  leaves.position.y = 2.2;
  leaves.scale.set(1.15, 1.25, 1.05);
  leaves.castShadow = true;
  group.add(leaves);
  const hill = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.1, .35, 8), new THREE.MeshStandardMaterial({ color: 0xaeb49e, roughness: 1 }));
  hill.position.y = .16;
  hill.receiveShadow = true;
  group.add(hill);
  return group;
}

function makeWarrior(color, hero = false) {
  const group = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color, roughness: .83, metalness: .04 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x555c54, roughness: .95 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8bda3, roughness: .9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc3a66f, roughness: .68, metalness: .1 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(hero ? .58 : .48, hero ? .86 : .7, 4, 8), armor);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(hero ? .52 : .43, 14, 12), skin);
  head.position.y = 2.08;
  head.castShadow = true;
  group.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.53, 12, 8, 0, Math.PI * 2, 0, Math.PI * .58), gold);
  helmet.position.y = 2.25;
  helmet.castShadow = true;
  group.add(helmet);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(.17, .68, 7), new THREE.MeshStandardMaterial({ color: hero ? 0xb77b6d : 0x7d7668, roughness: .8 }));
  plume.position.set(0, 2.8, -.02);
  plume.rotation.z = -.1;
  group.add(plume);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.17, .2, .72, 8), dark);
    leg.position.set(side * .24, .42, 0);
    leg.castShadow = true;
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.14, .38, 3, 6), armor);
    arm.position.set(side * .65, 1.27, 0);
    arm.rotation.z = side * -.28;
    arm.castShadow = true;
    group.add(arm);
  }
  const weapon = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, 2.15, 7), dark);
  shaft.position.y = 1.05;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.16, .5, 6), gold);
  tip.position.y = 2.35;
  weapon.add(shaft, tip);
  weapon.position.set(.7, .4, .12);
  weapon.rotation.z = -.22;
  group.add(weapon);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(hero ? .8 : .68, 20), new THREE.MeshBasicMaterial({ color: 0x455047, transparent: true, opacity: .22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .035;
  group.add(shadow);
  return { group, body, weapon, color };
}

function createEnemy(position = null, id = null, hp = 2) {
  const enemy = makeWarrior(0x9c6b65, false);
  enemy.group.scale.setScalar(.78);
  enemy.group.userData = { id: id ?? `enemy-${++appState.enemySequence}`, hp, speed: 2.3 + Math.random() * .9, alive: true, hitAt: 0 };
  enemyGroup.add(enemy.group);
  if (position) enemy.group.position.set(position.x, 0, position.z);
  else {
    const party = [...appState.players.values()];
    const centerX = party.length ? party.reduce((sum, player) => sum + player.x, 0) / party.length : localPlayer.group.position.x;
    const centerZ = party.length ? party.reduce((sum, player) => sum + player.z, 0) / party.length : localPlayer.group.position.z;
    const angle = Math.random() * Math.PI * 2;
    const radius = 22 + Math.random() * 13;
    enemy.group.position.set(
      clamp(centerX + Math.cos(angle) * radius, -WORLD.x + 2, WORLD.x - 2),
      0,
      clamp(centerZ + Math.sin(angle) * radius * .57, -WORLD.z + 2, WORLD.z - 2)
    );
  }
  appState.enemies.push(enemy);
  return enemy;
}

function makeProjectile(from, to) {
  const material = new THREE.MeshBasicMaterial({ color: 0xc8a96f, transparent: true, opacity: .92 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 8), material);
  mesh.position.set(from.x, 1.45, from.z);
  projectileGroup.add(mesh);
  appState.projectiles.push({ mesh, from: mesh.position.clone(), to: new THREE.Vector3(to.x, 1.25, to.z), progress: 0, target: to });
}

function nearestEnemy(position = localPlayer.group.position) {
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of appState.enemies) {
    if (!enemy.group.userData.alive) continue;
    const d = enemy.group.position.distanceTo(position);
    if (d < bestDistance) { best = enemy; bestDistance = d; }
  }
  return best;
}

function setScreen(name) {
  appState.screen = name;
  ui.home.classList.toggle("hidden", name !== "home");
  ui.room.classList.toggle("hidden", name !== "room");
  ui.hud.classList.toggle("hidden", name !== "game");
  ui.result.classList.toggle("hidden", name !== "result");
  updateRotateHint();
  if (name === "home") refreshRooms();
}

async function createRoom() {
  try {
    const data = await api("/api/create", { method: "POST" });
    await joinRoom(data.roomId);
  } catch { showToast("目前無法建立房間"); }
}

async function quickJoin() {
  try {
    const data = await api("/api/quick-join", { method: "POST" });
    await joinRoom(data.roomId);
  } catch { showToast("目前沒有可加入的房間"); }
}

async function joinRoom(roomId) {
  closeSocket();
  appState.roomId = roomId;
  appState.players.clear();
  localPlayer.group.position.set(0, 0, 0);
  setScreen("room");
  try {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${location.host}/ws?room=${encodeURIComponent(roomId)}`);
    appState.socket = socket;
    socket.addEventListener("message", handleSocketMessage);
    socket.addEventListener("close", () => {
      if (appState.socket === socket && appState.roomId) {
        appState.socket = null;
        showToast("連線已中斷");
        setTimeout(() => { if (appState.screen === "room" || appState.screen === "game") returnHome(); }, 1600);
      }
    });
    socket.addEventListener("error", () => showToast("連線發生問題"));
  } catch { showToast("無法連線到房間"); returnHome(); }
}

function handleSocketMessage(event) {
  let message;
  try { message = JSON.parse(event.data); } catch { return; }
  if (message.type === "welcome") {
    appState.selfId = message.selfId;
    applySnapshot(message.snapshot);
    return;
  }
  if (message.type === "presence") applySnapshot(message.snapshot);
  if (message.type === "players") setPlayers(message.players);
  if (message.type === "game-state") applyGameState(message.state);
  if (message.type === "room") {
    appState.room = message.room;
    appState.host = appState.room?.hostId === appState.selfId || appState.players.get(appState.selfId)?.host;
    renderRoom();
  }
  if (message.type === "start") {
    clearRun();
    appState.startedAt = message.startedAt;
    appState.secondsLeft = message.duration ?? ROUND_SECONDS;
    appState.nextSpawn = performance.now() + 1800;
    appState.lastGameSync = 0;
    setScreen("game");
    showToast("");
  }
}

function applySnapshot(snapshot) {
  if (!snapshot) return;
  appState.room = snapshot.room;
  setPlayers(snapshot.players ?? []);
  appState.host = Boolean(appState.players.get(appState.selfId)?.host);
  renderRoom();
}

function setPlayers(players) {
  const next = new Map();
  for (const player of players) {
    next.set(player.id, player);
    if (player.id === appState.selfId) {
      appState.host = Boolean(player.host);
      if (appState.screen === "room") localPlayer.group.position.set(player.x, 0, player.z);
      continue;
    }
    let visual = playerVisuals.get(player.id);
    if (!visual) {
      visual = makeWarrior(COLORS[player.colorIndex % COLORS.length], true);
      world.add(visual.group);
      playerVisuals.set(player.id, visual);
    }
    visual.target = new THREE.Vector3(player.x, 0, player.z);
    visual.colorIndex = player.colorIndex;
  }
  for (const [id, visual] of playerVisuals) {
    if (!next.has(id)) {
      world.remove(visual.group);
      playerVisuals.delete(id);
    }
  }
  appState.players = next;
  renderRoom();
  renderPartyStrip();
}

function applyGameState(state) {
  if (!state || !Array.isArray(state.enemies)) return;
  appState.xp = Number(state.xp) || 0;
  appState.level = Math.max(1, Number(state.level) || 1);
  ui.xpFill.style.width = `${Math.min(100, 12 + appState.level * 5)}%`;
  const skillCount = Math.min(6, 2 + appState.level);
  if (ui.skillRow.children.length !== skillCount) {
    ui.skillRow.replaceChildren(...Array.from({ length: skillCount }, () => {
      const token = document.createElement("span"); token.className = "skill-token"; return token;
    }));
  }
  const seen = new Set();
  for (const snapshot of state.enemies) {
    seen.add(snapshot.id);
    let enemy = appState.enemies.find((item) => item.group.userData.id === snapshot.id);
    if (!enemy) enemy = createEnemy({ x: snapshot.x, z: snapshot.z }, snapshot.id, snapshot.hp);
    enemy.group.position.set(snapshot.x, 0, snapshot.z);
    enemy.group.userData.hp = snapshot.hp;
  }
  appState.enemies = appState.enemies.filter((enemy) => {
    if (seen.has(enemy.group.userData.id)) return true;
    enemyGroup.remove(enemy.group);
    return false;
  });
}

function renderRoom() {
  const members = [...appState.players.values()];
  const count = members.length;
  ui.roster.replaceChildren();
  for (let i = 0; i < (appState.room?.maxPlayers ?? 6); i++) {
    const slot = document.createElement("div");
    slot.className = `roster-slot${members[i] ? " filled" : ""}${members[i]?.host ? " host" : ""}`;
    if (members[i]) slot.style.setProperty("--slot-color", colorCss(COLORS[members[i].colorIndex % COLORS.length]));
    slot.setAttribute("aria-label", members[i] ? "玩家已加入" : "等待玩家");
    ui.roster.append(slot);
  }
  ui.roomStatus.dataset.count = `${count}/${appState.room?.maxPlayers ?? 6}`;
  ui.roomStatus.title = `${count}/${appState.room?.maxPlayers ?? 6}`;
  const locked = Boolean(appState.room?.locked);
  $("lockRoom").classList.toggle("selected", locked);
  $("lockRoom").setAttribute("aria-label", locked ? "解鎖房間" : "鎖定房間");
  $("lockRoom").innerHTML = locked
    ? '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="21" width="32" height="23" rx="5"/><path d="M15 21v-7a9 9 0 0 1 18 0M24 29v7"/></svg>'
    : '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="21" width="32" height="23" rx="5"/><path d="M15 21v-7a9 9 0 0 1 18 0v7M24 29v7"/></svg>';
  $("startGame").disabled = !appState.host;
  $("startGame").style.opacity = appState.host ? "1" : ".42";
}

function renderPartyStrip() {
  ui.partyStrip.replaceChildren();
  [...appState.players.values()].slice(0, 6).forEach((player) => {
    const dot = document.createElement("span");
    dot.className = "party-dot";
    dot.style.setProperty("--party-color", colorCss(COLORS[player.colorIndex % COLORS.length]));
    ui.partyStrip.append(dot);
  });
}

async function refreshRooms() {
  if (appState.screen !== "home") return;
  try {
    const data = await api("/api/rooms");
    ui.roomDrawer.replaceChildren();
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
  appState.projectiles.length = 0;
  appState.nextPlayerAttacks.clear();
  appState.enemySequence = 0;
  appState.lastGameSync = 0;
  enemyGroup.clear();
  projectileGroup.clear();
  appState.xp = 0;
  appState.level = 1;
  ui.xpFill.style.width = "12%";
  ui.skillRow.replaceChildren(...Array.from({ length: 3 }, () => {
    const token = document.createElement("span"); token.className = "skill-token"; return token;
  }));
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
  let x = appState.move.x || ((keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0));
  let z = appState.move.z || ((keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0));
  const length = Math.hypot(x, z);
  if (length > 1) { x /= length; z /= length; }
  const speed = 11;
  localPlayer.group.position.x = clamp(localPlayer.group.position.x + x * speed * delta, -WORLD.x + 2, WORLD.x - 2);
  localPlayer.group.position.z = clamp(localPlayer.group.position.z + z * speed * delta, -WORLD.z + 2, WORLD.z - 2);
  if (length > .08) localPlayer.group.rotation.y = Math.atan2(x, z);
  if (appState.socket?.readyState === WebSocket.OPEN && performance.now() - appState.lastInput > 250) {
    appState.lastInput = performance.now();
    appState.socket.send(JSON.stringify({ type: "input", x, z, px: localPlayer.group.position.x, pz: localPlayer.group.position.z }));
  }
}

function updateRemotePlayers(delta) {
  for (const [id, visual] of playerVisuals) {
    const player = appState.players.get(id);
    if (!player) continue;
    visual.group.position.lerp(visual.target ?? new THREE.Vector3(player.x, 0, player.z), Math.min(1, delta * 8));
  }
}

function updateCombat(now, delta) {
  if (appState.screen !== "game") return;
  if (appState.host) {
    if (now > appState.nextSpawn && appState.enemies.length < 36) {
      createEnemy();
      appState.nextSpawn = now + Math.max(750, 1700 - appState.level * 60) + Math.random() * 500;
    }
    const party = [...appState.players.values()].map((player) => ({
      id: player.id,
      position: new THREE.Vector3(player.x, 0, player.z)
    }));
    if (!party.length) party.push({ id: appState.selfId, position: localPlayer.group.position });
    for (const enemy of appState.enemies) {
      const data = enemy.group.userData;
      if (!data.alive) continue;
      let target = party[0];
      let distance = Infinity;
      for (const player of party) {
        const d = enemy.group.position.distanceTo(player.position);
        if (d < distance) { target = player; distance = d; }
      }
      const dx = target.position.x - enemy.group.position.x;
      const dz = target.position.z - enemy.group.position.z;
      if (distance > 1.65) {
        enemy.group.position.x += dx / Math.max(distance, .001) * data.speed * delta;
        enemy.group.position.z += dz / Math.max(distance, .001) * data.speed * delta;
        enemy.group.rotation.y = Math.atan2(dx, dz);
      } else if (target.id === appState.selfId && now - data.hitAt > 1100) {
        data.hitAt = now;
        localPlayer.body.material.color.setHex(0xc08c7d);
        setTimeout(() => localPlayer.body.material.color.setHex(COLORS[0]), 140);
        $("combatFlash").classList.add("hit");
        setTimeout(() => $("combatFlash").classList.remove("hit"), 130);
      }
    }
    for (const player of party) {
      const nextAttack = appState.nextPlayerAttacks.get(player.id) ?? now + 450;
      if (now < nextAttack) continue;
      const target = nearestEnemy(player.position);
      if (target && target.group.position.distanceTo(player.position) < 17) {
        makeProjectile(player.position, target.group.position);
        target.group.userData.hp -= 1;
        if (target.group.userData.hp <= 0) {
          target.group.userData.alive = false;
          enemyGroup.remove(target.group);
          appState.xp += 1;
          if (appState.xp >= 7 + appState.level * 2) {
            appState.xp = 0;
            appState.level += 1;
            ui.xpFill.style.width = `${Math.min(100, 12 + appState.level * 5)}%`;
            addSkillToken();
          }
        }
        appState.nextPlayerAttacks.set(player.id, now + Math.max(300, 780 - appState.level * 15));
      }
    }
    appState.enemies = appState.enemies.filter((enemy) => enemy.group.userData.alive);
    if (appState.socket?.readyState === WebSocket.OPEN && now - appState.lastGameSync > 150) {
      appState.lastGameSync = now;
      appState.socket.send(JSON.stringify({
        type: "game-state",
        state: {
          xp: appState.xp,
          level: appState.level,
          enemies: appState.enemies.map((enemy) => ({
            id: enemy.group.userData.id,
            x: enemy.group.position.x,
            z: enemy.group.position.z,
            hp: enemy.group.userData.hp
          }))
        }
      }));
    }
  }
  for (const projectile of appState.projectiles) {
    projectile.progress += delta * 3.4;
    projectile.mesh.position.lerpVectors(projectile.from, projectile.to, Math.min(projectile.progress, 1));
  }
  appState.projectiles = appState.projectiles.filter((projectile) => {
    if (projectile.progress < 1) return true;
    projectileGroup.remove(projectile.mesh);
    return false;
  });
  if (appState.startedAt) {
    const elapsed = Math.floor((Date.now() - appState.startedAt) / 1000);
    appState.secondsLeft = Math.max(0, ROUND_SECONDS - elapsed);
    const mins = String(Math.floor(appState.secondsLeft / 60)).padStart(2, "0");
    const secs = String(appState.secondsLeft % 60).padStart(2, "0");
    ui.timer.textContent = `${mins}:${secs}`;
    if (appState.secondsLeft === 0) finishRun(true);
  }
}

function addSkillToken() {
  if (ui.skillRow.children.length < 6) {
    const token = document.createElement("span"); token.className = "skill-token"; ui.skillRow.append(token);
  }
}

function finishRun(win) {
  if (appState.screen !== "game") return;
  ui.resultSeal.classList.toggle("win", win);
  setScreen("result");
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .05);
  const now = performance.now();
  if (appState.screen === "game") updateMovement(delta);
  updateRemotePlayers(delta);
  updateCombat(now, delta);
  if (appState.screen === "home") {
    localPlayer.group.position.set(Math.sin(now * .00025) * 1.8, 0, Math.cos(now * .00025) * .9);
    localPlayer.group.rotation.y += delta * .08;
  }
  updateCamera();
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
  const setStick = (event) => {
    const rect = stick.getBoundingClientRect();
    const radius = rect.width * .34;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.min(1, Math.hypot(dx, dy) / radius);
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * length;
    const y = Math.sin(angle) * length;
    appState.move = { x, z: y };
    stick.querySelector(".stick-knob").style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
  };
  stick.addEventListener("pointerdown", (event) => { appState.pointer = event.pointerId; stick.setPointerCapture(event.pointerId); setStick(event); });
  stick.addEventListener("pointermove", (event) => { if (appState.pointer === event.pointerId) setStick(event); });
  const resetStick = () => { appState.pointer = null; appState.move = { x: 0, z: 0 }; stick.querySelector(".stick-knob").style.transform = "translate(-50%,-50%)"; };
  stick.addEventListener("pointerup", resetStick);
  stick.addEventListener("pointercancel", resetStick);

  $("quickJoin").addEventListener("click", quickJoin);
  $("createRoom").addEventListener("click", createRoom);
  $("refreshRooms").addEventListener("click", refreshRooms);
  $("lockRoom").addEventListener("click", () => sendRoomAction("lock"));
  $("startGame").addEventListener("click", () => sendRoomAction("start"));
  $("leaveRoom").addEventListener("click", returnHome);
  $("exitGame").addEventListener("click", returnHome);
  $("cameraToggle").addEventListener("click", () => { appState.cameraMode = 1 - appState.cameraMode; });
  $("inviteButton").addEventListener("click", async () => {
    if (!appState.roomId) return;
    try { await navigator.clipboard.writeText(`${location.origin}/?room=${appState.roomId}`); showToast("邀請連結已複製"); }
    catch { showToast("請使用瀏覽器分享功能邀請"); }
  });
  $("fullscreen").addEventListener("click", () => document.documentElement.requestFullscreen?.().catch(() => {}));
  $("playAgain").addEventListener("click", quickJoin);
  $("toHome").addEventListener("click", returnHome);
}

function sendRoomAction(type) {
  if (appState.socket?.readyState !== WebSocket.OPEN) return showToast("連線中，請稍候");
  appState.socket.send(JSON.stringify({ type }));
}

window.addEventListener("resize", onResize);
installControls();
clearRun();
onResize();
animate();
if (new URLSearchParams(location.search).has("room")) joinRoom(new URLSearchParams(location.search).get("room"));
else refreshRooms();
setInterval(() => { if (appState.screen === "home") refreshRooms(); }, 8000);
