// Shared recruit roster used by the browser UI and Cloudflare combat authority.
export const HERO_IDS = Object.freeze([
  "liubei", "caocao", "sunquan", "lvbu", "guanyu", "zhangfei",
  "zhaoyun", "zhugeliang", "huangzhong", "diaochan", "zhouyu", "zhangliao"
]);

export const HEROES = Object.freeze({
  liubei: { name: "劉備", faction: "蜀", title: "仁德之主", role: "support", pattern: "single", portrait: "liubei", tint: 0, color: 0x77877d, speed: 10.5, damage: 8, attackInterval: 0.85, range: 8, description: "長槍點刺，穩定照顧隊伍。" },
  caocao: { name: "曹操", faction: "魏", title: "亂世梟雄", role: "commander", pattern: "sweep", portrait: "caocao", tint: 8, color: 0x68766b, speed: 9.5, damage: 12, attackInterval: 1, range: 8.5, description: "揮劍震退身前敵軍。" },
  sunquan: { name: "孫權", faction: "吳", title: "江東霸主", role: "ranged", pattern: "volley", portrait: "sunquan", tint: 0, color: 0x8097a0, speed: 11, damage: 7, attackInterval: 0.6, range: 9, description: "連發三箭，覆蓋前方扇形區域。" },
  lvbu: { name: "呂布", faction: "群", title: "無雙戰神", role: "vanguard", pattern: "orbit", portrait: "lvbu", tint: 0, color: 0xb67b6d, speed: 9.5, damage: 16, attackInterval: 1.05, range: 6.5, description: "近身旋戟，重創周圍敵軍。" },
  guanyu: { name: "關羽", faction: "蜀", title: "武聖", role: "vanguard", pattern: "crescent", portrait: "lvbu", tint: 105, color: 0x9a7652, speed: 9.8, damage: 13, attackInterval: 0.95, range: 7.5, description: "青龍偃月刀斬出半月弧光。" },
  zhangfei: { name: "張飛", faction: "蜀", title: "萬人敵", role: "vanguard", pattern: "burst", portrait: "lvbu", tint: 165, color: 0x9a665d, speed: 9, damage: 19, attackInterval: 1.35, range: 5.8, description: "丈八蛇矛重擊，震傷目標周圍。" },
  zhaoyun: { name: "趙雲", faction: "蜀", title: "常勝將軍", role: "duelist", pattern: "pierce", portrait: "liubei", tint: 185, color: 0x8b9da5, speed: 12, damage: 10, attackInterval: 0.72, range: 11, description: "銀槍貫穿路徑上的敵人。" },
  zhugeliang: { name: "諸葛亮", faction: "蜀", title: "臥龍軍師", role: "caster", pattern: "fan", portrait: "caocao", tint: 130, color: 0x829280, speed: 9.2, damage: 9, attackInterval: 1.05, range: 13, description: "羽扇引風，遠距離扇形術擊。" },
  huangzhong: { name: "黃忠", faction: "蜀", title: "百步穿楊", role: "sniper", pattern: "sniper", portrait: "sunquan", tint: 35, color: 0xb19a6f, speed: 9, damage: 25, attackInterval: 1.55, range: 17, description: "蓄力狙擊，極遠距離重創單一目標。" },
  diaochan: { name: "貂蟬", faction: "群", title: "閉月之姿", role: "duelist", pattern: "whirl", portrait: "caocao", tint: 285, color: 0xa8889b, speed: 11.4, damage: 8, attackInterval: 0.68, range: 6.2, description: "雙刃追斬同一群聚敵人。" },
  zhouyu: { name: "周瑜", faction: "吳", title: "赤壁都督", role: "caster", pattern: "fireline", portrait: "sunquan", tint: 15, color: 0xb5795e, speed: 9.6, damage: 12, attackInterval: 1.1, range: 12, description: "烈焰沿直線席捲整排敵軍。" },
  zhangliao: { name: "張遼", faction: "魏", title: "威震逍遙津", role: "duelist", pattern: "chain", portrait: "caocao", tint: 220, color: 0x7e8394, speed: 11.2, damage: 10, attackInterval: 0.82, range: 9.5, description: "突擊連斬，最多追擊三名敵人。" }
});
