extends "res://scripts/pixel_main.gd"

const FIELD_BASE := Color("#758370")
const FIELD_LIGHT := Color("#84907b")
const FIELD_DARK := Color("#687766")
const FIELD_STONE := Color("#a59b80")
const PIXEL_INK := Color("#29352f")
const PIXEL_PAPER := Color("#eee5d2")
const PIXEL_GOLD := Color("#cfb574")
const PIXEL_RED := Color("#b46f62")
const BATTLEFIELD_BG: Texture2D = preload("res://assets/battlefield-pixel.webp")

func _draw_battlefield(size: Vector2) -> void:
	draw_texture_rect(BATTLEFIELD_BG, Rect2(Vector2.ZERO, size), false)
	# A soft dusk wash keeps the detailed ground art calm beneath combat effects.
	draw_rect(Rect2(Vector2.ZERO, size), Color("#24332c", 0.10))

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

func _draw_drop(pos: Vector2, kind: String = "energy") -> void:
	var treasure := kind == "treasure"
	var main_color := Color("#d5a94f") if treasure else Color("#adc09a")
	var center_color := Color("#fff0a2") if treasure else Color("#e4d6aa")
	_px(Rect2(pos + Vector2(-8, -8), Vector2(16, 16)), Color("#56644f"), 4)
	_px(Rect2(pos + Vector2(-4, -12), Vector2(8, 24)), main_color, 4)
	_px(Rect2(pos + Vector2(-12, -4), Vector2(24, 8)), main_color, 4)
	_px(Rect2(pos + Vector2(-4, -4), Vector2(8, 8)), center_color, 4)

