extends Control

@onready var network: CloudflareRoom = $CloudflareRoom

const INK := Color("#302f2b")
const PAPER := Color("#ddd2bd")
const MOSS := Color("#728174")
const JADE := Color("#718d7a")
const RUST := Color("#ad7767")
const GOLD := Color("#c7a96d")
const NIGHT := Color("#293632")

var mode := "lobby"
var status_text := "選擇快速加入，或建立房間"
var room_id := ""
var player_pos := Vector2.ZERO
var move_origin := Vector2.ZERO
var move_vector := Vector2.ZERO
var moving_touch := -1
var keys := Vector2.ZERO
var elapsed := 0.0
var attack_clock := 0.0
var spawn_clock := 0.0
var level := 1
var xp := 0
var xp_goal := 5
var kills := 0
var hp := 100.0
var max_hp := 100.0
var damage := 20.0
var attack_interval := 0.9
var attack_range := 380.0
var upgrade_choices: Array[String] = []
var enemies: Array[Dictionary] = []
var shots: Array[Dictionary] = []
var enemy_shots: Array[Dictionary] = []
var drops: Array[Dictionary] = []
var particles: Array[Dictionary] = []
var remote_players: Array[Dictionary] = []
var boss_spawned := false
var boss_hp := 0.0
var attack_flash := 0.0

func _ready() -> void:
	player_pos = get_viewport_rect().size * 0.5
	network.api_result.connect(_on_api_result)
	network.room_event.connect(_on_room_event)
	network.connection_changed.connect(_on_connection_changed)
	queue_redraw()

func _process(delta: float) -> void:
	if mode != "battle":
		queue_redraw()
		return
	if not upgrade_choices.is_empty():
		queue_redraw()
		return

	elapsed += delta
	attack_flash = maxf(0.0, attack_flash - delta)
	var direction := move_vector
	if keys.length() > 0.1:
		direction = keys.normalized()
	player_pos += direction * 255.0 * delta
	var bounds := get_viewport_rect().size
	player_pos.x = clampf(player_pos.x, 50.0, bounds.x - 50.0)
	player_pos.y = clampf(player_pos.y, 125.0, bounds.y - 50.0)

	spawn_clock += delta
	var spawn_rate := maxf(0.32, 1.2 - elapsed * 0.0014)
	if spawn_clock >= spawn_rate and elapsed < 300.0:
		spawn_clock = 0.0
		_spawn_enemy(false)
		if randf() < minf(0.35, elapsed / 240.0):
			_spawn_enemy(true)

	if elapsed >= 300.0 and not boss_spawned:
		boss_spawned = true
		boss_hp = 1600.0
		_spawn_enemy(false, true)

	attack_clock += delta
	if attack_clock >= attack_interval:
		attack_clock = 0.0
		_auto_attack()

	_update_combat(delta)
	_update_enemies(delta)
	_update_projectiles(delta)
	_update_drops(delta)
	_update_particles(delta)

	if hp <= 0.0:
		mode = "defeat"
	elif elapsed >= 360.0 and (not boss_spawned or boss_hp <= 0.0):
		mode = "victory"
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if mode == "battle" and not upgrade_choices.is_empty():
		if event is InputEventScreenTouch and event.pressed:
			_choose_upgrade(_choice_at(event.position))
		elif event is InputEventMouseButton and event.pressed:
			_choose_upgrade(_choice_at(event.position))
		return

	if event is InputEventKey:
		var key := event as InputEventKey
		if key.keycode in [KEY_W, KEY_UP]: keys.y = -1.0 if key.pressed else 0.0
		if key.keycode in [KEY_S, KEY_DOWN]: keys.y = 1.0 if key.pressed else 0.0
		if key.keycode in [KEY_A, KEY_LEFT]: keys.x = -1.0 if key.pressed else 0.0
		if key.keycode in [KEY_D, KEY_RIGHT]: keys.x = 1.0 if key.pressed else 0.0

	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			if mode == "lobby":
				_handle_lobby_click(touch.position)
			elif mode == "battle" and touch.position.y < 100.0:
				return
			elif mode in ["victory", "defeat"]:
				mode = "lobby"
			else:
				moving_touch = touch.index
				move_origin = touch.position
				_update_stick(touch.position)
		else:
			if touch.index == moving_touch:
				moving_touch = -1
				move_vector = Vector2.ZERO
	if event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		if drag.index == moving_touch:
			_update_stick(drag.position)

	if event is InputEventMouseButton:
		var mouse := event as InputEventMouseButton
		if mouse.pressed:
			if mode == "lobby":
				_handle_lobby_click(mouse.position)
			elif mode in ["victory", "defeat"]:
				mode = "lobby"

	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and mode == "battle":
		_update_stick((event as InputEventMouseMotion).position)

