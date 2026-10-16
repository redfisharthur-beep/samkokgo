extends "res://scripts/main.gd"

const INK_DARK := Color("#283533")
const INK_MID := Color("#40504a")
const PARCHMENT := Color("#e8dfcd")
const PARCHMENT_LIGHT := Color("#f1eadb")
const MUTED_GOLD := Color("#c6a96d")
const BUTTON_GREEN := Color("#65796d")
const BUTTON_CLAY := Color("#927667")

func _draw_lobby(size: Vector2) -> void:
	# A layered dusk landscape replaces the flat lobby backdrop.
	for band in range(48):
		var t := float(band) / 47.0
		var tint := Color("#293836").lerp(Color("#b9ad94"), t)
		draw_rect(Rect2(0, size.y * float(band) / 48.0, size.x, size.y / 48.0 + 1.0), tint)
	var horizon := size.y * 0.69
	var sun_center := Vector2(size.x * 0.74, size.y * 0.37)
	draw_circle(sun_center, minf(size.y * 0.19, 150.0), Color("#cfb37c", 0.12))
	draw_circle(sun_center, minf(size.y * 0.145, 112.0), Color("#d7bd8d", 0.23))
	draw_circle(sun_center, minf(size.y * 0.105, 82.0), Color("#dfc99f", 0.45))
	_draw_ridge(size, horizon, 0.48, Color("#77857a", 0.56), 0.15)
	_draw_ridge(size, horizon, 0.60, Color("#5e7068", 0.73), 0.24)
	_draw_ridge(size, horizon, 0.72, Color("#43564e", 0.9), 0.33)
	_draw_gate(size, Vector2(size.x * 0.1, horizon + 12.0), 0.82)
	_draw_gate(size, Vector2(size.x * 0.88, horizon + 20.0), 0.58)
	# Foreground mist and a broad stone causeway.
	draw_rect(Rect2(0, horizon + 50.0, size.x, size.y - horizon - 50.0), Color("#394c44", 0.88))
	draw_colored_polygon(PackedVector2Array([
		Vector2(size.x * 0.31, size.y), Vector2(size.x * 0.44, horizon + 45.0),
		Vector2(size.x * 0.57, horizon + 45.0), Vector2(size.x * 0.72, size.y)
	]), Color("#a99d83", 0.24))
	for i in range(11):
		var y := horizon + 74.0 + i * 28.0
		if y < size.y:
			draw_line(Vector2(size.x * 0.39, y), Vector2(size.x * 0.63, y), Color("#d0c09c", 0.12), 1.0, true)
	# Floating embers and mist strokes add movement without bright flashes.
	for i in range(24):
		var px := fposmod(float(i * 173 + 61), size.x)
		var py := horizon + fposmod(float(i * 83 + 29), maxf(1.0, size.y - horizon))
		var radius := 1.0 + float(i % 3) * 0.45
		draw_circle(Vector2(px, py), radius, Color("#d9bc82", 0.26 if i % 2 == 0 else 0.15))
	for i in range(5):
		var mist_y := horizon + 25.0 + i * 37.0
		draw_line(Vector2(0, mist_y), Vector2(size.x, mist_y + sin(float(i)) * 8.0), Color("#e5dcc8", 0.07), 7.0, true)

	var center := size * 0.5
	# Framed parchment title panel, styled like a campaign map.
	var panel := Rect2(center.x - 276.0, center.y - 261.0, 552.0, 430.0)
	_draw_panel(panel)
	draw_circle(center + Vector2(0, -202), 35.0, Color("#6b7c70"))
	draw_circle(center + Vector2(0, -202), 30.0, Color("#c6a96d"))
	draw_arc(center + Vector2(0, -202), 24.0, 0.0, TAU, 40, Color("#efe5ce", 0.9), 1.5, true)
	draw_string(UI_FONT, center + Vector2(-20, -194), "漢", HORIZONTAL_ALIGNMENT_CENTER, 40.0, 25, INK_DARK)
	draw_string(UI_FONT, center + Vector2(-220, -142), "三 國 同 征", HORIZONTAL_ALIGNMENT_CENTER, 440.0, 39, PARCHMENT_LIGHT)
	draw_string(UI_FONT, center + Vector2(-220, -110), "群雄割據  ·  合縱共戰", HORIZONTAL_ALIGNMENT_CENTER, 440.0, 16, Color("#d2c4a8"))
	draw_line(center + Vector2(-78, -91), center + Vector2(78, -91), Color("#c6a96d", 0.72), 1.0, true)

	# Keep the existing click zones intact while giving the controls a richer finish.
	_draw_button(Rect2(center + Vector2(-180, -70), Vector2(360, 58)), "快速加入", BUTTON_GREEN)
	_draw_button(Rect2(center + Vector2(-180, 2), Vector2(360, 58)), "建立房間", Color("#786f60"))
	_draw_button(Rect2(center + Vector2(-130, 82), Vector2(260, 54)), "開始試玩", BUTTON_CLAY)
	draw_string(UI_FONT, center + Vector2(-250, 157), status_text, HORIZONTAL_ALIGNMENT_CENTER, 500.0, 15, Color("#534f45"))
	if not room_id.is_empty():
		draw_string(UI_FONT, center + Vector2(-100, 184), "房間  " + room_id, HORIZONTAL_ALIGNMENT_CENTER, 200.0, 14, Color("#5b655a"))
	# A compact visual footer replaces the tiny edge instruction.
	var footer := Rect2(center.x - 198.0, size.y - 49.0, 396.0, 30.0)
	_draw_pill(footer, Color("#263632", 0.72))
	draw_string(UI_FONT, footer.position + Vector2(0, 20), "六人協作    ·    一局六分鐘    ·    WASD / 任意處觸控移動", HORIZONTAL_ALIGNMENT_CENTER, footer.size.x, 12, PARCHMENT_LIGHT)