func _draw_hud(size: Vector2) -> void:
	var compact := size.x < 720.0
	var bar_h := 94.0 if not compact else 84.0
	_frame_panel(Rect2(Vector2(8, 7), Vector2(size.x - 16, bar_h - 11)), Color("#293932"))
	if compact:
		# Compact phone layout keeps the timer, hero and team apart.
		_px(Rect2(Vector2(18, 16), Vector2(30, 30)), Color("#786746"), 4)
		_px(Rect2(Vector2(22, 20), Vector2(22, 22)), Color("#82927d"), 4)
		_px(Rect2(Vector2(26, 22), Vector2(14, 11)), Color("#d8b38e"), 4)
		_px(Rect2(Vector2(24, 20), Vector2(18, 6)), Color("#393c35"), 4)
		_pixel_text(Vector2(55, 34), str({"liubei":"劉備","caocao":"曹操","sunquan":"孫權","lvbu":"呂布"}.get(selected_hero_id, "劉備")), 19, PIXEL_PAPER)
		var timer := int(maxf(0.0, 360.0 - elapsed))
		_pixel_text(Vector2(size.x * 0.5 - 49, 35), "%02d:%02d" % [timer / 60, timer % 60], 25, PIXEL_GOLD, HORIZONTAL_ALIGNMENT_CENTER, 98)
		_px(Rect2(Vector2(size.x - 48, 19), Vector2(24, 24)), Color("#728878"), 4)
		_px(Rect2(Vector2(size.x - 42, 25), Vector2(12, 12)), Color("#ead9b4"), 4)
		_pixel_text(Vector2(size.x - 91, 37), "%d/6" % (remote_players.size() + 1), 14, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_RIGHT, 38)
		_pixel_text(Vector2(23, 57), "%d/%d" % [int(hp), int(max_hp)], 13, PIXEL_PAPER)
		_pixel_bar(Rect2(Vector2(86, 49), Vector2(maxf(70.0, size.x - 111.0), 13)), hp / maxf(1.0, max_hp), PIXEL_RED)
		_px(Rect2(Vector2(20, 72), Vector2(size.x - 40, 4)), Color("#53624f"), 4)
		_px(Rect2(Vector2(20, 72), Vector2((size.x - 40) * clampf(float(xp) / maxf(1.0, float(xp_goal)), 0.0, 1.0), 4)), Color("#a6bd91"), 4)
	else:
		var left_w := minf(354.0, size.x * 0.32)
		var right_w := minf(204.0, size.x * 0.19)
		var left_rect := Rect2(Vector2(16, 15), Vector2(left_w, bar_h - 28))
		var right_rect := Rect2(Vector2(size.x - right_w - 16, 15), Vector2(right_w, bar_h - 28))
		_frame_panel(left_rect, Color("#35483e"))
		_frame_panel(right_rect, Color("#35483e"))
		# A compact portrait tile anchors the player status block.
		_px(Rect2(left_rect.position + Vector2(9, 7), Vector2(48, 50)), Color("#c3a368"), 4)
		_px(Rect2(left_rect.position + Vector2(13, 11), Vector2(40, 42)), Color("#718575"), 4)
		_px(Rect2(left_rect.position + Vector2(18, 13), Vector2(30, 17)), Color("#3b4038"), 4)
		_px(Rect2(left_rect.position + Vector2(20, 22), Vector2(26, 20)), Color("#d7b18e"), 4)
		_px(Rect2(left_rect.position + Vector2(17, 38), Vector2(32, 11)), Color("#695847"), 4)
		_px(Rect2(left_rect.position + Vector2(24, 40), Vector2(18, 5)), Color("#a58a60"), 4)
		var tx := left_rect.position.x + 68.0
		_pixel_text(Vector2(tx, 37), str({"liubei":"劉備","caocao":"曹操","sunquan":"孫權","lvbu":"呂布"}.get(selected_hero_id, "劉備")), 23, PIXEL_PAPER)
		_pixel_text(Vector2(tx + 77, 36), "Lv.%d" % level, 16, Color("#d8c397"))
		_pixel_text(Vector2(tx, 58), "%d / %d" % [int(hp), int(max_hp)], 14, PIXEL_PAPER)
		_pixel_bar(Rect2(Vector2(tx, 64), Vector2(left_rect.size.x - 81, 10)), hp / maxf(1.0, max_hp), PIXEL_RED)
		# Center timer sits in its own framed plaque.
		var timer := int(maxf(0.0, 360.0 - elapsed))
		var clock_rect := Rect2(Vector2(size.x * 0.5 - 79, 15), Vector2(158, bar_h - 28))
		_frame_panel(clock_rect, Color("#35483e"))
		_pixel_text(Vector2(clock_rect.position.x, 47), "%02d:%02d" % [timer / 60, timer % 60], 33, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, clock_rect.size.x)
		_pixel_text(Vector2(clock_rect.position.x, 67), "戰場計時", 13, Color("#cfbc91"), HORIZONTAL_ALIGNMENT_CENTER, clock_rect.size.x)
		_pixel_text(Vector2(right_rect.position.x + 12, 35), "隊伍", 17, PIXEL_PAPER)
		_pixel_text(Vector2(right_rect.position.x + right_rect.size.x - 58, 35), "%d / 6" % (remote_players.size() + 1), 15, Color("#d8c397"), HORIZONTAL_ALIGNMENT_RIGHT, 48)
		for i in range(6):
			var x := right_rect.position.x + 12.0 + float(i) * 27.0
			var present := i <= remote_players.size()
			var active := present
			if i > 0 and present:
				active = not _vital_is_out(str(remote_players[i - 1].get("id", "")))
			_px(Rect2(Vector2(x, 47), Vector2(20, 20)), Color("#748a77") if active else Color("#554f47"), 4)
			_px(Rect2(Vector2(x + 5, 51), Vector2(10, 7)), Color("#e1d0ae") if present else Color("#746d5e"), 4)
			if i > 0 and present:
				var player_id := str(remote_players[i - 1].get("id", ""))
				var vital: Dictionary = player_vitals.get(player_id, {})
				_pixel_bar(Rect2(Vector2(x + 1, 69), Vector2(18, 4)), float(vital.get("hp", 0.0)) / maxf(1.0, float(vital.get("maxHp", 100.0))), PIXEL_RED)
		# Experience strip uses the full header width with a brighter fill.
		var xp_rect := Rect2(Vector2(22, bar_h - 12), Vector2(size.x - 44, 4))
		_px(xp_rect, Color("#596651"), 4)
		_px(Rect2(xp_rect.position, Vector2(xp_rect.size.x * clampf(float(xp) / maxf(1.0, float(xp_goal)), 0.0, 1.0), xp_rect.size.y)), Color("#a6bd91"), 4)
	if boss_spawned and boss_hp > 0.0:
		var boss_rect := Rect2(Vector2(size.x * 0.30, bar_h + 16), Vector2(size.x * 0.40, 17))
		_frame_panel(Rect2(boss_rect.position - Vector2(8, 21), boss_rect.size + Vector2(16, 30)), Color("#382f2b"))
		_pixel_text(Vector2(boss_rect.position.x, boss_rect.position.y - 5), "董卓", 17, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, boss_rect.size.x)
		_pixel_bar(boss_rect, boss_hp / maxf(1.0, boss_max_hp), PIXEL_RED)


	if crossplay_mode:
		var ability_position := Vector2(size.x - 90.0, size.y - 90.0)
		var available := ability_ready_at <= Time.get_unix_time_from_system() * 1000.0
		_draw_ability_button(ability_position, available)