func _update_stick(pos: Vector2) -> void:
	var offset := pos - move_origin
	move_vector = offset.limit_length(70.0) / 70.0

func _handle_lobby_click(pos: Vector2) -> void:
	var size := get_viewport_rect().size
	var center := size.x * 0.5
	if Rect2(center - Vector2(180, 35), Vector2(360, 68)).has_point(pos):
		network.quick_join()
		status_text = "正在尋找隊友…"
	elif Rect2(center - Vector2(180, -48), Vector2(360, 68)).has_point(pos):
		network.create_room()
		status_text = "正在建立房間…"
	elif Rect2(center - Vector2(130, -148), Vector2(260, 68)).has_point(pos):
		_start_battle()

func _start_battle() -> void:
	mode = "battle"
	elapsed = 0.0
	spawn_clock = 0.0
	attack_clock = 0.0
	level = 1
	xp = 0
	xp_goal = 5
	kills = 0
	hp = 100.0
	max_hp = 100.0
	damage = 20.0
	attack_interval = 0.9
	attack_range = 380.0
	boss_spawned = false
	boss_hp = 0.0
	enemies.clear()
	shots.clear()
	enemy_shots.clear()
	drops.clear()
	particles.clear()
	player_pos = get_viewport_rect().size * 0.5
	move_vector = Vector2.ZERO
	if not room_id.is_empty():
		network.send_action({"type": "start"})
	queue_redraw()

func _spawn_enemy(ranged: bool, boss: bool = false) -> void:
	var edge := randi_range(0, 3)
	var size := get_viewport_rect().size
	var p := Vector2.ZERO
	match edge:
		0: p = Vector2(randf_range(20.0, size.x - 20.0), 112.0)
		1: p = Vector2(size.x - 20.0, randf_range(112.0, size.y - 20.0))
		2: p = Vector2(randf_range(20.0, size.x - 20.0), size.y - 20.0)
		_: p = Vector2(20.0, randf_range(112.0, size.y - 20.0))
	var scale := 1.0 if not boss else 2.15
	enemies.append({
		"pos": p,
		"hp": 42.0 if not boss else boss_hp,
		"max_hp": 42.0 if not boss else boss_hp,
		"speed": randf_range(50.0, 80.0) if not ranged else randf_range(38.0, 52.0),
		"ranged": ranged,
		"boss": boss,
		"scale": scale,
		"shot_clock": randf_range(1.0, 2.5),
		"phase": randf() * TAU
	})

func _auto_attack() -> void:
	var nearest := -1
	var best := attack_range
	for i in range(enemies.size()):
		var distance := player_pos.distance_to(enemies[i]["pos"])
		if distance < best:
			best = distance
			nearest = i
	if nearest < 0:
		return
	var target: Vector2 = enemies[nearest]["pos"]
	var direction := (target - player_pos).normalized()
	shots.append({"pos": player_pos + direction * 24.0, "vel": direction * 620.0, "damage": damage, "life": 1.1})
	attack_flash = 0.15
	_emit_particles(player_pos + direction * 24.0, GOLD, 5, 85.0)

