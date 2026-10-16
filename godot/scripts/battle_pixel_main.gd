extends "res://scripts/pixel_main.gd"

const FIELD_BASE := Color("#758370")
const FIELD_LIGHT := Color("#84907b")
const FIELD_DARK := Color("#687766")
const FIELD_STONE := Color("#a59b80")
const PIXEL_INK := Color("#29352f")
const PIXEL_PAPER := Color("#eee5d2")
const PIXEL_GOLD := Color("#cfb574")
const PIXEL_RED := Color("#b46f62")

func _draw_battlefield(size: Vector2) -> void:
	draw_rect(Rect2(Vector2.ZERO, size), FIELD_BASE)
	# Large, readable tile clusters keep the battlefield textured without visual noise.
	var tile_w := 72.0
	var tile_h := 56.0
	var ox := fposmod(player_pos.x * 0.18, tile_w)
	var oy := fposmod(player_pos.y * 0.18, tile_h)
	for row in range(-1, int(size.y / tile_h) + 2):
		for col in range(-1, int(size.x / tile_w) + 2):
			var x := float(col) * tile_w - ox
			var y := float(row) * tile_h - oy
			var key := posmod(col * 17 + row * 29, 7)
			if key == 0:
				_px(Rect2(Vector2(x + 12, y + 14), Vector2(20, 8)), FIELD_LIGHT, 4)
				_px(Rect2(Vector2(x + 48, y + 36), Vector2(12, 8)), FIELD_DARK, 4)
			elif key == 1:
				_px(Rect2(Vector2(x + 30, y + 8), Vector2(8, 8)), Color("#92947b"), 4)
				_px(Rect2(Vector2(x + 34, y + 16), Vector2(8, 4)), Color("#92947b"), 4)
			elif key == 2:
				_px(Rect2(Vector2(x + 8, y + 42), Vector2(16, 4)), Color("#9a987d"), 4)
				_px(Rect2(Vector2(x + 16, y + 38), Vector2(8, 4)), Color("#9a987d"), 4)
	# Broken flagstones form a path along the lower edge of the arena.
	var path_y := size.y * 0.76
	for i in range(-1, int(size.x / 104.0) + 2):
		var x := float(i) * 104.0 - fposmod(player_pos.x * 0.10, 104.0)
		var y := path_y + sin(float(i) * 1.6) * 7.0
		_px(Rect2(Vector2(x, y), Vector2(72, 28)), Color("#777664"), 4)
		_px(Rect2(Vector2(x + 4, y - 4), Vector2(64, 24)), FIELD_STONE, 4)
		_px(Rect2(Vector2(x + 12, y + 4), Vector2(24, 4)), Color("#b5aa8e"), 4)
		_px(Rect2(Vector2(x + 44, y + 12), Vector2(16, 4)), Color("#8e876f"), 4)
	# Low-contrast shrubs and boundary stones give the arena depth.
	for i in range(8):
		var x := fposmod(float(i) * 211.0 + 53.0 - player_pos.x * 0.08, size.x + 80.0) - 40.0
		var y := 132.0 + fposmod(float(i) * 97.0 + player_pos.y * 0.06, maxf(120.0, size.y - 190.0))
		_px(Rect2(Vector2(x, y), Vector2(28, 8)), Color("#566754"), 4)
		_px(Rect2(Vector2(x + 4, y - 8), Vector2(20, 8)), Color("#71866f"), 4)
		_px(Rect2(Vector2(x + 8, y - 12), Vector2(12, 4)), Color("#89957d"), 4)
	for i in range(6):
		var x := fposmod(float(i) * 263.0 + 170.0 - player_pos.x * 0.11, size.x + 40.0) - 20.0
		_px(Rect2(Vector2(x, size.y - 84.0), Vector2(20, 12)), Color("#756f60"), 4)
		_px(Rect2(Vector2(x + 4, size.y - 88.0), Vector2(12, 8)), Color("#a39a80"), 4)

