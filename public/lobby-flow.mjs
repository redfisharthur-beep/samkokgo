/** Website owns the lobby and settlement; Godot owns the battlefield. */
export const HANDOFF_PREFIX = "samkokgo-handoff-";
export const validRoomId = id => /^[0-9A-F]{8}$/.test(String(id ?? "").toUpperCase());
export const handoffKey = roomId => HANDOFF_PREFIX + String(roomId).toUpperCase();
export function godotBattlePath(roomId, heroId = "liubei") {
  if (!validRoomId(roomId)) throw new Error("Invalid room ID");
  const hero = ["liubei", "caocao", "sunquan", "lvbu"].includes(heroId) ? heroId : "liubei";
  return "/godot/?room=" + encodeURIComponent(String(roomId).toUpperCase()) + "&hero=" + encodeURIComponent(hero);
}
export const acceptedResult = value => ["victory", "defeat", "exit"].includes(value) ? value : null;