func _update_combat(delta: float) -> void:
	for i in range(enemies.size() - 1, -1, -1):
		var enemy: Dictionary = enemies[i]
		var pos: Vector2 = enemy["pos"]
		var scale: float = enemy["scale"]
		var radius := 20.0 * scale
		if pos.distance_to(player_pos) < radius + 22.0:
			hp -= (12.0 if not enemy["boss"] else 24.0) * delta
		if enemy["ranged"] and not enemy["boss"]:
			enemy["shot_clock"] -= delta
			if enemy["shot_clock"] <= 0.0 and pos.distance_to(player_pos) < 520.0:
				enemy["shot_clock"] = randf_range(2.1, 3.0)
				var direction := (player_pos - pos).normalized()
				enemy_shots.append({"pos": pos, "vel": direction * 215.0, "life": 3.5})
				_emit_particles(pos, RUST, 5, 65.0)
		if enemy["boss"]:
			boss_hp = enemy["hp"]
			enemy["phase"] = float(enemy["phase"]) + delta * 2.0
		enemies[i] = enemy

func _update_enemies(delta: float) -> void:
	for i in range(enemies.size()):
		var enemy: Dictionary = enemies[i]
		var pos: Vector2 = enemy["pos"]
		var to_player := player_pos - pos
		var velocity := Vector2.ZERO
		if enemy["ranged"] and not enemy["boss"] and to_player.length() < 300.0:
			velocity = -to_player.normalized() * float(enemy["speed"]) * 0.65
		else:
			velocity = to_player.normalized() * float(enemy["speed"])
		enemy["pos"] = pos + velocity * delta
		enemies[i] = enemy

func _update_projectiles(delta: float) -> void:
	for i in range(shots.size() - 1, -1, -1):
		var shot: Dictionary = shots[i]
		shot["pos"] = Vector2(shot["pos"]) + Vector2(shot["vel"]) * delta
		shot["life"] = float(shot["life"]) - delta
		var hit := false
		for j in range(enemies.size() - 1, -1, -1):
			var enemy: Dictionary = enemies[j]
			var hit_radius := 23.0 * float(enemy["scale"])
			if Vector2(shot["pos"]).distance_to(Vector2(enemy["pos"])) < hit_radius:
				enemy["hp"] = float(enemy["hp"]) - float(shot["damage"])
				_emit_particles(Vector2(shot["pos"]), GOLD, 8, 140.0)
				if float(enemy["hp"]) <= 0.0:
					if enemy["boss"]:
						boss_hp = 0.0
						for n in range(12):
							drops.append({"pos": Vector2(enemy["pos"]) + Vector2(randf_range(-35.0, 35.0), randf_range(-35.0, 35.0)), "value": 1})
					else:
						drops.append({"pos": enemy["pos"], "value": 1})
					kills += 1
					_emit_particles(Vector2(enemy["pos"]), RUST, 14, 190.0)
					enemies.remove_at(j)
				else:
					enemies[j] = enemy
				hit = true
				break
		if hit or float(shot["life"]) <= 0.0:
			shots.remove_at(i)
		else:
			shots[i] = shot

	for i in range(enemy_shots.size() - 1, -1, -1):
		var shot: Dictionary = enemy_shots[i]
		shot["pos"] = Vector2(shot["pos"]) + Vector2(shot["vel"]) * delta
		shot["life"] = float(shot["life"]) - delta
		if Vector2(shot["pos"]).distance_to(player_pos) < 21.0:
			hp -= 10.0
			_emit_particles(player_pos, RUST, 12, 130.0)
			enemy_shots.remove_at(i)
		elif float(shot["life"]) <= 0.0:
			enemy_shots.remove_at(i)
		else:
			enemy_shots[i] = shot

func _update_drops(delta: float) -> void:
	for i in range(drops.size() - 1, -1, -1):
		var drop: Dictionary = drops[i]
		var pos: Vector2 = drop["pos"]
		if pos.distance_to(player_pos) < 26.0:
			xp += int(drop["value"])
			_emit_particles(pos, JADE, 7, 100.0)
			drops.remove_at(i)
			if xp >= xp_goal:
				xp -= xp_goal
				level += 1
				xp_goal = 5 + level * 3
				_open_upgrade()
				return
		else:
			var direction := player_pos - pos
			if direction.length() < 145.0:
				pos += direction.normalized() * 170.0 * delta
			drop["pos"] = pos
			drops[i] = drop