func _draw_ridge(size: Vector2, horizon: float, height_ratio: float, color: Color, sway: float) -> void:
	var base := horizon + size.y * 0.08
	var peak_a := size.x * (0.16 + sway * 0.22)
	var peak_b := size.x * (0.48 + sway * 0.1)
	var peak_c := size.x * (0.78 - sway * 0.16)
	var points := PackedVector2Array([
		Vector2(0, base), Vector2(peak_a, base - size.y * height_ratio * 0.35),
		Vector2(peak_b, base - size.y * height_ratio), Vector2(peak_c, base - size.y * height_ratio * 0.53),
		Vector2(size.x, base), Vector2(size.x, size.y), Vector2(0, size.y)
	])
	draw_colored_polygon(points, color)

func _draw_gate(size: Vector2, anchor: Vector2, scale: float) -> void:
	var width := 118.0 * scale
	var height := 98.0 * scale
	var stone := Color("#273632", 0.86)
	var roof := Color("#202e2c", 0.95)
	draw_rect(Rect2(anchor.x - width * 0.5, anchor.y - height, width, height), stone)
	draw_rect(Rect2(anchor.x - width * 0.72, anchor.y - height - 12.0 * scale, width * 1.44, 15.0 * scale), roof)
	draw_colored_polygon(PackedVector2Array([
		anchor + Vector2(-width * 0.8, -height - 12.0 * scale),
		anchor + Vector2(0, -height - 37.0 * scale),
		anchor + Vector2(width * 0.8, -height - 12.0 * scale)
	]), roof)
	draw_rect(Rect2(anchor.x - width * 0.28, anchor.y - height * 0.7, width * 0.56, height * 0.7), Color("#a28e6e", 0.38))
	draw_line(anchor + Vector2(0, -height - 35.0 * scale), anchor + Vector2(0, -height - 70.0 * scale), MUTED_GOLD, 2.0 * scale, true)
	draw_colored_polygon(PackedVector2Array([
		anchor + Vector2(1, -height - 68.0 * scale),
		anchor + Vector2(43.0 * scale, -height - 57.0 * scale),
		anchor + Vector2(1, -height - 43.0 * scale)
	]), Color("#a97867", 0.82))

func _draw_panel(rect: Rect2) -> void:
	draw_rect(Rect2(rect.position + Vector2(0, 8), rect.size), Color("#172522", 0.28))
	draw_rect(rect, Color("#e8dfcd", 0.94))
	draw_rect(Rect2(rect.position + Vector2(8, 8), rect.size - Vector2(16, 16)), Color("#f1eadb", 0.97))
	draw_rect(Rect2(rect.position + Vector2(14, 14), rect.size - Vector2(28, 28)), Color("#d2c4a8", 0.34), false, 1.0)
	for corner in [
		Vector2(rect.position.x + 22, rect.position.y + 22),
		Vector2(rect.end.x - 22, rect.position.y + 22),
		Vector2(rect.position.x + 22, rect.end.y - 22),
		Vector2(rect.end.x - 22, rect.end.y - 22)
	]:
		draw_circle(corner, 3.0, MUTED_GOLD)

func _draw_button(rect: Rect2, text: String, fill: Color) -> void:
	_draw_pill(Rect2(rect.position + Vector2(0, 5), rect.size), Color("#252a25", 0.3))
	_draw_pill(rect, fill)
	var center_y := rect.position.y + rect.size.y * 0.5
	draw_circle(Vector2(rect.position.x + 30.0, center_y), 12.0, Color("#f1eadb", 0.16))
	if text == "快速加入":
		draw_line(Vector2(rect.position.x + 24.0, center_y + 1.0), Vector2(rect.position.x + 36.0, center_y + 1.0), PARCHMENT_LIGHT, 2.0, true)
		draw_colored_polygon(PackedVector2Array([
			Vector2(rect.position.x + 35.0, center_y - 5.0),
			Vector2(rect.position.x + 42.0, center_y + 1.0),
			Vector2(rect.position.x + 35.0, center_y + 7.0)
		]), PARCHMENT_LIGHT)
	elif text == "建立房間":
		draw_rect(Rect2(rect.position.x + 25.0, center_y - 7.0, 13.0, 14.0), Color("#f1eadb", 0.9), false, 1.6)
		draw_line(Vector2(rect.position.x + 28.0, center_y - 2.0), Vector2(rect.position.x + 35.0, center_y - 2.0), PARCHMENT_LIGHT, 1.0)
		draw_line(Vector2(rect.position.x + 28.0, center_y + 2.0), Vector2(rect.position.x + 35.0, center_y + 2.0), PARCHMENT_LIGHT, 1.0)
	else:
		draw_circle(Vector2(rect.position.x + 31.0, center_y), 4.0, PARCHMENT_LIGHT)
	draw_string(UI_FONT, rect.position + Vector2(0, rect.size.y * 0.5 + 7.0), text, HORIZONTAL_ALIGNMENT_CENTER, rect.size.x, 20, PARCHMENT_LIGHT)

func _draw_pill(rect: Rect2, fill: Color) -> void:
	var radius := rect.size.y * 0.5
	draw_rect(Rect2(rect.position.x + radius, rect.position.y, rect.size.x - radius * 2.0, rect.size.y), fill)
	draw_circle(Vector2(rect.position.x + radius, rect.position.y + radius), radius, fill)
	draw_circle(Vector2(rect.end.x - radius, rect.position.y + radius), radius, fill)
