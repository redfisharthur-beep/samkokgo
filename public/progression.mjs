export const PROFILE_KEY = "samkokgo-progression-v1";
import { HERO_IDS } from "./heroes.mjs";
export const HERO_ORDER = HERO_IDS;
export const MAP_ORDER = ["forest", "camp", "city"];
export const SUMMON_COST = 100;

export function freshProfile() {
  return {
    version: 1,
    seals: 0,
    unlockedHeroes: HERO_ORDER.slice(0, 3),
    unlockedMaps: [MAP_ORDER[0]],
    inventory: [],
    equipped: { weapon: null, armor: null },
    claimedRuns: [],
    completedRuns: 0
  };
}

export function loadProfile(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PROFILE_KEY) ?? "null");
    if (!parsed || parsed.version !== 1) return freshProfile();
    const profile = freshProfile();
    profile.seals = clampInt(parsed.seals, 0, 999999);
    profile.unlockedHeroes = [...new Set(["liubei", "caocao", "sunquan", ...(Array.isArray(parsed.unlockedHeroes) ? parsed.unlockedHeroes : [])].filter(id => HERO_ORDER.includes(id)))];
    profile.unlockedMaps = [...new Set(["forest", ...(Array.isArray(parsed.unlockedMaps) ? parsed.unlockedMaps : [])].filter(id => MAP_ORDER.includes(id)))];
    profile.inventory = Array.isArray(parsed.inventory) ? parsed.inventory.filter(validGear).slice(-60) : [];
    profile.equipped = {
      weapon: profile.inventory.some(item => item.id === parsed.equipped?.weapon && item.slot === "weapon") ? parsed.equipped.weapon : null,
      armor: profile.inventory.some(item => item.id === parsed.equipped?.armor && item.slot === "armor") ? parsed.equipped.armor : null
    };
    profile.claimedRuns = Array.isArray(parsed.claimedRuns) ? parsed.claimedRuns.filter(x => typeof x === "string").slice(-80) : [];
    profile.completedRuns = clampInt(parsed.completedRuns, 0, 999999);
    return profile;
  } catch {
    return freshProfile();
  }
}

export function saveProfile(profile, storage = globalThis.localStorage) {
  try { storage?.setItem(PROFILE_KEY, JSON.stringify(profile)); return true; }
  catch { return false; }
}

export function summonHero(profile, random = Math.random) {
  if (profile.seals < SUMMON_COST) return { ok: false, reason: "not-enough-seals" };
  const locked = HERO_ORDER.filter(id => !profile.unlockedHeroes.includes(id));
  if (!locked.length) return { ok: false, reason: "all-unlocked" };
  profile.seals -= SUMMON_COST;
  const heroId = locked[Math.min(locked.length - 1, Math.floor(random() * locked.length))];
  profile.unlockedHeroes.push(heroId);
  return { ok: true, heroId };
}

export function makeGear(runId, random = Math.random) {
  const slot = random() < 0.5 ? "weapon" : "armor";
  const rarityRoll = random();
  const rarity = rarityRoll > 0.94 ? "epic" : rarityRoll > 0.70 ? "rare" : "common";
  const bonus = rarity === "epic" ? 5 : rarity === "rare" ? 3 : 1;
  const stat = slot === "weapon" ? "attack" : "defense";
  const names = slot === "weapon" ? ["青龍槍", "破陣刀", "穿雲弓"] : ["玄鐵甲", "虎紋戰袍", "藤牌護腕"];
  return {
    id: `${String(runId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 36)}-${Math.floor(random() * 1e9).toString(36)}`,
    name: names[Math.floor(random() * names.length)], slot, rarity, stat, value: bonus,
    speed: slot === "armor" && rarity === "epic" ? 1 : 0
  };
}

export function claimRun(profile, { runId, result, mapId = "forest", random = Math.random }) {
  if (!runId || profile.claimedRuns.includes(runId) || !["victory", "defeat"].includes(result)) return null;
  const gear = makeGear(runId, random);
  profile.claimedRuns.push(runId);
  profile.claimedRuns = profile.claimedRuns.slice(-80);
  profile.inventory.push(gear);
  profile.inventory = profile.inventory.slice(-60);
  const seals = result === "victory" ? 100 : 0;
  profile.seals += seals;
  if (result === "victory") {
    profile.completedRuns++;
    const mapIndex = MAP_ORDER.indexOf(mapId);
    if (mapIndex >= 0 && mapIndex < MAP_ORDER.length - 1) profile.unlockedMaps.push(MAP_ORDER[mapIndex + 1]);
    profile.unlockedMaps = [...new Set(profile.unlockedMaps)];
  }
  return { gear, seals, result };
}

export function equipGear(profile, gearId) {
  const item = profile.inventory.find(entry => entry.id === gearId);
  if (!item) return false;
  profile.equipped[item.slot] = item.id;
  return true;
}

export function equippedBonuses(profile) {
  const selected = Object.values(profile.equipped).filter(Boolean);
  const gear = profile.inventory.filter(item => selected.includes(item.id));
  return gear.reduce((total, item) => {
    if (item.stat === "attack") total.attack += item.value;
    if (item.stat === "defense") total.defense += item.value;
    total.speed += item.speed ?? 0;
    return total;
  }, { attack: 0, defense: 0, speed: 0 });
}

function validGear(item) {
  return item && typeof item.id === "string" && ["weapon", "armor"].includes(item.slot)
    && ["common", "rare", "epic"].includes(item.rarity)
    && ["attack", "defense"].includes(item.stat)
    && Number.isInteger(item.value) && item.value >= 1 && item.value <= 10;
}
function clampInt(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : 0;
}