func _draw_hero(pos: Vector2, scale: float, robe: Color, hair: Color, trim: Color, angle: float) -> void:
	var u := maxf(2.0, 3.0 * scale)
	var q := func(x: float, y: float, w: float, h: float, color: Color) -> void:
		_px(Rect2(pos + Vector2(x, y) * scale, Vector2(w, h) * scale), color, u)
	# Shadow, cape and boots.
	q.call(-20, 18, 40, 8, Color("#354137"))
	q.call(-18, -5, 36, 28, robe.darkened(0.28))
	q.call(-22, 9, 12, 22, robe.darkened(0.12))
	q.call(10, 9, 12, 22, robe.darkened(0.12))
	q.call(-14, 23, 11, 12, Color("#4a443b"))
	q.call(3, 23, 11, 12, Color("#4a443b"))
	q.call(-11, -10, 22, 29, robe)
	q.call(-15, -7, 5, 20, trim.darkened(0.12))
	q.call(10, -7, 5, 20, trim.darkened(0.12))
	# Lamellar armor in clearly separated pixel rows.
	q.call(-10, -3, 20, 12, Color("#594f43"))
	q.call(-9, -2, 18, 3, Color("#8d8067"))
	q.call(-9, 3, 18, 3, Color("#796b57"))
	q.call(-9, 8, 18, 3, Color("#a08b68"))
	q.call(-12, 12, 24, 4, trim.darkened(0.18))
	# Face, hair and crown.
	q.call(-9, -28, 18, 17, Color("#d7ad8d"))
	q.call(-11, -33, 22, 9, hair)
	q.call(-8, -37, 16, 6, hair.lightened(0.08))
	q.call(-8, -22, 3, 3, PIXEL_INK)
	q.call(5, -22, 3, 3, PIXEL_INK)
	q.call(-7, -40, 14, 4, trim)
	q.call(-4, -45, 8, 5, PIXEL_GOLD)
	q.call(-2, -44, 4, 3, Color("#819b85"))
	# Spear and a small pixel glint follow the facing angle.
	var facing := Vector2.RIGHT.rotated(angle)
	var spear_start := pos + Vector2(15, 7) * scale
	var spear_end := spear_start + facing * 43.0 * scale
	draw_line(spear_start + Vector2(2, 2) * scale, spear_end + Vector2(2, 2) * scale, Color("#403c34"), 5.0 * scale, false)
	draw_line(spear_start, spear_end, Color("#8c7553"), 3.0 * scale, false)
	_px(Rect2(spear_end - Vector2(3, 3) * scale, Vector2(7, 7) * scale), PIXEL_GOLD, u)

func _draw_enemy(enemy: Dictionary) -> void:
	var pos: Vector2 = enemy["pos"]
	var scale: float = float(enemy["scale"])
	var boss: bool = bool(enemy["boss"])
	var unit := maxf(2.0, 3.0 * scale)
	var body := Color("#66534b") if not boss else Color("#414743")
	var cloth := Color("#98745d") if not boss else Color("#78604f")
	var q := func(x: float, y: float, w: float, h: float, color: Color) -> void:
		_px(Rect2(pos + Vector2(x, y) * scale, Vector2(w, h) * scale), color, unit)
	q.call(-20, 15, 40, 8, Color("#394039"))
	q.call(-17, -4, 34, 28, body)
	q.call(-13, 1, 26, 10, cloth)
	q.call(-10, -23, 20, 20, Color("#bd9576"))
	q.call(-12, -29, 24, 10, Color("#494840"))
	q.call(-9, -32, 18, 5, Color("#5d584b"))
	q.call(-8, -18, 4, 3, PIXEL_RED)
	q.call(4, -18, 4, 3, PIXEL_RED)
	q.call(-17, -7, 7, 8, Color("#b69a70"))
	q.call(10, -7, 7, 8, Color("#b69a70"))
	if bool(enemy["ranged"]) and not boss:
		q.call(15, -2, 4, 23, Color("#433f36"))
		q.call(15, -5, 10, 4, Color("#c19a70"))
		q.call(15, 18, 10, 4, Color("#c19a70"))
	if boss:
		q.call(-24, -35, 11, 11, Color("#b76f62"))
		q.call(13, -35, 11, 11, Color("#b76f62"))
		q.call(-7, 5, 14, 5, PIXEL_GOLD)
	var bar_w := 50.0 * scale
	var bar_y := -43.0 * scale
	_px(Rect2(pos + Vector2(-bar_w * 0.5 - 3, bar_y - 3), Vector2(bar_w + 6, 11) * scale), PIXEL_INK, unit)
	_px(Rect2(pos + Vector2(-bar_w * 0.5, bar_y), Vector2(bar_w, 5) * scale), Color("#493c38"), unit)
	_px(Rect2(pos + Vector2(-bar_w * 0.5, bar_y), Vector2(bar_w * clampf(float(enemy["hp"]) / maxf(1.0, float(enemy["max_hp"])), 0.0, 1.0), 5) * scale), PIXEL_RED, unit)

