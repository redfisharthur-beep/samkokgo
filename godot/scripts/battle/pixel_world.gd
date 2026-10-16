extends Node2D
## Isometric TileMapLayer + atlas-based AnimatedSprite2D actors.
## This renders the authoritative room state without changing movement or combat rules.

const PIXEL_ACTOR_SCENE: PackedScene = preload("res://scenes/battle/pixel_actor.tscn")
const TERRAIN: Texture2D = preload("res://assets/pixel/world/ground.svg")
const PROPS: Texture2D = preload("res://assets/pixel/world/props.svg")
const PICKUP: Texture2D = preload("res://assets/pixel/world/energy.svg")
const BATTLEFIELD: Texture2D = preload("res://assets/battlefield-premium.webp")
const HIT_LIGHT: AudioStream = preload("res://assets/audio/hit-light.wav")
const HIT_HEAVY: AudioStream = preload("res://assets/audio/hit-heavy.wav")
const TILE_SIZE := Vector2i(64, 32)
const PROP_SIZE := Vector2i(96, 112)
const HERO_IDS := ["liubei", "caocao", "sunquan", "lvbu"]
const MAX_ENEMIES := 64

@onready var ground: TileMapLayer = $Ground
@onready var depth: Node2D = $Depth
@onready var effects: Node2D = $Effects

var actors: Dictionary = {}
var pickups: Dictionary = {}
var props: Array[Dictionary] = []
var cloud_shift := Vector2.ZERO
var _elapsed := 0.0
var _last_health: Dictionary = {}
var _camera_shake := 0.0
var _backdrop: Sprite2D
var _hit_audio: Array[AudioStreamPlayer] = []
var _next_audio := 0
var _ready_for_state := false

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_backdrop = Sprite2D.new()
	_backdrop.name = "BattlefieldBackdrop"
	_backdrop.texture = BATTLEFIELD
	_backdrop.centered = true
	_backdrop.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	add_child(_backdrop)
	move_child(_backdrop, 0)
	for index in range(4):
		var player := AudioStreamPlayer.new()
		player.name = "HitAudio_%d" % index
		player.volume_db = -13.0
		add_child(player)
		_hit_audio.append(player)
	_create_tilemap()
	_create_props()
	_ready_for_state = true

func _create_tilemap() -> void:
	var atlas := TileSetAtlasSource.new()
	atlas.texture = TERRAIN
	atlas.texture_region_size = TILE_SIZE
	for index in range(8):
		atlas.create_tile(Vector2i(index, 0))
	var tile_set := TileSet.new()
	tile_set.tile_shape = TileSet.TILE_SHAPE_ISOMETRIC
	tile_set.tile_layout = TileSet.TILE_LAYOUT_DIAMOND_DOWN
	tile_set.tile_size = TILE_SIZE
	tile_set.add_source(atlas, 0)
	ground.tile_set = tile_set
	ground.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	# Fixed, reproducible atlas selection: subtle paths through grass rather
	# than a uniform enlarged background image.
	for y in range(-29, 30):
		for x in range(-30, 31):
			var noise := absi((x * 391 + y * 223 + x * y * 19) % 101)
			var trail := absf(float(x) * 0.66 + float(y) * 0.37 - 2.0) < 2.2
			var tile := 5 if trail and noise < 40 else (3 if trail else (4 if noise > 93 else (2 if noise < 17 else (1 if noise > 64 else 0))))
			ground.set_cell(Vector2i(x, y), 0, Vector2i(tile, 0))

func _create_props() -> void:
	for i in range(115):
		var ix := (i * 173 + 41) % 1700 - 850
		var iy := (i * 107 + 29) % 980 - 490
		# Keep the center playable; props are decorative and do not affect collisions.
		if absf(float(ix)) < 130.0 and absf(float(iy)) < 95.0:
			continue
		var kind := (i * 7 + i / 3) % 8
		var tile := AtlasTexture.new()
		tile.atlas = PROPS
		tile.region = Rect2(kind * PROP_SIZE.x, 0, PROP_SIZE.x, PROP_SIZE.y)
		var picture := Sprite2D.new()
		picture.name = "Environment_%d" % i
		picture.texture = tile
		picture.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		picture.offset = Vector2(0, -45)
		picture.position = Vector2(ix, iy)
		picture.scale = Vector2(0.75, 0.75) if kind < 3 else Vector2(0.66, 0.66)
		depth.add_child(picture)
		props.append({"node": picture, "anchor": Vector2(ix, iy)})

