/** Website owns the lobby and settlement; Godot owns the battlefield. */
export const HANDOFF_PREFIX = "samkokgo-handoff-";
export const validRoomId = id => /^[0-9A-F]{8}$/.test(String(id ?? "").toUpperCase());
export const handoffKey = roomId => HANDOFF_PREFIX + String(roomId).toUpperCase();
export function godotBattlePath(roomId, heroId = "liubei", bonuses = {}, mapId = "forest") {
  if (!validRoomId(roomId)) throw new Error("Invalid room ID");
  const hero = ["liubei", "caocao", "sunquan", "lvbu"].includes(heroId) ? heroId : "liubei";
  const params = new URLSearchParams({
    room: String(roomId).toUpperCase(), hero,
    atk: String(Math.max(0, Math.min(15, Math.floor(bonuses.attack ?? 0)))),
    def: String(Math.max(0, Math.min(15, Math.floor(bonuses.defense ?? 0)))),
    spd: String(Math.max(0, Math.min(3, Math.floor(bonuses.speed ?? 0)))),
    map: ["forest", "camp", "city"].includes(mapId) ? mapId : "forest"
  });
  return "/godot/?" + params.toString();
}
export const acceptedResult = value => ["victory", "defeat", "exit"].includes(value) ? value : null;