func _draw_drop(pos: Vector2) -> void:
	_px(Rect2(pos + Vector2(-8, -8), Vector2(16, 16)), Color("#56644f"), 4)
	_px(Rect2(pos + Vector2(-4, -12), Vector2(8, 24)), Color("#adc09a"), 4)
	_px(Rect2(pos + Vector2(-12, -4), Vector2(24, 8)), Color("#adc09a"), 4)
	_px(Rect2(pos + Vector2(-4, -4), Vector2(8, 8)), Color("#e4d6aa"), 4)

func _draw_hud(size: Vector2) -> void:
	var compact := size.x < 720.0
	var bar_h := 94.0 if not compact else 86.0
	_px(Rect2(Vector2.ZERO, Vector2(size.x, bar_h)), Color("#283832"), 4)
	_px(Rect2(Vector2(0, bar_h - 4), Vector2(size.x, 4)), Color("#c2a76d"), 4)
	# Hero panel.
	var left_w := minf(340.0, size.x * 0.38)
	_px(Rect2(Vector2(12, 10), Vector2(left_w, bar_h - 20)), Color("#35483e"), 4)
	_px(Rect2(Vector2(16, 14), Vector2(5, bar_h - 28)), PIXEL_GOLD, 4)
	_pixel_text(Vector2(31, 36), "劉備", 24 if not compact else 20, PIXEL_PAPER)
	_pixel_text(Vector2(112, 34), "Lv.%d" % level, 18 if not compact else 16, Color("#d5c397"))
	_pixel_text(Vector2(31, 61), "%d / %d" % [int(hp), int(max_hp)], 16 if not compact else 14, PIXEL_PAPER)
	var hp_w := maxf(105.0, left_w - 139.0)
	_pixel_bar(Rect2(Vector2(126, 45), Vector2(hp_w, 17)), hp / maxf(1.0, max_hp), PIXEL_RED)
	# Large centered timer with hard pixel shadow.
	var timer := int(maxf(0.0, 360.0 - elapsed))
	var time_text := "%02d:%02d" % [timer / 60, timer % 60]
	_pixel_text(Vector2(size.x * 0.5 - 72, 43), time_text, 35 if not compact else 29, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, 144)
	_pixel_text(Vector2(size.x * 0.5 - 52, 67), "戰場計時", 13, Color("#cfbc91"), HORIZONTAL_ALIGNMENT_CENTER, 104)
	# Team indicators remain square and legible at phone widths.
	var team_x := size.x - 178.0 if size.x >= 720.0 else size.x - 114.0
	var team_w := size.x - team_x - 10.0
	_pixel_text(Vector2(team_x, 28), "隊伍 %d/6" % (remote_players.size() + 1), 17 if not compact else 14, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_LEFT, team_w)
	for i in range(mini(6, remote_players.size() + 1)):
		var x := team_x + float(i) * (20.0 if compact else 24.0)
		var active := true
		if i > 0:
			var player_id := str(remote_players[i - 1].get("id", ""))
			active = not _vital_is_out(player_id)
		_px(Rect2(Vector2(x, 48), Vector2(16, 16)), Color("#79927c") if active else Color("#775d56"), 4)
		_px(Rect2(Vector2(x + 4, 52), Vector2(8, 8)), Color("#e0d1b7"), 4)
		if i > 0:
			var player_id := str(remote_players[i - 1].get("id", ""))
			var vital: Dictionary = player_vitals.get(player_id, {})
			_pixel_bar(Rect2(Vector2(x, 67), Vector2(16, 7)), float(vital.get("hp", 0.0)) / maxf(1.0, float(vital.get("maxHp", 100.0))), PIXEL_RED)
	# XP becomes an unmistakable strip at the foot of the HUD.
	var xp_rect := Rect2(Vector2(20, bar_h - 11), Vector2(maxf(120.0, size.x - 40.0), 5))
	_px(xp_rect, Color("#515d50"), 4)
	_px(Rect2(xp_rect.position, Vector2(xp_rect.size.x * clampf(float(xp) / maxf(1.0, float(xp_goal)), 0.0, 1.0), xp_rect.size.y)), Color("#9bb58d"), 4)
	if boss_spawned and boss_hp > 0.0:
		var boss_rect := Rect2(Vector2(size.x * 0.30, bar_h + 14), Vector2(size.x * 0.40, 17))
		_px(Rect2(boss_rect.position - Vector2(5, 5), boss_rect.size + Vector2(10, 10)), PIXEL_INK, 4)
		_pixel_bar(boss_rect, boss_hp / 1600.0, PIXEL_RED)
		_pixel_text(Vector2(boss_rect.position.x, boss_rect.position.y - 7), "董卓", 17, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, boss_rect.size.x)

