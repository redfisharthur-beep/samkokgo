extends "res://scripts/battle_pixel_main.gd"
## New rendering entry point: website owns lobby; Godot owns pixel-art combat.
## Inherit networking/authority/controls without touching the Cloudflare protocol.

const PIXEL_WORLD: PackedScene = preload("res://scenes/battle/pixel_world.tscn")
var pixel_world: Node2D

func _ready() -> void:
	super._ready()
	pixel_world = PIXEL_WORLD.instantiate()
	pixel_world.name = "IsometricBattleWorld"
	pixel_world.show_behind_parent = true
	add_child(pixel_world)
	pixel_world.call("configure_map", current_map_id)
	pixel_world.visible = mode == "battle"

func _process(delta: float) -> void:
	super._process(delta)
	if pixel_world == null:
		return
	pixel_world.visible = mode == "battle"
	if mode == "battle":
		pixel_world.call("configure_map", current_map_id)
		pixel_world.refresh(self, delta)

func _draw_battlefield(size: Vector2) -> void:
	# The isometric world supplies the battle backdrop. Drawing the legacy
	# battlefield-pixel image here at the same time created a double exposure.
	if mode == "battle" and pixel_world != null:
		return
	super._draw_battlefield(size)

func _draw_battle(size: Vector2) -> void:
	# All ground, props, players, enemies and hit sparks are drawn by real
	# TileMapLayer / Sprite2D / AnimatedSprite2D children behind the HUD.
	_draw_hud(size)
	if crossplay_mode:
		var dash_rect := Rect2(Vector2(size.x - 250.0, size.y - 139.0), Vector2(92.0, 82.0))
		var dash_wait := maxf(0.0, dash_ready_at - Time.get_unix_time_from_system() * 1000.0) / 1000.0
		_frame_panel(dash_rect, Color("#416d5e") if dash_wait <= 0.0 else Color("#514943"))
		_pixel_text(dash_rect.position + Vector2(0, 34), "閃身", 20, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, dash_rect.size.x)
		_pixel_text(dash_rect.position + Vector2(0, 58), "SHIFT" if dash_wait <= 0.0 else "%.1f 秒" % dash_wait, 12, PIXEL_GOLD, HORIZONTAL_ALIGNMENT_CENTER, dash_rect.size.x)
	_draw_control_guide(size)
	if OS.has_feature("web") and crossplay_mode:
		_frame_panel(Rect2(Vector2(12, 100), Vector2(132, 48)), Color("#293932"))
		_pixel_text(Vector2(20, 129), "返回大廳", 18, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, 116)
	if moving_touch >= 0:
		draw_arc(move_origin, 42.0, 0.0, TAU, 32, Color("#e9dcb2", 0.65), 3.0, false)
		draw_circle(move_origin + move_vector * 34.0, 17.0, Color("#799488", 0.55))
	if not upgrade_choices.is_empty():
		_draw_upgrade_overlay(size)