func refresh(main, delta: float) -> void:
	if not _ready_for_state:
		return
	_elapsed += delta
	var size: Vector2 = main.get_viewport_rect().size
	cloud_shift = (main.player_pos - size * 0.5) * 0.55
	var cover_scale := maxf(size.x / BATTLEFIELD.get_width(), size.y / BATTLEFIELD.get_height())
	_backdrop.scale = Vector2.ONE * cover_scale
	_backdrop.position = size * 0.5 - cloud_shift * 0.16
	_camera_shake = maxf(0.0, _camera_shake - delta * 24.0)
	position = Vector2(sin(_elapsed * 121.0), cos(_elapsed * 157.0)) * _camera_shake
	ground.position = size * 0.5 - cloud_shift
	ground.modulate = Color(1.0, 1.0, 1.0, 0.54)
	for item in props:
		var picture: Sprite2D = item["node"]
		picture.position = size * 0.5 + Vector2(item["anchor"]) - cloud_shift
	var existing: Dictionary = {}
	var me := _ensure_actor("self", main.selected_hero_id)
	existing["self"] = true
	me.set("downed", main._local_is_down())
	me.call("set_visual_position", main.player_pos, delta)
	me.call("set_health", main.hp, main.max_hp, false)
	if _last_health.has("self") and float(main.hp) < float(_last_health["self"]):
		me.call("play_hit")
		_spawn_hit(main.player_pos, true)
		_camera_shake = maxf(_camera_shake, 7.0)
		_play_hit_sound(true)
	_last_health["self"] = float(main.hp)

	for player in main.remote_players:
		var id := str(player.get("id", ""))
		if id.is_empty() or id == main.network.self_id:
			continue
		var hero := str(player.get("heroId", "liubei"))
		if not HERO_IDS.has(hero):
			hero = "liubei"
		var teammate := _ensure_actor("teammate_" + id, hero)
		existing["teammate_" + id] = true
		var pos: Vector2 = main._teammate_screen_position(player)
		teammate.set("downed", bool(main.player_vitals.get(id, {}).get("downed", false)))
		teammate.call("set_visual_position", pos, delta)
		var vital: Dictionary = main.player_vitals.get(id, {})
		teammate.call("set_health", float(vital.get("hp", 100.0)), float(vital.get("maxHp", 100.0)), true)

	var seen_pickups: Dictionary = {}
	for pickup in main.drops:
		var pickup_id := str(pickup.get("id", ""))
		if pickup_id.is_empty():
			continue
		seen_pickups[pickup_id] = true
		if not pickups.has(pickup_id):
			var new_gem := Sprite2D.new()
			new_gem.texture = PICKUP
			new_gem.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
			new_gem.scale = Vector2(1.22, 1.22)
			depth.add_child(new_gem)
			pickups[pickup_id] = new_gem
		var gem: Sprite2D = pickups[pickup_id]
		var gem_pos: Vector2 = pickup.get("pos", Vector2.ZERO)
		gem.position = gem_pos + Vector2(0, -8.0 + sin(_elapsed * 3.6 + float(pickup_id.hash() % 20)) * 4.0)
	for id in pickups.keys():
		if not seen_pickups.has(id):
			var old_gem: Sprite2D = pickups[id]
			old_gem.queue_free()
			pickups.erase(id)

	var enemy_count := 0
	for enemy in main.enemies:
		if enemy_count >= MAX_ENEMIES:
			break
		enemy_count += 1
		var enemy_id := str(enemy.get("id", enemy_count))
		var actor_id := "enemy_" + enemy_id
		var enemy_kind := "boss" if bool(enemy.get("boss", false)) else str(enemy.get("kind", "grunt"))
		if enemy_kind not in ["boss", "archer", "runner", "grunt"]:
			enemy_kind = "grunt"
		var avatar := _ensure_actor(actor_id, enemy_kind)
		existing[actor_id] = true
		var next: Vector2 = enemy.get("pos", Vector2.ZERO)
		avatar.call("set_visual_position", next, delta)
		var hp := float(enemy.get("hp", 1.0))
		avatar.call("set_health", hp, float(enemy.get("max_hp", 20.0)), true)
		if _last_health.has(actor_id) and hp < float(_last_health[actor_id]):
			var heavy_hit := float(_last_health[actor_id]) - hp >= 15.0 or enemy_kind == "boss"
			_spawn_hit(next, heavy_hit)
			avatar.call("play_hit")
			_camera_shake = maxf(_camera_shake, 5.0 if heavy_hit else 2.5)
			_play_hit_sound(heavy_hit)
			if main.player_pos.distance_to(next) < 280.0:
				me.call("play_attack")
		_last_health[actor_id] = hp

	for id in actors.keys():
		if existing.has(id):
			continue
		var actor_node: Node2D = actors[id]
		actor_node.queue_free()
		actors.erase(id)
		_last_health.erase(id)
	queue_redraw()