func _open_upgrade() -> void:
	var all := ["長槍淬鋒", "輕身步法", "青囊護心", "連弩機括"]
	all.shuffle()
	upgrade_choices = [all[0], all[1], all[2]]
	if level % 4 == 0:
		upgrade_choices[0] = "神兵覺醒"

func _choose_upgrade(index: int) -> void:
	if index < 0 or index >= upgrade_choices.size():
		return
	match upgrade_choices[index]:
		"長槍淬鋒":
			damage *= 1.28
		"輕身步法":
			pass
		"青囊護心":
			max_hp += 24.0
			hp = minf(max_hp, hp + 36.0)
		"連弩機括":
			attack_interval = maxf(0.35, attack_interval * 0.82)
		"神兵覺醒":
			damage *= 1.55
			attack_range += 55.0
			max_hp += 30.0
			hp = minf(max_hp, hp + 50.0)
	upgrade_choices.clear()

func _choice_at(pos: Vector2) -> int:
	var size := get_viewport_rect().size
	var card_w := minf(260.0, size.x * 0.28)
	var gap := 18.0
	var total := card_w * 3.0 + gap * 2.0
	var left := (size.x - total) * 0.5
	for i in range(3):
		var rect := Rect2(Vector2(left + i * (card_w + gap), size.y * 0.51), Vector2(card_w, 150.0))
		if rect.has_point(pos):
			return i
	return -1

func _emit_particles(pos: Vector2, color: Color, count: int, speed: float) -> void:
	for i in range(count):
		var angle := randf() * TAU
		particles.append({"pos": pos, "vel": Vector2.RIGHT.rotated(angle) * randf_range(speed * 0.25, speed), "life": randf_range(0.18, 0.42), "color": color})

func _update_particles(delta: float) -> void:
	for i in range(particles.size() - 1, -1, -1):
		var p: Dictionary = particles[i]
		p["pos"] = Vector2(p["pos"]) + Vector2(p["vel"]) * delta
		p["life"] = float(p["life"]) - delta
		if float(p["life"]) <= 0.0:
			particles.remove_at(i)
		else:
			p["vel"] = Vector2(p["vel"]) * 0.93
			particles[i] = p

func _on_api_result(endpoint: String, payload: Dictionary) -> void:
	if payload.has("error"):
		status_text = "房間服務暫時無法連線"
		return
	if endpoint in ["/api/create", "/api/quick-join"]:
		room_id = str(payload.get("roomId", ""))
		if not room_id.is_empty():
			network.join_room(room_id)
			status_text = "房間已準備 · 等待連線"
	queue_redraw()

func _on_room_event(event: Dictionary) -> void:
	if event.get("type") == "presence":
		var snapshot: Dictionary = event.get("snapshot", {})
		remote_players = snapshot.get("players", [])
		status_text = "房間已連線 · %d 位隊友" % remote_players.size()
	elif event.get("type") == "start":
		status_text = "隊伍已開始"
	elif event.get("type") == "game-state":
		pass

func _on_connection_changed(state: String) -> void:
	if state == "connecting":
		status_text = "正在連線到房間…"
	elif state == "connected":
		status_text = "房間已連線 · 可開始戰鬥"
	elif state.begins_with("error:"):
		status_text = "連線失敗 · 可先單人試玩"
	queue_redraw()

func _draw() -> void:
	var size := get_viewport_rect().size
	if mode == "lobby":
		_draw_lobby(size)
	elif mode == "battle":
		_draw_battle(size)
	elif mode in ["victory", "defeat"]:
		_draw_end(size)

