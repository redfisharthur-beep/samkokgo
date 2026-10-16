extends Node2D
## Real animated atlas sprite for Godot 4.3.
## All hero/enemy sheets use 56x72 cells, four frames and six action/facing rows.
## The visual is passive: server-supplied positions, stats and hit events remain authoritative.

const SHEET_LIUBEI: Texture2D = preload("res://assets/pixel/actors/liubei.svg")
const SHEET_CAOCAO: Texture2D = preload("res://assets/pixel/actors/caocao.svg")
const SHEET_SUNQUAN: Texture2D = preload("res://assets/pixel/actors/sunquan.svg")
const SHEET_LVBU: Texture2D = preload("res://assets/pixel/actors/lvbu.svg")
const SHEET_GRUNT: Texture2D = preload("res://assets/pixel/actors/grunt.svg")
const SHEET_RUNNER: Texture2D = preload("res://assets/pixel/actors/runner.svg")
const SHEET_ARCHER: Texture2D = preload("res://assets/pixel/actors/archer.svg")
const SHEET_BOSS: Texture2D = preload("res://assets/pixel/actors/boss.svg")
const CELL := Vector2i(56, 72)
const MAX_FRAMES := 4

static var cached_frames: Dictionary = {}

var actor_key := ""
var kind := "grunt"
var animated: AnimatedSprite2D
var health_back: Polygon2D
var health_front: Polygon2D
var last_world_pos := Vector2.ZERO
var attack_seconds := 0.0
var downed := false
var _initialized := false

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	animated = AnimatedSprite2D.new()
	animated.name = "PixelAnimator"
	animated.centered = true
	animated.position = Vector2(0, -27)
	animated.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	add_child(animated)
	health_back = Polygon2D.new()
	health_front = Polygon2D.new()
	health_back.color = Color("#232b27")
	health_front.color = Color("#b76b5c")
	add_child(health_back)
	add_child(health_front)
	health_back.visible = false
	health_front.visible = false
	_update_health(1.0)

func configure(id: String, actor_kind: String = "grunt") -> void:
	actor_key = id
	kind = actor_kind
	if animated == null:
		return
	if not cached_frames.has(actor_kind):
		cached_frames[actor_kind] = _make_frames(_texture_for(actor_kind))
	animated.sprite_frames = cached_frames[actor_kind]
	animated.play("idle_front")
	_initialized = false
	if actor_kind == "boss":
		scale = Vector2(1.9, 1.9)
	elif actor_kind in ["grunt", "runner", "archer"]:
		scale = Vector2(1.04, 1.04)
	else:
		scale = Vector2(1.26, 1.26)

func _make_frames(texture: Texture2D) -> SpriteFrames:
	var frames := SpriteFrames.new()
	if frames.has_animation("default"):
		frames.remove_animation("default")
	var actions := ["idle", "walk", "attack"]
	for action_index in range(actions.size()):
		for facing_index in range(2):
			var face := "front" if facing_index == 0 else "back"
			var name: String = str(actions[action_index]) + "_" + face
			frames.add_animation(name)
			frames.set_animation_loop(name, action_index != 2)
			frames.set_animation_speed(name, 4.0 if action_index == 0 else (9.0 if action_index == 1 else 12.0))
			for frame in range(MAX_FRAMES):
				var atlas := AtlasTexture.new()
				atlas.atlas = texture
				atlas.region = Rect2(frame * CELL.x, (action_index * 2 + facing_index) * CELL.y, CELL.x, CELL.y)
				frames.add_frame(name, atlas)
	return frames

func _texture_for(id: String) -> Texture2D:
	match id:
		"liubei": return SHEET_LIUBEI
		"caocao": return SHEET_CAOCAO
		"sunquan": return SHEET_SUNQUAN
		"lvbu": return SHEET_LVBU
		"runner": return SHEET_RUNNER
		"archer": return SHEET_ARCHER
		"boss": return SHEET_BOSS
		_: return SHEET_GRUNT

func set_visual_position(next: Vector2, delta: float, snap: bool = false) -> void:
	if not _initialized or snap:
		position = next
		last_world_pos = next
		_initialized = true
	else:
		position = position.lerp(next, minf(1.0, delta * 12.0))
	var motion := next - last_world_pos
	if motion.length_squared() > 0.09:
		animated.flip_h = motion.x < -0.4
		var front := motion.y > -0.8
		_set_animation("walk_front" if front else "walk_back")
	else:
		_set_animation("idle_back" if animated.animation.ends_with("back") else "idle_front")
	last_world_pos = next
	if attack_seconds > 0.0:
		attack_seconds = maxf(0.0, attack_seconds - delta)
		if not animated.animation.begins_with("attack"):
			_set_animation("attack_back" if animated.animation.ends_with("back") else "attack_front")
		if attack_seconds <= 0.0:
			_set_animation("idle_back" if animated.animation.ends_with("back") else "idle_front")
	animated.modulate = Color(0.55, 0.59, 0.6, 0.75) if downed else Color.WHITE

func play_attack() -> void:
	if animated == null:
		return
	var face := "back" if animated.animation.ends_with("back") else "front"
	attack_seconds = 0.34
	animated.play("attack_" + face)

func set_health(hp: float, max_hp: float, show_bar: bool = true) -> void:
	health_back.visible = show_bar
	health_front.visible = show_bar
	_update_health(clampf(hp / maxf(1.0, max_hp), 0.0, 1.0))

func _update_health(ratio: float) -> void:
	var w := 40.0
	health_back.polygon = PackedVector2Array([Vector2(-w / 2, -72), Vector2(w / 2, -72), Vector2(w / 2, -67), Vector2(-w / 2, -67)])
	health_front.polygon = PackedVector2Array([Vector2(-w / 2 + 1, -71), Vector2(-w / 2 + 1 + (w - 2) * ratio, -71), Vector2(-w / 2 + 1 + (w - 2) * ratio, -68), Vector2(-w / 2 + 1, -68)])

func _set_animation(name: String) -> void:
	if animated.animation == name or attack_seconds > 0.0:
		return
	animated.play(name)
