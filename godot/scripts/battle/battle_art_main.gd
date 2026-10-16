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
	pixel_world.visible = mode == "battle"

func _process(delta: float) -> void:
	super._process(delta)
	if pixel_world == null:
		return
	pixel_world.visible = mode == "battle"
	if mode == "battle":
		pixel_world.refresh(self, delta)

func _draw_battle(size: Vector2) -> void:
	# All ground, props, players, enemies and hit sparks are drawn by real
	# TileMapLayer / Sprite2D / AnimatedSprite2D children behind the HUD.
	_draw_hud(size)
	if OS.has_feature("web") and crossplay_mode:
		_frame_panel(Rect2(Vector2(12, 100), Vector2(132, 48)), Color("#293932"))
		_pixel_text(Vector2(20, 129), "返回大廳", 18, PIXEL_PAPER, HORIZONTAL_ALIGNMENT_CENTER, 116)
	if moving_touch >= 0:
		draw_arc(move_origin, 42.0, 0.0, TAU, 32, Color("#e9dcb2", 0.65), 3.0, false)
		draw_circle(move_origin + move_vector * 34.0, 17.0, Color("#799488", 0.55))
	if not upgrade_choices.is_empty():
		_draw_upgrade_overlay(size)