func _draw_lobby(size: Vector2) -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("#d6cbb7"))
	_draw_faint_mountain(size)
	var center := size * 0.5
	draw_circle(center + Vector2(0, -175), 53.0, Color("#c7a96d"))
	draw_string(ThemeDB.fallback_font, center + Vector2(-88, -160), "三國", HORIZONTAL_ALIGNMENT_CENTER, 176.0, 48, INK)
	draw_string(ThemeDB.fallback_font, center + Vector2(-150, -112), "亂世同征", HORIZONTAL_ALIGNMENT_CENTER, 300.0, 23, Color("#565b50"))
	_draw_button(Rect2(center + Vector2(-180, -70), Vector2(360, 58)), "快速加入", MOSS)
	_draw_button(Rect2(center + Vector2(-180, 2), Vector2(360, 58)), "建立房間", Color("#8b7967"))
	_draw_button(Rect2(center + Vector2(-130, 82), Vector2(260, 54)), "開始試玩", Color("#9a7867"))
	draw_string(ThemeDB.fallback_font, center + Vector2(-300, 175), status_text, HORIZONTAL_ALIGNMENT_CENTER, 600.0, 17, INK)
	if not room_id.is_empty():
		draw_string(ThemeDB.fallback_font, center + Vector2(-100, 207), "房間 " + room_id, HORIZONTAL_ALIGNMENT_CENTER, 200.0, 15, INK)
	draw_string(ThemeDB.fallback_font, Vector2(18, size.y - 20), "WASD / 方向鍵 移動 · 觸控任意位置拖曳", HORIZONTAL_ALIGNMENT_LEFT, size.x - 36, 14, Color("#565b50"))

func _draw_battle(size: Vector2) -> void:
	_draw_battlefield(size)
	for drop in drops:
		_draw_drop(drop["pos"])
	for enemy in enemies:
		_draw_enemy(enemy)
	for shot in shots:
		var pos: Vector2 = shot["pos"]
		draw_line(pos - Vector2(10, 4), pos + Vector2(10, 4), GOLD, 4.0, true)
		draw_circle(pos, 4.5, Color("#f1d99b"))
	for shot in enemy_shots:
		draw_circle(shot["pos"], 11.0, Color("#ae766b"))
		draw_circle(shot["pos"], 5.0, Color("#e6aa8d"))
	for particle in particles:
		draw_circle(particle["pos"], 2.3, particle["color"])
	for player in remote_players:
		_draw_hero(player_pos + Vector2(48, 12), 0.72, Color("#8c9e9b"), Color("#494c4a"), Color("#bd9e68"), 0.0)
	_draw_hero(player_pos, 1.0 + minf(0.16, level * 0.008), Color("#708b78"), Color("#353b37"), Color("#c4a766"), 0.0)
	_draw_hud(size)
	if moving_touch >= 0:
		draw_circle(move_origin, 43.0, Color(0.18, 0.2, 0.17, 0.22))
		draw_circle(move_origin + move_vector * 34.0, 18.0, Color("#9caf9a"))
	if attack_flash > 0.0:
		draw_arc(player_pos, 36.0, -0.7, 0.7, 18, Color(1.0, 0.85, 0.55, attack_flash * 5.0), 3.0, true)
	if not upgrade_choices.is_empty():
		_draw_upgrade_overlay(size)

func _draw_battlefield(size: Vector2) -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("#7e8a76"))
	var offset := Vector2(fposmod(player_pos.x * 0.23, 88.0), fposmod(player_pos.y * 0.23, 72.0))
	for y in range(-1, int(size.y / 72.0) + 2):
		for x in range(-1, int(size.x / 88.0) + 2):
			var p := Vector2(x * 88.0, y * 72.0) - offset
			var seed_color := (x * 13 + y * 7) % 4
			var color := Color("#85917d") if seed_color == 0 else Color("#788673")
			draw_circle(p + Vector2(31, 24), 1.8, color)
			if seed_color == 2:
				draw_line(p + Vector2(44, 46), p + Vector2(51, 42), Color("#9b9b7b"), 2.0, true)
	# Old stone path crossing the battlefield.
	var path_y := size.y * 0.70
	for i in range(12):
		var p := Vector2(i * 105.0 - fposmod(player_pos.x * 0.1, 105.0), path_y + sin(i * 1.6) * 9.0)
		draw_colored_polygon(PackedVector2Array([p + Vector2(-42, -12), p + Vector2(38, -14), p + Vector2(43, 12), p + Vector2(-37, 15)]), Color("#9d987f"))
		_draw_rock(p, 0.48, Color("#aaa18a"))