func _draw_bar(rect: Rect2, ratio: float, fill: Color) -> void:
	_pixel_bar(rect, ratio, fill)

func _pixel_bar(rect: Rect2, ratio: float, fill: Color) -> void:
	_px(Rect2(rect.position - Vector2(3, 3), rect.size + Vector2(6, 6)), PIXEL_INK, 4)
	_px(rect, Color("#51483e"), 4)
	var inner := Rect2(rect.position + Vector2(3, 3), Vector2(maxf(0.0, (rect.size.x - 6.0) * clampf(ratio, 0.0, 1.0)), maxf(2.0, rect.size.y - 6.0)))
	_px(inner, fill, 4)
	_px(Rect2(inner.position, Vector2(inner.size.x, minf(3.0, inner.size.y))), fill.lightened(0.18), 4)

func _pixel_text(pos: Vector2, label: String, font_size: int, color: Color, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT, width: float = -1.0) -> void:
	draw_string(UI_FONT, pos + Vector2(3, 3), label, align, width, font_size, Color("#1d2924"))
	draw_string(UI_FONT, pos + Vector2(1, 1), label, align, width, font_size, PIXEL_GOLD.darkened(0.38))
	draw_string(UI_FONT, pos, label, align, width, font_size, color)

func _px(rect: Rect2, color: Color, quantum: float = 4.0) -> void:
	var q := maxf(1.0, quantum)
	var x := floorf(rect.position.x / q) * q
	var y := floorf(rect.position.y / q) * q
	var right := ceilf(rect.end.x / q) * q
	var bottom := ceilf(rect.end.y / q) * q
	draw_rect(Rect2(Vector2(x, y), Vector2(maxf(q, right - x), maxf(q, bottom - y))), color)

func _draw_upgrade_overlay(size: Vector2) -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("#202a26", 0.86))
	var title_pos := Vector2(0, size.y * 0.37)
	_pixel_text(title_pos, "將星突破", 38 if size.x >= 720 else 30, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, size.x)
	var card_w := minf(260.0, size.x * 0.28)
	var gap := 18.0
	var total := card_w * 3.0 + gap * 2.0
	var left := (size.x - total) * 0.5
	for i in range(mini(3, upgrade_choices.size())):
		var rect := Rect2(Vector2(left + i * (card_w + gap), size.y * 0.51), Vector2(card_w, 150.0))
		_px(Rect2(rect.position + Vector2(0, 7), rect.size), Color("#131d19"), 4)
		_px(rect, Color("#d5ccb8"), 4)
		_px(Rect2(rect.position + Vector2(4, 4), rect.size - Vector2(8, 8)), Color("#e6dcc8"), 4)
		_px(Rect2(rect.position + Vector2(12, 12), Vector2(rect.size.x - 24, 4)), PIXEL_GOLD, 4)
		var emblem := rect.position + Vector2(card_w * 0.5 - 18, 28)
		_px(Rect2(emblem, Vector2(36, 36)), Color("#879680") if i != 1 else Color("#bd956d"), 4)
		_px(Rect2(emblem + Vector2(8, 8), Vector2(20, 20)), Color("#d8c69b"), 4)
		_pixel_text(rect.position + Vector2(0, 91), upgrade_choices[i], 21, PIXEL_INK, HORIZONTAL_ALIGNMENT_CENTER, card_w)
		_pixel_text(rect.position + Vector2(0, 123), "點擊選擇", 15, Color("#625e52"), HORIZONTAL_ALIGNMENT_CENTER, card_w)

func _draw_end(size: Vector2) -> void:
	_draw_battlefield(size)
	draw_rect(Rect2(Vector2.ZERO, size), Color("#202a26", 0.84))
	var title := "此戰告捷" if mode == "victory" else "隊伍潰散"
	_pixel_text(Vector2(0, size.y * 0.43), title, 44 if size.x >= 720 else 34, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, size.x)
	_pixel_text(Vector2(0, size.y * 0.52), "擊破 %d  ·  到達第 %d 級" % [kills, level], 22, Color("#d4c8b1"), HORIZONTAL_ALIGNMENT_CENTER, size.x)
	_draw_button(Rect2(size.x * 0.5 - 150, size.y * 0.63, 300, 64), "返回大廳", Color("#718478"))

