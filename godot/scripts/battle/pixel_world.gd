extends Node2D
## Isometric TileMapLayer + atlas-based AnimatedSprite2D actors.
## This renders the authoritative room state without changing movement or combat rules.

const PIXEL_ACTOR_SCENE: PackedScene = preload("res://scenes/battle/pixel_actor.tscn")
const TERRAIN: Texture2D = preload("res://assets/pixel/world/ground.svg")
const PROPS: Texture2D = preload("res://assets/pixel/world/props.svg")
const TILE_SIZE := Vector2i(64, 32)
const PROP_SIZE := Vector2i(96, 112)
const HERO_IDS := ["liubei", "caocao", "sunquan", "lvbu"]
const MAX_ENEMIES := 64

@onready var ground: TileMapLayer = $Ground
@onready var depth: Node2D = $Depth
@onready var effects: Node2D = $Effects

var actors: Dictionary = {}
var props: Array[Dictionary] = []
var cloud_shift := Vector2.ZERO
var _elapsed := 0.0
var _last_health: Dictionary = {}
var _ready_for_state := false

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
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

func refresh(main: Control, delta: float) -> void:
	if not _ready_for_state:
		return
	_elapsed += delta
	var size := main.get_viewport_rect().size
	cloud_shift = (main.player_pos - size * 0.5) * 0.55
	ground.position = size * 0.5 - cloud_shift
	for item in props:
		var picture: Sprite2D = item["node"]
		picture.position = size * 0.5 + Vector2(item["anchor"]) - cloud_shift
	var existing: Dictionary = {}
	var me := _ensure_actor("self", main.selected_hero_id)
	existing["self"] = true
	me.downed = main._local_is_down()
	me.set_visual_position(main.player_pos, delta)
	me.set_health(main.hp, main.max_hp, false)

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
		teammate.downed = bool(main.player_vitals.get(id, {}).get("downed", false))
		teammate.set_visual_position(pos, delta)
		var vital: Dictionary = main.player_vitals.get(id, {})
		teammate.set_health(float(vital.get("hp", 100.0)), float(vital.get("maxHp", 100.0)), true)

	var enemy_count := 0
	for enemy in main.enemies:
		if enemy_count >= MAX_ENEMIES:
			break
		enemy_count += 1
		var enemy_id := str(enemy.get("id", enemy_count))
		var actor_id := "enemy_" + enemy_id
		var enemy_kind := "boss" if bool(enemy.get("boss", false)) else ("archer" if bool(enemy.get("ranged", false)) else ("runner" if bool(enemy.get("elite", false)) else "grunt"))
		var avatar := _ensure_actor(actor_id, enemy_kind)
		existing[actor_id] = true
		var next: Vector2 = enemy.get("pos", Vector2.ZERO)
		avatar.set_visual_position(next, delta)
		var hp := float(enemy.get("hp", 1.0))
		avatar.set_health(hp, float(enemy.get("max_hp", 20.0)), true)
		if _last_health.has(actor_id) and hp < float(_last_health[actor_id]):
			_spawn_hit(next)
			if main.player_pos.distance_to(next) < 280.0:
				me.play_attack()
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
		if existing.kind != kind:
			existing.configure(id, kind)
		return existing
	var actor: Node2D = PIXEL_ACTOR_SCENE.instantiate()
	depth.add_child(actor)
	actor.configure(id, kind)
	actors[id] = actor
	return actor

func _spawn_hit(position_on_screen: Vector2) -> void:
	# Light, short-lived palette-matched sparks, clearly separated from sprites.
	var burst := Node2D.new()
	burst.position = position_on_screen
	effects.add_child(burst)
	for j in range(5):
		var chip := Polygon2D.new()
		var c := Color("#f1d993") if j % 2 == 0 else Color("#d18d69")
		chip.color = c
		chip.polygon = PackedVector2Array([Vector2(-3, -2), Vector2(3, -2), Vector2(3, 2), Vector2(-3, 2)])
		burst.add_child(chip)
		var theta := (float(j) / 5.0) * TAU
		var target := Vector2(cos(theta) * 24.0, sin(theta) * 19.0)
		var tween := create_tween()
		tween.tween_property(chip, "position", target, 0.26)
		tween.parallel().tween_property(chip, "modulate:a", 0.0, 0.26)
	get_tree().create_timer(0.34).timeout.connect(burst.queue_free)

func _draw() -> void:
	# Lightweight lighting washes preserve the underlying tile pixel pattern.
	# No full-screen enlarged raster photograph or fake procedural stick figures.
	var area := get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO, area), Color("#27352c"))