func _draw_faint_mountain(size: Vector2) -> void:
	draw_colored_polygon(PackedVector2Array([Vector2(0, size.y * 0.68), Vector2(size.x * 0.18, size.y * 0.34), Vector2(size.x * 0.37, size.y * 0.7)]), Color("#c5c0ad"))
	draw_colored_polygon(PackedVector2Array([Vector2(size.x * 0.2, size.y * 0.7), Vector2(size.x * 0.48, size.y * 0.3), Vector2(size.x * 0.72, size.y * 0.7)]), Color("#b7b8a8"))
	draw_colored_polygon(PackedVector2Array([Vector2(size.x * 0.57, size.y * 0.7), Vector2(size.x * 0.8, size.y * 0.38), Vector2(size.x, size.y * 0.69)]), Color("#c1bba9"))

func _draw_hero(pos: Vector2, scale: float, robe: Color, hair: Color, trim: Color, angle: float) -> void:
	var facing := Vector2.RIGHT.rotated(angle)
	# Ground shadow, layered cloak, armor, head, crown, and spear.
	draw_ellipse(pos + Vector2(0, 17 * scale), Vector2(24, 9) * scale, Color(0.19, 0.22, 0.18, 0.32))
	var cape := PackedVector2Array([pos + Vector2(-13, -7) * scale, pos + Vector2(13, -7) * scale, pos + Vector2(22, 25) * scale, pos + Vector2(0, 31) * scale, pos + Vector2(-23, 23) * scale])
	draw_colored_polygon(cape, robe.darkened(0.14))
	draw_colored_polygon(PackedVector2Array([pos + Vector2(-11, -9) * scale, pos + Vector2(11, -9) * scale, pos + Vector2(15, 16) * scale, pos + Vector2(-15, 16) * scale]), robe)
	draw_line(pos + Vector2(-12, -1) * scale, pos + Vector2(-18, 14) * scale, trim, 2.4 * scale, true)
	draw_line(pos + Vector2(12, -1) * scale, pos + Vector2(18, 14) * scale, trim, 2.4 * scale, true)
	draw_rect(Rect2(pos + Vector2(-12, 1) * scale, Vector2(24, 11) * scale), Color("#6b6251"))
	for n in range(3):
		draw_line(pos + Vector2(-9, (3 + n * 3) * scale), pos + Vector2(9, (3 + n * 3) * scale), Color("#95866b"), 1.2 * scale)
	draw_circle(pos + Vector2(0, -17) * scale, 11 * scale, Color("#d9b895"))
	draw_circle(pos + Vector2(0, -21) * scale, 12 * scale, hair)
	draw_arc(pos + Vector2(0, -19) * scale, 12 * scale, PI, TAU, 12, trim, 3.5 * scale, true)
	draw_circle(pos + Vector2(4, -17) * scale, 1.5 * scale, INK)
	draw_line(pos + Vector2(3, -11) * scale, pos + Vector2(8, -10) * scale, Color("#755c50"), 1.1 * scale)
	var spear_start := pos + Vector2(15, 4) * scale
	var spear_end := spear_start + facing * 39.0 * scale
	draw_line(spear_start, spear_end, Color("#5d5144"), 2.5 * scale, true)
	draw_colored_polygon(PackedVector2Array([spear_end, spear_end - facing.rotated(0.35) * 11 * scale, spear_end - facing.rotated(-0.35) * 11 * scale]), trim)
	draw_circle(pos + Vector2(-8, 1) * scale, 3.2 * scale, trim)