# Battle HUD V2: premium pixel RPG red/gold plaques, gameplay-safe layout.
# The original button hit areas (return, ability, upgrades) are unchanged.
func _draw_hud(size: Vector2) -> void:
	var compact: bool = size.x < 760.0
	var top_height: float = 94.0 if compact else 106.0
	var accent := Color("#f2c878")
	var cream := Color("#fff0cb")
	var blood := Color("#ca5650")
	var xp_color := Color("#8fcbad")
	var base := Color("#38271f")
	var gilt := Color("#b58243")
	# Deep walnut band and stepped gold keylines echo the title-screen plaques.
	draw_rect(Rect2(Vector2(0, 0), Vector2(size.x, top_height)), Color("#211915", 0.97))
	draw_rect(Rect2(Vector2(0, top_height - 6), Vector2(size.x, 4)), gilt)
	draw_rect(Rect2(Vector2(0, top_height - 2), Vector2(size.x, 2)), accent)
	draw_rect(Rect2(Vector2(16, 12), Vector2(4, top_height - 24)), accent)
	draw_rect(Rect2(Vector2(size.x - 20, 12), Vector2(4, top_height - 24)), accent)
	var hero_names := {"liubei":"劉備","caocao":"曹操","sunquan":"孫權","lvbu":"呂布","guanyu":"關羽","zhangfei":"張飛","zhaoyun":"趙雲","zhugeliang":"諸葛亮","huangzhong":"黃忠","diaochan":"貂蟬","zhouyu":"周瑜","zhangliao":"張遼"}
	var hero_name: String = str(hero_names.get(selected_hero_id, "劉備"))
	var left_w: float = minf(340.0, size.x * 0.33)
	var panel_left := Rect2(Vector2(24, 12), Vector2(left_w, top_height - 26))
	_frame_panel(panel_left, base)
	_pixel_text(Vector2(34, 41), hero_name, 23 if not compact else 17, cream)
	_pixel_text(Vector2(113 if not compact else 90, 40), "Lv.%d" % level, 17 if not compact else 13, accent)
	var meter_left: float = 33.0
	var meter_width: float = maxf(75.0, left_w - 25.0)
	_pixel_bar(Rect2(Vector2(meter_left, 51), Vector2(meter_width, 14 if not compact else 11)), hp / maxf(1.0, max_hp), blood)
	_pixel_text(Vector2(meter_left + 4, 63), "%d / %d" % [int(hp), int(max_hp)], 11, cream)
	_pixel_bar(Rect2(Vector2(meter_left, 75), Vector2(meter_width, 8)), float(xp) / maxf(1.0, float(xp_goal)), xp_color)
	var minutes: int = int(maxf(0.0, 360.0 - elapsed))
	var clock_text: String = "%02d:%02d" % [minutes / 60, minutes % 60]
	var clock_w: float = 153.0 if not compact else 124.0
	var clock_rect := Rect2(Vector2(size.x * 0.5 - clock_w * 0.5, 15), Vector2(clock_w, top_height - 30))
	_frame_panel(clock_rect, Color("#493027"))
	_pixel_text(Vector2(clock_rect.position.x, 52), clock_text, 31 if not compact else 24, cream, HORIZONTAL_ALIGNMENT_CENTER, clock_w)
	var map_names := {"forest":"山林戰場", "camp":"軍營戰場", "city":"城池戰場"}
	_pixel_text(Vector2(clock_rect.position.x, 72), str(map_names.get(current_map_id, "戰場計時")), 13, accent, HORIZONTAL_ALIGNMENT_CENTER, clock_w)
	var party_w: float = minf(230.0, size.x * 0.28)
	var party_rect := Rect2(Vector2(size.x - party_w - 24, 12), Vector2(party_w, top_height - 26))
	_frame_panel(party_rect, base)
	_pixel_text(Vector2(party_rect.position.x + 10, 39), "隊伍  %d / 6" % (remote_players.size() + 1), 17 if not compact else 13, cream)
	for i in range(6):
		var dot_x: float = party_rect.position.x + 10.0 + float(i) * (party_w - 20.0) / 6.0
		var active: bool = i <= remote_players.size()
		if i > 0 and i <= remote_players.size():
			active = not _vital_is_out(str(remote_players[i - 1].get("id", "")))
		var dot_color: Color = Color("#a9bf9a") if active else Color("#485469")
		draw_rect(Rect2(Vector2(dot_x, 50), Vector2(17, 17)), Color("#251b17"))
		draw_rect(Rect2(Vector2(dot_x + 2, 52), Vector2(13, 13)), dot_color)
		draw_rect(Rect2(Vector2(dot_x + 5, 54), Vector2(7, 4)), cream if active else Color("#6d7680"))
	# The boss frame appears BELOW the header and never overlaps the timer.
	if boss_spawned and boss_hp > 0.0:
		var bw: float = minf(460.0, size.x * 0.45)
		var bx: float = size.x * 0.5 - bw * 0.5
		_frame_panel(Rect2(Vector2(bx, top_height + 8), Vector2(bw, 53)), Color("#452c32"))
		_pixel_text(Vector2(bx + 12, top_height + 29), "首領 · 董卓", 17, cream)
		_pixel_bar(Rect2(Vector2(bx + 12, top_height + 36), Vector2(bw - 24, 9)), boss_hp / maxf(1.0, boss_max_hp), blood)
		_pixel_text(Vector2(0, top_height + 82), "董卓來襲 · 看準預警圈閃避，再找空檔反擊", 14 if not compact else 12, cream, HORIZONTAL_ALIGNMENT_CENTER, size.x)
	else:
		var boss_eta: int = maxi(0, 120 - int(elapsed))
		var objective: String = "董卓已退 · 收集掉落寶物" if boss_spawned else "首領董卓將於 %02d:%02d 後出陣 · 擊破敵軍收集強化" % [boss_eta / 60, boss_eta % 60]
		_pixel_text(Vector2(0, top_height + 34), objective, 14 if not compact else 11, cream, HORIZONTAL_ALIGNMENT_CENTER, size.x)
	# Actual hitbox is handled by main.gd: same bottom-right anchor.
	if crossplay_mode:
		var ability_center := Vector2(size.x - 90.0, size.y - 90.0)
		var ready: bool = ability_ready_at <= Time.get_unix_time_from_system() * 1000.0
		var ability_color: Color = Color("#bf4a36") if ready else Color("#675952")
		draw_rect(Rect2(ability_center - Vector2(51, 49), Vector2(102, 97)), Color("#251a16", .94))
		draw_rect(Rect2(ability_center - Vector2(46, 44), Vector2(92, 87)), accent if ready else gilt)
		draw_rect(Rect2(ability_center - Vector2(42, 40), Vector2(84, 79)), ability_color)
		draw_rect(Rect2(ability_center - Vector2(33, 29), Vector2(66, 8)), Color("#f7d39a", .25))
		_pixel_text(ability_center + Vector2(-42, 8), "絕技" if ready else "冷卻", 23, cream, HORIZONTAL_ALIGNMENT_CENTER, 84)
		_pixel_text(ability_center + Vector2(-42, 29), "SPACE", 12, cream, HORIZONTAL_ALIGNMENT_CENTER, 84)
	# Visual joystick hint, paired with touch motion from the existing controller.
	_pixel_text(Vector2(20, size.y - 17), "WASD / 觸控移動", 12, cream)