func _ensure_actor(id: String, kind: String) -> Node2D:
	if actors.has(id):
		var existing: Node2D = actors[id]
		if str(existing.get("kind")) != kind:
			existing.call("configure", id, kind)
		return existing
	var actor: Node2D = PIXEL_ACTOR_SCENE.instantiate()
	depth.add_child(actor)
	actor.call("configure", id, kind)
	actors[id] = actor
	return actor

func _spawn_hit(position_on_screen: Vector2, heavy: bool = false) -> void:
	# A bright center flash and sharp pixel chips make each confirmed hit readable.
	var burst := Node2D.new()
	burst.position = position_on_screen
	effects.add_child(burst)
	var flash := Polygon2D.new()
	flash.color = Color("#fff2bd")
	flash.polygon = PackedVector2Array([
		Vector2(0, -12), Vector2(4, -4), Vector2(12, 0), Vector2(4, 4),
		Vector2(0, 12), Vector2(-4, 4), Vector2(-12, 0), Vector2(-4, -4)
	])
	burst.add_child(flash)
	var flash_tween := create_tween()
	flash_tween.tween_property(flash, "scale", Vector2.ONE * (2.1 if heavy else 1.5), 0.13)
	flash_tween.parallel().tween_property(flash, "modulate:a", 0.0, 0.13)
	for j in range(8):
		var chip := Polygon2D.new()
		var c := Color("#fff0b5") if j % 3 == 0 else (Color("#eeb65f") if j % 2 == 0 else Color("#d26b55"))
		chip.color = c
		var chip_size := 4.0 if heavy else 3.0
		chip.polygon = PackedVector2Array([Vector2(-chip_size, -1), Vector2(chip_size, -1), Vector2(chip_size - 1, 1), Vector2(-chip_size + 1, 1)])
		burst.add_child(chip)
		var theta := (float(j) / 8.0) * TAU + 0.16
		chip.rotation = theta
		var radius := 31.0 if heavy else 23.0
		var target := Vector2(cos(theta) * radius, sin(theta) * radius * 0.78)
		var tween := create_tween()
		tween.tween_property(chip, "position", target, 0.22)
		tween.parallel().tween_property(chip, "rotation", theta + 0.8, 0.22)
		tween.parallel().tween_property(chip, "modulate:a", 0.0, 0.22)
	get_tree().create_timer(0.26).timeout.connect(burst.queue_free)

func _play_hit_sound(heavy: bool) -> void:
	if _hit_audio.is_empty():
		return
	var player := _hit_audio[_next_audio]
	_next_audio = (_next_audio + 1) % _hit_audio.size()
	player.stop()
	player.stream = HIT_HEAVY if heavy else HIT_LIGHT
	player.play()

func _draw() -> void:
	# Lightweight lighting washes preserve the underlying tile pixel pattern.
	# No full-screen enlarged raster photograph or fake procedural stick figures.
	var area := get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO, area), Color("#27352c"))