func _draw_enemy(enemy: Dictionary) -> void:
	var pos: Vector2 = enemy["pos"]
	var scale: float = enemy["scale"]
	var boss: bool = enemy["boss"]
	var body := Color("#765e55") if not boss else Color("#494b45")
	draw_ellipse(pos + Vector2(0, 13 * scale), Vector2(22, 8) * scale, Color(0.18, 0.2, 0.17, 0.32))
	draw_colored_polygon(PackedVector2Array([pos + Vector2(-14, -7) * scale, pos + Vector2(14, -7) * scale, pos + Vector2(19, 20) * scale, pos + Vector2(-18, 20) * scale]), body)
	draw_rect(Rect2(pos + Vector2(-11, -2) * scale, Vector2(22, 8) * scale), Color("#9d8465") if not boss else Color("#9a745e"))
	draw_circle(pos + Vector2(0, -15) * scale, 10 * scale, Color("#c39b7b"))
	draw_circle(pos + Vector2(0, -19) * scale, 10 * scale, Color("#4c4942"))
	draw_line(pos + Vector2(-8, -18) * scale, pos + Vector2(-15, -29) * scale, Color("#665f4d"), 3.0 * scale)
	draw_line(pos + Vector2(8, -18) * scale, pos + Vector2(15, -29) * scale, Color("#665f4d"), 3.0 * scale)
	draw_circle(pos + Vector2(4, -15) * scale, 1.8 * scale, Color("#b76f5f"))
	if enemy["ranged"] and not boss:
		draw_circle(pos + Vector2(0, 4) * scale, 5.0 * scale, Color("#c07d6a"))
	var bar_w := 46.0 * scale
	draw_rect(Rect2(pos + Vector2(-bar_w * 0.5, -39 * scale), Vector2(bar_w, 5 * scale)), Color("#463e39"))
	draw_rect(Rect2(pos + Vector2(-bar_w * 0.5, -39 * scale), Vector2(bar_w * clampf(float(enemy["hp"]) / float(enemy["max_hp"]), 0.0, 1.0), 5 * scale)), RUST)

func _draw_drop(pos: Vector2) -> void:
	draw_circle(pos, 11.0, Color(0.2, 0.25, 0.21, 0.25))
	draw_colored_polygon(PackedVector2Array([pos + Vector2(0, -9), pos + Vector2(7, 0), pos + Vector2(0, 9), pos + Vector2(-7, 0)]), Color("#b4c3a0"))
	draw_colored_polygon(PackedVector2Array([pos + Vector2(0, -5), pos + Vector2(3, 0), pos + Vector2(0, 5), pos + Vector2(-3, 0)]), Color("#e1d7b9"))

func _draw_rock(pos: Vector2, scale: float, color: Color) -> void:
	draw_colored_polygon(PackedVector2Array([pos + Vector2(-13, 6) * scale, pos + Vector2(-7, -7) * scale, pos + Vector2(5, -10) * scale, pos + Vector2(15, 0) * scale, pos + Vector2(10, 8) * scale]), color)

func _draw_hud(size: Vector2) -> void:
	draw_rect(Rect2(Vector2(0, 0), Vector2(size.x, 82)), Color(0.17, 0.19, 0.17, 0.85))
	_draw_bar(Rect2(25, 24, minf(240, size.x * 0.28), 18), hp / max_hp, RUST)
	_draw_bar(Rect2(25, 52, minf(240, size.x * 0.28), 10), float(xp) / float(xp_goal), JADE)
	draw_string(ThemeDB.fallback_font, Vector2(30, 20), "劉備", HORIZONTAL_ALIGNMENT_LEFT, 100, 16, PAPER)
	draw_string(ThemeDB.fallback_font, Vector2(25, 79), "Lv.%d  ·  %d" % [level, kills], HORIZONTAL_ALIGNMENT_LEFT, 170, 14, PAPER)
	var timer := int(maxf(0.0, 360.0 - elapsed))
	var time_text := "%02d:%02d" % [timer / 60, timer % 60]
	draw_string(ThemeDB.fallback_font, Vector2(size.x * 0.5 - 60, 42), time_text, HORIZONTAL_ALIGNMENT_CENTER, 120, 25, PAPER)
	if boss_spawned and boss_hp > 0.0:
		_draw_bar(Rect2(size.x * 0.3, 91, size.x * 0.4, 13), boss_hp / 1600.0, Color("#b66e5e"))
		draw_string(ThemeDB.fallback_font, Vector2(size.x * 0.5 - 60, 121), "董卓", HORIZONTAL_ALIGNMENT_CENTER, 120, 16, PAPER)
	for i in range(mini(6, remote_players.size())):
		draw_circle(Vector2(size.x - 28 - i * 30, 39), 12, Color("#9cab9e"))
		draw_circle(Vector2(size.x - 28 - i * 30, 39), 5, Color("#e0d1b7"))

