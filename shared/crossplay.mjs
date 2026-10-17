/**
 * Crossplay v1 authoritative battlefield.
 *
 * Cloudflare Durable Object owns health, spawns, XP, upgrades and victory.
 * Clients may submit movement direction and upgrade choices only.
 * No Godot or Three.js frame-loop damage is trusted in this mode.
 */
export const COOP_SECONDS = 360;
export const WORLD_X = 46;
export const WORLD_Z = 25;
export const ENEMY_LIMIT = 30;
export const UPGRADE_IDS = ["power", "tempo", "reach", "speed"];
export const HERO_STATS = Object.freeze({
  liubei: { speed: 10.5, damage: 8, interval: 0.85, range: 8 },
  caocao: { speed: 9.5, damage: 12, interval: 1.0, range: 8.5 },
  sunquan: { speed: 11, damage: 7, interval: 0.60, range: 9 },
  lvbu: { speed: 9.5, damage: 16, interval: 1.05, range: 6.5 }
});
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const bounded = (v, a, b) => Math.max(a, Math.min(b, finite(v)));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function makeProgress() {
  return { xp: 0, level: 1, upgrades: { power: 0, tempo: 0, reach: 0, speed: 0 }, pendingChoices: [] };
}
export function makeBattle(now = Date.now()) {
  return { schema: "crossplay-v1", elapsed: 0, startedAt: now, nextEnemy: 1, nextPickup: 1, nextProjectile: 1,
    spawnClock: 0, boss: null, bossSpawned: false, finalBossDefeated: false,
    bossesSpawned: [], energy: 0, enemies: [], pickups: [], projectiles: [], playerProgress: {},
    playerVitals: {}, cooldowns: {}, dashCooldowns: {}, invulnerableUntil: {}, result: null, xp: 0, level: 1 };
}
export function syncPlayers(state, players) {
  for (const p of players) {
    if (!p.playerId) continue;
    state.playerProgress[p.playerId] ??= makeProgress();
    const maxHp = 100 + bounded(p.gearDefense ?? 0, 0, 15) * 8;
    state.playerVitals[p.playerId] ??= { hp: maxHp, maxHp, downed: false,
      eliminated: false, reviveProgress: 0, downedAt: 0 };
  }
}
function gainXp(state, players, points) {
  for (const p of players) {
    const progress = state.playerProgress[p.playerId];
    if (!progress) continue;
    progress.xp += points;
    let safety = 0;
    while (progress.xp >= 5 + (progress.level - 1) * 2 && safety++ < 8) {
      progress.xp -= 5 + (progress.level - 1) * 2;
      progress.level++;
      const offers = UPGRADE_IDS.filter(id => progress.upgrades[id] < 5);
      if (offers.length) progress.pendingChoices.push(offers.slice(0, 3));
    }
  }
}
export function chooseUpgrade(state, playerId, upgradeId) {
  const progress = state.playerProgress[playerId];
  if (!progress || !UPGRADE_IDS.includes(upgradeId)) return false;
  const offered = progress.pendingChoices[0];
  if (!offered?.includes(upgradeId) || progress.upgrades[upgradeId] >= 5) return false;
  progress.upgrades[upgradeId]++;
  progress.pendingChoices.shift();
  return true;
}
export function movePlayer(player, dx, dz, seconds) {
  const mag = Math.hypot(dx, dz);
  if (mag < 0.001) return player;
  const speed = (HERO_STATS[player.heroId] ?? HERO_STATS.liubei).speed + bounded(player.gearSpeed ?? 0, 0, 3) * 0.7;
  const dt = bounded(seconds, 0, 0.25);
  player.x = bounded(player.x + dx / Math.max(1, mag) * speed * dt, -WORLD_X, WORLD_X);
  player.z = bounded(player.z + dz / Math.max(1, mag) * speed * dt, -WORLD_Z, WORLD_Z);
  return player;
}

