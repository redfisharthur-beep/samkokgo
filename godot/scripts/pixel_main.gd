extends "res://scripts/interactive_main.gd"

const LOBBY_BG: Texture2D = preload("res://assets/lobby-pixel.webp")
const UI_GOLD := Color("#c6a96d")
const UI_PAPER := Color("#eee5d2")

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	super._ready()

func _draw_lobby(size: Vector2) -> void:
	draw_texture_rect(LOBBY_BG, Rect2(Vector2.ZERO, size), false)
	draw_rect(Rect2(Vector2.ZERO, size), Color("#25342f", 0.19))
	var center := size * 0.5
	var panel := Rect2(center.x - 286.0, center.y - 245.0, 572.0, 420.0)
	# Pixel-edged translucent campaign panel keeps the art visible behind the menu.
	draw_rect(Rect2(panel.position + Vector2(0, 7), panel.size), Color("#172522", 0.42))
	draw_rect(panel, Color("#263832", 0.82))
	draw_rect(Rect2(panel.position + Vector2(5, 5), panel.size - Vector2(10, 10)), Color("#e7dfcc", 0.08), false, 2.0)
	draw_rect(Rect2(panel.position + Vector2(12, 12), Vector2(panel.size.x - 24, 2)), Color("#d4b777", 0.76))
	# Small seal and title.
	draw_rect(Rect2(center + Vector2(-20, -213), Vector2(40, 40)), Color("#c6a96d"))
	draw_rect(Rect2(center + Vector2(-15, -208), Vector2(30, 30)), Color("#31443c"))
	draw_string(UI_FONT, center + Vector2(-13, -186), "漢", HORIZONTAL_ALIGNMENT_CENTER, 26.0, 20, UI_PAPER)
	draw_string(UI_FONT, center + Vector2(-240, -136), "三國同征", HORIZONTAL_ALIGNMENT_CENTER, 480.0, 40, UI_PAPER)
	draw_string(UI_FONT, center + Vector2(-240, -105), "群雄集結  ·  並肩迎戰", HORIZONTAL_ALIGNMENT_CENTER, 480.0, 16, Color("#d9c99f"))
	draw_rect(Rect2(center + Vector2(-68, -91), Vector2(136, 2)), UI_GOLD)
	_draw_button(Rect2(center + Vector2(-180, -70), Vector2(360, 58)), "快速加入", Color("#718478"))
	_draw_button(Rect2(center + Vector2(-180, 2), Vector2(360, 58)), "建立房間", Color("#756f60"))
	_draw_button(Rect2(center + Vector2(-130, 82), Vector2(260, 54)), "開始試玩", Color("#956e60"))
	draw_string(UI_FONT, center + Vector2(-250, 157), status_text, HORIZONTAL_ALIGNMENT_CENTER, 500.0, 15, UI_PAPER)
	if not room_id.is_empty():
		draw_string(UI_FONT, center + Vector2(-100, 183), "房間  " + room_id, HORIZONTAL_ALIGNMENT_CENTER, 200.0, 14, UI_PAPER)
	var footer := Rect2(center.x - 200.0, size.y - 48.0, 400.0, 28.0)
	draw_rect(footer, Color("#263832", 0.74))
	draw_rect(footer, Color("#c6a96d", 0.5), false, 1.0)
	draw_string(UI_FONT, footer.position + Vector2(0, 19), "六人合作  ·  一場六分鐘  ·  WASD / 任意位置觸控移動", HORIZONTAL_ALIGNMENT_CENTER, footer.size.x, 12, UI_PAPER)

func _draw_button(rect: Rect2, label: String, fill: Color) -> void:
	draw_rect(Rect2(rect.position + Vector2(0, 5), rect.size), Color("#171f1c", 0.62))
	draw_rect(rect, fill)
	draw_rect(Rect2(rect.position + Vector2(3, 3), Vector2(rect.size.x - 6, 3)), Color("#eee5d2", 0.32))
	draw_rect(rect, Color("#d5c39b", 0.82), false, 2.0)
	# A compact pixel emblem gives each action a clear visual anchor.
	var emblem := rect.position + Vector2(22, rect.size.y * 0.5 - 9)
	draw_rect(Rect2(emblem, Vector2(6, 18)), Color("#efe5d2"))
	draw_rect(Rect2(emblem + Vector2(6, 6), Vector2(12, 6)), Color("#efe5d2"))
	draw_rect(Rect2(emblem + Vector2(12, 1), Vector2(5, 4)), UI_GOLD)
	draw_string(UI_FONT, rect.position + Vector2(0, rect.size.y * 0.5 + 7), label, HORIZONTAL_ALIGNMENT_CENTER, rect.size.x, 20, UI_PAPER)