func _draw_bar(rect: Rect2, ratio: float, fill: Color) -> void:
	draw_rect(rect, Color("#45483e"), true, 4.0)
	draw_rect(Rect2(rect.position + Vector2(2, 2), Vector2(maxf(0.0, (rect.size.x - 4.0) * clampf(ratio, 0.0, 1.0)), rect.size.y - 4.0)), fill, true, 3.0)

func _draw_button(rect: Rect2, text: String, fill: Color) -> void:
	draw_rect(Rect2(rect.position + Vector2(0, 4), rect.size), Color(0.25, 0.26, 0.23, 0.25), true, 12.0)
	draw_rect(rect, fill, true, 12.0)
	draw_string(ThemeDB.fallback_font, rect.position + Vector2(0, rect.size.y * 0.5 + 7), text, HORIZONTAL_ALIGNMENT_CENTER, rect.size.x, 22, Color("#f1e9d8"))

func _draw_upgrade_overlay(size: Vector2) -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.12, 0.14, 0.13, 0.82))
	draw_string(ThemeDB.fallback_font, Vector2(0, size.y * 0.36), "將星突破", HORIZONTAL_ALIGNMENT_CENTER, size.x, 32, PAPER)
	var card_w := minf(260.0, size.x * 0.28)
	var total := card_w * 3.0 + 36.0
	var left := (size.x - total) * 0.5
	for i in range(3):
		var rect := Rect2(Vector2(left + i * (card_w + 18.0), size.y * 0.51), Vector2(card_w, 150.0))
		draw_rect(rect, Color("#d5ccb8"), true, 14.0)
		draw_circle(rect.position + Vector2(card_w * 0.5, 42), 25.0, Color("#879680") if i != 1 else Color("#bd956d"))
		draw_string(ThemeDB.fallback_font, rect.position + Vector2(0, 91), upgrade_choices[i], HORIZONTAL_ALIGNMENT_CENTER, card_w, 21, INK)
		draw_string(ThemeDB.fallback_font, rect.position + Vector2(0, 123), "點擊選擇", HORIZONTAL_ALIGNMENT_CENTER, card_w, 14, Color("#707064"))

func _draw_end(size: Vector2) -> void:
	_draw_battlefield(size)
	var is_win := mode == "victory"
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.12, 0.14, 0.13, 0.78))
	draw_string(ThemeDB.fallback_font, Vector2(0, size.y * 0.42), "此戰告捷" if is_win else "隊伍潰散", HORIZONTAL_ALIGNMENT_CENTER, size.x, 42, PAPER)
	draw_string(ThemeDB.fallback_font, Vector2(0, size.y * 0.51), "擊破 %d · 到達第 %d 級" % [kills, level], HORIZONTAL_ALIGNMENT_CENTER, size.x, 22, Color("#d4c8b1"))
	draw_button(Rect2(size.x * 0.5 - 130, size.y * 0.62, 260, 58), "返回大廳", MOSS)

func draw_ellipse(center: Vector2, radius: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for i in range(20):
		var angle := TAU * float(i) / 20.0
		points.append(center + Vector2(cos(angle) * radius.x, sin(angle) * radius.y))
	draw_colored_polygon(points, color)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		network.leave_room()