export function useDash(state, player, players, dx = 0, dz = 0, now = Date.now()) {
  if (!state || !player?.playerId || state.result) return false;
  const playerId = player.playerId;
  const vital = state.playerVitals?.[playerId];
  if (!vital || vital.downed || vital.eliminated || (state.dashCooldowns?.[playerId] ?? 0) > now) return false;
  state.dashCooldowns ??= {};
  state.invulnerableUntil ??= {};
  let x = bounded(dx, -1, 1);
  let z = bounded(dz, -1, 1);
  let magnitude = Math.hypot(x, z);
  if (magnitude < 0.1) {
    const nearest = state.enemies.reduce((best, enemy) => !best || distance(player, enemy) < distance(player, best) ? enemy : best, null);
    if (nearest) { x = player.x - nearest.x; z = player.z - nearest.z; magnitude = Math.hypot(x, z); }
  }
  if (magnitude < 0.1) { x = 1; z = 0; magnitude = 1; }
  x /= magnitude;
  z /= magnitude;
  const start = { x: player.x, z: player.z };
  const dashLength = 6.5;
  const end = { x: bounded(start.x + x * dashLength, -WORLD_X, WORLD_X), z: bounded(start.z + z * dashLength, -WORLD_Z, WORLD_Z) };
  const actualX = end.x - start.x;
  const actualZ = end.z - start.z;
  const actualLength = Math.max(0.001, Math.hypot(actualX, actualZ));
  player.x = end.x;
  player.z = end.z;
  state.dashCooldowns[playerId] = now + 4200;
  state.invulnerableUntil[playerId] = now + 480;
  const upgrades = state.playerProgress?.[playerId]?.upgrades ?? {};
  const damage = 18 + bounded(player.gearAttack ?? 0, 0, 15) * 2 + bounded(upgrades.power ?? 0, 0, 5) * 4;
  for (const enemy of [...state.enemies]) {
    const along = ((enemy.x - start.x) * actualX + (enemy.z - start.z) * actualZ) / actualLength;
    if (along < 0 || along > actualLength) continue;
    const closestX = start.x + actualX * along / actualLength;
    const closestZ = start.z + actualZ * along / actualLength;
    if (Math.hypot(enemy.x - closestX, enemy.z - closestZ) > 1.6) continue;
    enemy.hp -= damage;
    if (enemy.hp <= 0) killEnemy(state, enemy);
  }
  return { from: start, to: end, cooldownUntil: state.dashCooldowns[playerId] };
}
function spawn(state, x, z, kind = "grunt", difficulty = "normal", players = 1) {
  if (kind === "boss" && state.enemies.length >= ENEMY_LIMIT) {
    const expendable = state.enemies.findIndex(e => e.kind !== "boss");
    if (expendable >= 0) state.enemies.splice(expendable, 1);
  }
  if (state.enemies.length >= ENEMY_LIMIT) return;
  const scale = { easy: 0.85, normal: 1, hard: 1.3 }[difficulty] ?? 1;
  const base = { grunt: 20, runner: 15, archer: 19, elite: 42, boss: 600 }[kind] ?? 20;
  const hp = Math.round((base + (kind === "boss" ? players * 100 : 0)) * scale);
  const id = "e-" + state.nextEnemy++;
  state.enemies.push({ id, x: bounded(x, -WORLD_X, WORLD_X), z: bounded(z, -WORLD_Z, WORLD_Z),
    hp, maxHp: hp, kind, bossIndex: kind === "boss" ? 0 : -1, elite: kind === "elite" });
  if (kind === "boss") state.boss = { hp, maxHp: hp, bossIndex: 0 };
}
function killEnemy(state, enemy) {
  state.enemies = state.enemies.filter(e => e !== enemy);
  if (enemy.kind === "boss") { state.finalBossDefeated = true; state.boss = null; }
  const id = "p-" + state.nextPickup++;
  const roll = Math.random();
  const type = enemy.kind === "boss" ? "treasure" : roll < 0.12 ? "heal" : roll < 0.38 ? "treasure" : "energy";
  state.pickups.push({ id, x: enemy.x, z: enemy.z, type });
  if (state.pickups.length > 20) state.pickups.shift();
}
function fireProjectile(state, enemy, target, angleOffset = 0, damage = 10, delay = 0.42) {
  const dx = target.x - enemy.x;
  const dz = target.z - enemy.z;
  const angle = Math.atan2(dz, dx) + angleOffset;
  const speed = enemy.kind === "boss" ? 10.5 : 8.2;
  state.projectiles.push({
    id: "b-" + state.nextProjectile++, x: enemy.x, z: enemy.z,
    vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed,
    life: 5.2, delay, damage, pattern: enemy.kind === "boss" ? "boss-fan" : "arrow"
  });
  if (state.projectiles.length > 48) state.projectiles.splice(0, state.projectiles.length - 48);
}
export function useAbility(state, playerId, players, now = Date.now()) {
  const p = players.find(p => p.playerId === playerId);
  const vital = state.playerVitals[playerId];
  if (!p || vital?.downed || vital?.eliminated || state.result) return false;
  if ((state.cooldowns[playerId] ?? 0) > now) return false;
  state.cooldowns[playerId] = now + 20000;
  const abilityDamage = 42 + bounded(p.gearAttack ?? 0, 0, 15) * 2;
  for (const enemy of [...state.enemies]) {
    if (distance(p, enemy) > 11) continue;
    enemy.hp -= abilityDamage;
    if (enemy.hp <= 0) killEnemy(state, enemy);
  }
  return true;
}
export function advanceBattle(state, players, dt, now = Date.now(), difficulty = "normal") {
  if (!state || state.result) return state;
  dt = bounded(dt, 0, 1);
  state.elapsed = Math.min(COOP_SECONDS, state.elapsed + dt);
  syncPlayers(state, players);
  const alive = players.filter(p => !state.playerVitals[p.playerId]?.downed
    && !state.playerVitals[p.playerId]?.eliminated);
  state.spawnClock += dt;
  if (!state.bossSpawned && state.elapsed >= 120) {
    state.bossSpawned = true;
    state.bossesSpawned = [0];
    const target = alive[0] ?? { x: 0, z: 0 };
    spawn(state, target.x + 18, target.z, "boss", difficulty, players.length);
  }
  if (state.elapsed < 300 && state.spawnClock > Math.max(0.7, 2.4 - state.elapsed / 240)) {
    state.spawnClock = 0;
    const target = alive.length ? alive[Math.floor(Math.random() * alive.length)] : { x: 0, z: 0 };
    const theta = Math.random() * Math.PI * 2;
    const kind = state.elapsed > 135 && Math.random() < 0.14 ? "elite"
      : state.elapsed > 75 && Math.random() < 0.22 ? "runner"
      : state.elapsed > 150 && Math.random() < 0.17 ? "archer" : "grunt";
    spawn(state, target.x + Math.cos(theta) * 17, target.z + Math.sin(theta) * 12, kind, difficulty);
  }
  for (const enemy of [...state.enemies]) {
    const nearest = alive.reduce((best, p) => !best || distance(p, enemy) < distance(best, enemy) ? p : best, null);
    if (!nearest) break;
    const gap = distance(enemy, nearest);
    if (enemy.kind === "archer") {
      enemy.attackClock = (enemy.attackClock ?? 1.5) - dt;
      if (gap > 11) {
        const travel = Math.min(gap - 10, 1.8 * dt);
        enemy.x += (nearest.x - enemy.x) / gap * travel;
        enemy.z += (nearest.z - enemy.z) / gap * travel;
      }
      if (enemy.attackClock <= 0 && gap < 28) {
        enemy.attackClock = 2.2 + Math.random() * 0.45;
        fireProjectile(state, enemy, nearest, 0, 9, 0.52);
      }
    } else if (enemy.kind === "boss") {
      enemy.attackClock = (enemy.attackClock ?? 3) - dt;
      if (gap > 5) {
        const travel = Math.min(gap - 4.5, 2.1 * dt);
        enemy.x += (nearest.x - enemy.x) / gap * travel;
        enemy.z += (nearest.z - enemy.z) / gap * travel;
      }
      if (enemy.attackClock <= 0) {
        enemy.attackClock = 3.6;
        for (const spread of [-0.55, -0.28, 0, 0.28, 0.55]) fireProjectile(state, enemy, nearest, spread, 14, 0.68);
      }
    } else if (gap > 1.3) {
      const rate = enemy.kind === "runner" ? 4.2 : enemy.kind === "boss" ? 2.1 : 2.5;
      const travel = Math.min(gap - 1.2, rate * dt);
      enemy.x += (nearest.x - enemy.x) / gap * travel;
      enemy.z += (nearest.z - enemy.z) / gap * travel;
    } else {
      const vital = state.playerVitals[nearest.playerId];
      const defense = bounded(nearest.gearDefense ?? 0, 0, 15);
        if ((state.invulnerableUntil?.[nearest.playerId] ?? 0) <= now)
          vital.hp = Math.max(0, vital.hp - (enemy.kind === "boss" ? 15 : 5) * (1 - defense * 0.025) * dt);
      if (vital.hp <= 0 && !vital.downed) {
        vital.downed = true;
        vital.downedAt = now;
      }
    }
  }
  for (const projectile of [...state.projectiles]) {
    projectile.delay = Math.max(0, projectile.delay - dt);
    projectile.life -= dt;
    if (projectile.delay <= 0) {
      projectile.x += projectile.vx * dt;
      projectile.z += projectile.vz * dt;
      const target = alive.find(p => distance(p, projectile) < 1.15
        && (state.invulnerableUntil?.[p.playerId] ?? 0) <= now);
      if (target) {
        const vital = state.playerVitals[target.playerId];
        if (!vital?.downed && !vital?.eliminated) {
          const defense = bounded(target.gearDefense ?? 0, 0, 15);
          vital.hp = Math.max(0, vital.hp - projectile.damage * (1 - defense * 0.025));
          if (vital.hp <= 0 && !vital.downed) { vital.downed = true; vital.downedAt = now; }
        }
        state.projectiles = state.projectiles.filter(item => item !== projectile);
      }
    }
    if (projectile.life <= 0 || Math.abs(projectile.x) > WORLD_X + 5 || Math.abs(projectile.z) > WORLD_Z + 5)
      state.projectiles = state.projectiles.filter(item => item !== projectile);
  }
  for (const player of alive) {
    const progress = state.playerProgress[player.playerId];
    const stats = HERO_STATS[player.heroId] ?? HERO_STATS.liubei;
    const rank = progress.upgrades;
    const cooldownKey = "attack-" + player.playerId;
    const interval = Math.max(0.22, stats.interval * (1 - rank.tempo * 0.10));
    if ((state.cooldowns[cooldownKey] ?? 0) > now) continue;
    const closest = state.enemies.reduce((best, e) => distance(e, player) <= stats.range + rank.reach * 1.2
      && (!best || distance(e, player) < distance(best, player)) ? e : best, null);
    if (!closest) continue;
    closest.hp -= Math.round((stats.damage + bounded(player.gearAttack ?? 0, 0, 15) * 2) * (1 + rank.power * 0.22));
    state.cooldowns[cooldownKey] = now + interval * 1000;
    if (closest.hp <= 0) killEnemy(state, closest);
  }
  for (const pickup of [...state.pickups]) {
    if (!alive.some(p => distance(p, pickup) < 2.6)) continue;
    state.pickups = state.pickups.filter(p => p !== pickup);
    gainXp(state, players, pickup.type === "treasure" ? 4 : 2);
    if (pickup.type === "treasure") state.energy = Math.min(100, state.energy + 38);
    if (pickup.type === "heal") {
      const collector = alive.find(p => distance(p, pickup) < 2.6);
      const vital = collector && state.playerVitals[collector.playerId];
      if (vital) vital.hp = Math.min(vital.maxHp, vital.hp + 25);
    }
  }
  for (const p of players) {
    const vital = state.playerVitals[p.playerId];
    if (!vital?.downed || vital.eliminated) continue;
    const rescuers = alive.filter(a => a.playerId !== p.playerId && distance(a, p) < 4.2);
    vital.reviveProgress = rescuers.length ? vital.reviveProgress + dt : Math.max(0, vital.reviveProgress - dt);
    if (vital.reviveProgress >= 3) {
      vital.hp = 40; vital.downed = false; vital.downedAt = 0; vital.reviveProgress = 0;
    } else if (now - vital.downedAt >= 25000) {
      vital.eliminated = true; vital.reviveProgress = 0;
    }
  }
  if (state.boss) {
    const b = state.enemies.find(e => e.kind === "boss");
    if (b) state.boss.hp = b.hp;
  }
  state.xp = state.playerProgress[players[0]?.playerId]?.xp ?? 0;
  state.level = state.playerProgress[players[0]?.playerId]?.level ?? 1;
  if (players.length && players.every(p => state.playerVitals[p.playerId]?.eliminated)) state.result = "defeat";
  if (state.elapsed >= COOP_SECONDS) state.result = state.finalBossDefeated ? "victory" : "defeat";
  return state;
}