func _draw_ability_button(center: Vector2, available: bool) -> void:
	draw_circle(center + Vector2(0, 4), 44.0, Color("#17211d", 0.82))
	draw_circle(center, 42.0, PIXEL_GOLD if available else Color("#82745a"))
	draw_circle(center, 36.0, Color("#202c26"))
	draw_circle(center, 31.0, Color("#536d5a") if available else Color("#37443d"))
	draw_arc(center, 31.0, PI, TAU, 16, Color("#f3dfa9", 0.72), 2.0, true)
	_pixel_text(center + Vector2(-35, 7), "絕技" if available else "冷卻", 18, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, 70.0)
	_pixel_text(center + Vector2(-43, 55), "SPACE / 點擊", 11, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, 86.0)

func _draw_control_guide(size: Vector2) -> void:
	var compact := size.x < 720.0
	var guide_w := minf(302.0, size.x * 0.52)
	var guide_h := 48.0 if not compact else 42.0
	var rect := Rect2(Vector2(14, size.y - guide_h - 14), Vector2(guide_w, guide_h))
	_frame_panel(rect, Color("#334238"))
	var primary := "拖曳任意位置移動" if compact else "WASD / 方向鍵　·　拖曳移動"
	var secondary := "自動攻擊　·　點擊右下絕技"
	_pixel_text(rect.position + Vector2(12, 24), primary, 13 if compact else 14, PIXEL_PAPER)
	_pixel_text(rect.position + Vector2(12, 40), secondary, 11, Color("#d9c99f"))
func _frame_panel(rect: Rect2, fill: Color) -> void:
	# Layered pixel edging echoes the lobby frame and keeps text readable.
	_px(Rect2(rect.position + Vector2(0, 4), rect.size), Color("#17211d"), 4)
	_px(rect, Color("#bba46f"), 4)
	_px(Rect2(rect.position + Vector2(4, 4), rect.size - Vector2(8, 8)), Color("#26342e"), 4)
	_px(Rect2(rect.position + Vector2(8, 8), rect.size - Vector2(16, 16)), fill, 4)
	_px(Rect2(rect.position + Vector2(12, 8), Vector2(maxf(0.0, rect.size.x - 24), 3)), Color("#e3d2a2", 0.7), 4)
	for corner in [Vector2.ZERO, Vector2(rect.size.x - 8, 0), Vector2(0, rect.size.y - 8), rect.size - Vector2(8, 8)]:
		_px(Rect2(rect.position + corner, Vector2(8, 8)), Color("#dec387"), 4)
		_px(Rect2(rect.position + corner + Vector2(2, 2), Vector2(4, 4)), Color("#574b3b"), 4)

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

