extends Control

@onready var network: CloudflareRoom = $CloudflareRoom

const UI_FONT: Font = preload("res://fonts/NotoSansTC.ttf")
const INK := Color("#302f2b")
const PAPER := Color("#ddd2bd")
const MOSS := Color("#728174")
const JADE := Color("#718d7a")
const RUST := Color("#ad7767")
const GOLD := Color("#c7a96d")
const NIGHT := Color("#293632")
const REVIVE_SECONDS := 3.0
const DOWNED_TIMEOUT := 25.0

var mode := "lobby"
var status_text := "選擇快速加入，或建立房間"
var room_id := ""
var player_pos := Vector2.ZERO
var move_origin := Vector2.ZERO
var move_vector := Vector2.ZERO
var moving_touch := -1
var keys := Vector2.ZERO
var held_movement_keys: Dictionary = {}
var moving_mouse := false
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
var remote_player_positions: Dictionary = {}
var enemy_visual_targets: Dictionary = {}
var boss_spawned := false
var boss_hp := 0.0
var attack_flash := 0.0
var is_host := false
var room_connected := false
var crossplay_mode := false
var selected_hero_id := "liubei"
var navigating_to_lobby := false
var boss_max_hp := 1600.0
var ability_ready_at := 0.0
var dash_ready_at := 0.0
var sync_clock := 0.0
var _sync_clock := 0.0
var next_enemy_id := 1
var next_pickup_id := 1
var next_enemy_shot_id := 1
var move_speed := 255.0
var player_vitals: Dictionary = {}
var gear_attack_bonus := 0
var gear_defense_bonus := 0
var gear_speed_bonus := 0
var current_map_id := "forest"

func _ready() -> void:
	player_pos = get_viewport_rect().size * 0.5
	network.api_result.connect(_on_api_result)
	network.room_event.connect(_on_room_event)
	network.connection_changed.connect(_on_connection_changed)
	if OS.has_feature("web"):
		var invited_room := str(JavaScriptBridge.eval("new URLSearchParams(window.location.search).get('room') || ''")).to_upper()
		var requested_hero := str(JavaScriptBridge.eval("new URLSearchParams(window.location.search).get('hero') || 'liubei'"))
		if requested_hero in ["liubei", "caocao", "sunquan", "lvbu"]:
			selected_hero_id = requested_hero
		gear_attack_bonus = int(JavaScriptBridge.eval("Number(new URLSearchParams(window.location.search).get('atk') || 0)"))
		gear_defense_bonus = int(JavaScriptBridge.eval("Number(new URLSearchParams(window.location.search).get('def') || 0)"))
		gear_speed_bonus = int(JavaScriptBridge.eval("Number(new URLSearchParams(window.location.search).get('spd') || 0)"))
		var requested_map := str(JavaScriptBridge.eval("new URLSearchParams(window.location.search).get('map') || 'forest'"))
		if requested_map in ["forest", "camp", "city"]:
			current_map_id = requested_map
		if invited_room.length() == 8:
			room_id = invited_room
			var handoff_token := str(JavaScriptBridge.eval("window.sessionStorage.getItem('samkokgo-handoff-' + (new URLSearchParams(window.location.search).get('room') || '').toUpperCase()) || ''"))
			status_text = "正在接續網頁大廳的戰鬥…"
			network.join_room(room_id, selected_hero_id, handoff_token)
		else:
			JavaScriptBridge.eval("window.location.replace('/')")
	queue_redraw()

func _process(delta: float) -> void:
	if mode != "battle":
		queue_redraw()
		return
	if not upgrade_choices.is_empty() and not room_connected:
		queue_redraw()
		return

	var authority := (not room_connected or is_host) and not crossplay_mode
	if room_connected:
		_interpolate_remote_players(delta)
		if not is_host or crossplay_mode:
			_interpolate_enemy_positions(delta)
	elapsed += delta if authority else 0.0
	if room_connected:
		sync_clock += delta
		if sync_clock >= 0.10:
			sync_clock = 0.0
			var world_pos := _screen_to_world(player_pos)
			var network_direction := keys.normalized() if keys.length() > 0.1 else move_vector
			network.send_input(network_direction.x, network_direction.y, world_pos.x, world_pos.y)
	attack_flash = maxf(0.0, attack_flash - delta)
	var direction := move_vector
	if keys.length() > 0.1:
		direction = keys.normalized()
	if not _local_is_down():
		player_pos += direction * move_speed * delta
	var bounds := get_viewport_rect().size
	player_pos.x = clampf(player_pos.x, 50.0, bounds.x - 50.0)
	player_pos.y = clampf(player_pos.y, 125.0, bounds.y - 50.0)

	if authority:
		spawn_clock += delta
		var spawn_rate := maxf(0.32, 1.2 - elapsed * 0.0014)
		if spawn_clock >= spawn_rate and elapsed < 300.0:
			spawn_clock = 0.0
			_spawn_enemy(false)
			if randf() < minf(0.35, elapsed / 240.0):
				_spawn_enemy(true)

		# Put the first boss inside the opening stretch so the run has an
		# immediate objective instead of five minutes of passive farming.
		if elapsed >= 120.0 and not boss_spawned:
			boss_spawned = true
			boss_hp = 1600.0
			_spawn_enemy(false, true)

	if not crossplay_mode:
		attack_clock += delta
	if not crossplay_mode and attack_clock >= attack_interval:
		attack_clock = 0.0
		_auto_attack()

	if authority:
		_update_combat(delta)
		_update_enemies(delta)
		_update_revives(delta)
		_update_drops(delta)
		if room_connected:
			_sync_clock += delta
			if _sync_clock >= 0.25:
				_sync_clock = 0.0
				_publish_game_state()
	elif not crossplay_mode:
		_update_remote_drops()
	_update_projectiles(delta)
	_update_particles(delta)

	if crossplay_mode:
		queue_redraw()
		return
	if room_connected and authority and _all_players_out():
		mode = "defeat"
	elif not room_connected and hp <= 0.0:
		mode = "defeat"
	elif elapsed >= 360.0 and (not boss_spawned or boss_hp <= 0.0):
		mode = "victory"
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if mode == "battle" and OS.has_feature("web"):
		if event is InputEventKey:
			var exit_key := event as InputEventKey
			if exit_key.pressed and exit_key.keycode == KEY_ESCAPE:
				var browser_fullscreen: bool = bool(JavaScriptBridge.eval("!!document.fullscreenElement"))
				if browser_fullscreen:
					JavaScriptBridge.eval("document.exitFullscreen()")
				else:
					_leave_battle_to_web()
				return
		if event is InputEventScreenTouch:
			var exit_touch := event as InputEventScreenTouch
			if exit_touch.pressed and Rect2(12.0, 100.0, 132.0, 48.0).has_point(exit_touch.position):
				_leave_battle_to_web()
				return
		if event is InputEventMouseButton:
			var exit_mouse := event as InputEventMouseButton
			if exit_mouse.pressed and Rect2(12.0, 100.0, 132.0, 48.0).has_point(exit_mouse.position):
				_leave_battle_to_web()
				return
	if mode == "battle" and not upgrade_choices.is_empty():
		if event is InputEventScreenTouch and event.pressed:
			_choose_upgrade(_choice_at(event.position))
		elif event is InputEventMouseButton and event.pressed:
			_choose_upgrade(_choice_at(event.position))
		return

	if event is InputEventKey:
		var key := event as InputEventKey
		if crossplay_mode and mode == "battle" and key.pressed and not key.echo and key.keycode == KEY_SPACE:
			network.send_action({"type": "ability"})
		if crossplay_mode and mode == "battle" and key.pressed and not key.echo and key.keycode == KEY_SHIFT:
			_send_dash()
		if key.keycode in [KEY_W, KEY_A, KEY_S, KEY_D, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT]:
			if key.pressed:
				held_movement_keys[key.keycode] = true
			else:
				held_movement_keys.erase(key.keycode)
			_refresh_keyboard_direction()

	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			if crossplay_mode and mode == "battle" and _dash_button_rect().has_point(touch.position):
				_send_dash()
				return
			if mode == "battle" and OS.has_feature("web") and _fullscreen_button_rect().has_point(touch.position):
				_toggle_web_fullscreen()
				return
			if crossplay_mode and mode == "battle" and touch.position.distance_to(Vector2(get_viewport_rect().size.x - 90.0, get_viewport_rect().size.y - 90.0)) < 48.0:
				if ability_ready_at <= Time.get_unix_time_from_system() * 1000.0:
					network.send_action({"type": "ability"})
				return
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
		if mouse.button_index == MOUSE_BUTTON_LEFT:
			if mouse.pressed:
				if crossplay_mode and mode == "battle" and _dash_button_rect().has_point(mouse.position):
					_send_dash()
					return
				if mode == "battle" and OS.has_feature("web") and _fullscreen_button_rect().has_point(mouse.position):
					_toggle_web_fullscreen()
					return
				if crossplay_mode and mode == "battle" and mouse.position.distance_to(Vector2(get_viewport_rect().size.x - 90.0, get_viewport_rect().size.y - 90.0)) < 48.0:
					if ability_ready_at <= Time.get_unix_time_from_system() * 1000.0:
						network.send_action({"type": "ability"})
					return
				if mode == "lobby":
					_handle_lobby_click(mouse.position)
				elif mode == "battle" and upgrade_choices.is_empty() and mouse.position.y >= 100.0:
					moving_mouse = true
					move_origin = mouse.position
					move_vector = Vector2.ZERO
				elif mode in ["victory", "defeat"]:
					mode = "lobby"
			else:
				_clear_mouse_movement()
	if event is InputEventMouseMotion and moving_mouse and mode == "battle":
		_update_stick((event as InputEventMouseMotion).position)

func _fullscreen_button_rect() -> Rect2:
	var size := get_viewport_rect().size
	return Rect2(Vector2(size.x - 168.0, 112.0), Vector2(154.0, 46.0))

func _dash_button_rect() -> Rect2:
	var size := get_viewport_rect().size
	return Rect2(Vector2(size.x - 250.0, size.y - 139.0), Vector2(92.0, 82.0))

func _send_dash() -> void:
	if not crossplay_mode or dash_ready_at > Time.get_unix_time_from_system() * 1000.0:
		return
	var direction := keys.normalized() if keys.length() > 0.1 else move_vector.normalized()
	network.send_action({"type": "dash", "x": direction.x, "z": direction.y})

func _toggle_web_fullscreen() -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("if (document.fullscreenElement) { document.exitFullscreen(); } else if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen().catch(() => {}); }")
	else:
		var mode_value := DisplayServer.WINDOW_MODE_WINDOWED if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN
		DisplayServer.window_set_mode(mode_value)

func _refresh_keyboard_direction() -> void:
	var up := held_movement_keys.has(KEY_W) or held_movement_keys.has(KEY_UP)
	var down := held_movement_keys.has(KEY_S) or held_movement_keys.has(KEY_DOWN)
	var left := held_movement_keys.has(KEY_A) or held_movement_keys.has(KEY_LEFT)
	var right := held_movement_keys.has(KEY_D) or held_movement_keys.has(KEY_RIGHT)
	keys = Vector2(float(right) - float(left), float(down) - float(up))

func _clear_mouse_movement() -> void:
	moving_mouse = false
	move_vector = Vector2.ZERO

func _clear_movement_input() -> void:
	held_movement_keys.clear()
	keys = Vector2.ZERO
	moving_touch = -1
	_clear_mouse_movement()
	if room_connected and crossplay_mode:
		var world_pos := _screen_to_world(player_pos)
		network.send_input(0.0, 0.0, world_pos.x, world_pos.y)

func _update_stick(pos: Vector2) -> void:
	var offset := pos - move_origin
	move_vector = offset.limit_length(70.0) / 70.0

func _handle_lobby_click(pos: Vector2) -> void:
	var size := get_viewport_rect().size
	var center := Vector2(size.x * 0.5, size.y * 0.5)
	if Rect2(center - Vector2(180, 35), Vector2(360, 68)).has_point(pos):
		network.quick_join()
		status_text = "正在尋找隊友…"
	elif Rect2(center - Vector2(180, -48), Vector2(360, 68)).has_point(pos):
		network.create_room()
		status_text = "正在建立房間…"
	elif Rect2(center - Vector2(130, -148), Vector2(260, 68)).has_point(pos):
		if room_connected and not is_host:
			status_text = "等候房主開始"
		else:
			if room_connected:
				network.send_action({"type": "start"})
			_start_battle(false)

func _start_battle(_send_room_start: bool = false) -> void:
	mode = "battle"
	elapsed = 0.0
	spawn_clock = 0.0
	attack_clock = 0.0
	level = 1
	xp = 0
	xp_goal = 5
	kills = 0
	max_hp = 100.0 + float(gear_defense_bonus * 8)
	hp = max_hp
	damage = 20.0 + float(gear_attack_bonus * 3)
	attack_interval = 0.9
	attack_range = 380.0
	move_speed = (140.0 if crossplay_mode else 255.0) + float(gear_speed_bonus * 12)
	sync_clock = 0.0
	_sync_clock = 0.0
	next_enemy_id = 1
	next_pickup_id = 1
	next_enemy_shot_id = 1
	boss_spawned = false
	boss_hp = 0.0
	enemies.clear()
	shots.clear()
	enemy_shots.clear()
	drops.clear()
	particles.clear()
	player_vitals.clear()
	player_pos = get_viewport_rect().size * 0.5
	_clear_movement_input()
	if room_connected:
		_ensure_vital(network.self_id)
		for teammate in remote_players:
			_ensure_vital(str(teammate.get("id", "")))
	if (not room_connected or is_host) and not crossplay_mode:
		_spawn_enemy(false)
		if room_connected:
			network.send_game_state({"enemies": [], "pickups": [], "elapsed": 0})
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
		"id": "e-%d" % next_enemy_id,
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
	next_enemy_id += 1

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
	if room_connected and not is_host:
		network.send_action({"type": "player-attack", "targetId": enemies[nearest]["id"], "damage": damage})
	attack_flash = 0.15
	_emit_particles(player_pos + direction * 24.0, GOLD, 5, 85.0)

func _update_combat(delta: float) -> void:
	for i in range(enemies.size() - 1, -1, -1):
		var enemy: Dictionary = enemies[i]
		var pos: Vector2 = enemy["pos"]
		var radius := 20.0 * float(enemy["scale"])
		var damage_per_second := 24.0 if enemy["boss"] else 12.0
		if not _local_is_down() and pos.distance_to(player_pos) < radius + 22.0:
			_damage_player(_local_player_id(), damage_per_second * delta)
		if room_connected:
			for teammate in remote_players:
				var teammate_id := str(teammate.get("id", ""))
				if _vital_is_out(teammate_id):
					continue
				var teammate_pos := _teammate_screen_position(teammate)
				if pos.distance_to(teammate_pos) < radius + 22.0:
					_damage_player(teammate_id, damage_per_second * delta)
		if enemy["ranged"] and not enemy["boss"]:
			enemy["shot_clock"] -= delta
			if enemy["shot_clock"] <= 0.0:
				var target := _nearest_active_player(pos)
				if not target.is_empty() and pos.distance_to(target["pos"]) < 520.0:
					enemy["shot_clock"] = randf_range(2.1, 3.0)
					var direction: Vector2 = (target["pos"] - pos).normalized()
					var shot_id := "s-%d" % next_enemy_shot_id
					next_enemy_shot_id += 1
					enemy_shots.append({"pos": pos, "vel": direction * 215.0, "life": 3.5, "targetId": target["id"], "shotId": shot_id, "authoritative": true})
					if room_connected and is_host:
						var from_world := _screen_to_world(pos)
						var to_world := _screen_to_world(target["pos"])
						network.send_action({
							"type": "enemy-shot-fx",
							"from": {"x": from_world.x, "z": from_world.y},
							"to": {"x": to_world.x, "z": to_world.y},
							"targetId": str(target["id"]),
							"shotId": shot_id,
							"damage": 10
						})
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

func _local_player_id() -> String:
	return network.self_id if room_connected else "solo"

func _ensure_vital(player_id: String) -> void:
	if player_id.is_empty() or player_vitals.has(player_id):
		return
	player_vitals[player_id] = {
		"hp": 100.0,
		"maxHp": 100.0,
		"downed": false,
		"eliminated": false,
		"reviveProgress": 0.0,
		"downedAt": 0.0
	}

func _local_is_down() -> bool:
	if not room_connected:
		return false
	_ensure_vital(network.self_id)
	var vital: Dictionary = player_vitals.get(network.self_id, {})
	return bool(vital.get("downed", false)) or bool(vital.get("eliminated", false))

func _vital_is_out(player_id: String) -> bool:
	_ensure_vital(player_id)
	var vital: Dictionary = player_vitals.get(player_id, {})
	return bool(vital.get("downed", false)) or bool(vital.get("eliminated", false))

func _damage_player(player_id: String, amount: float) -> void:
	if not room_connected:
		hp = maxf(0.0, hp - amount * (1.0 - clampf(float(gear_defense_bonus) * 0.025, 0.0, 0.35)))
		return
	_ensure_vital(player_id)
	var vital: Dictionary = player_vitals[player_id]
	if vital["downed"] or vital["eliminated"]:
		return
	vital["hp"] = maxf(0.0, float(vital["hp"]) - amount)
	if float(vital["hp"]) <= 0.0:
		vital["downed"] = true
		vital["reviveProgress"] = 0.0
		vital["downedAt"] = elapsed
	if player_id == network.self_id:
		hp = float(vital["hp"])
	player_vitals[player_id] = vital

func _nearest_active_player(from: Vector2) -> Dictionary:
	var best := 1.0e20
	var result := {}
	if not _local_is_down():
		best = from.distance_to(player_pos)
		result = {"id": _local_player_id(), "pos": player_pos}
	for teammate in remote_players:
		var player_id := str(teammate.get("id", ""))
		if _vital_is_out(player_id):
			continue
		var pos := _teammate_screen_position(teammate)
		var distance := from.distance_to(pos)
		if distance < best:
			best = distance
			result = {"id": player_id, "pos": pos}
	return result

func _player_screen_position(player_id: String) -> Vector2:
	if player_id == _local_player_id():
		return player_pos
	for teammate in remote_players:
		if str(teammate.get("id", "")) == player_id:
			return _teammate_screen_position(teammate)
	return Vector2(-10000, -10000)

func _update_revives(delta: float) -> void:
	for player_id_variant in player_vitals.keys():
		var player_id := str(player_id_variant)
		var vital: Dictionary = player_vitals[player_id]
		if not vital["downed"] or vital["eliminated"]:
			continue
		if elapsed - float(vital["downedAt"]) >= DOWNED_TIMEOUT:
			vital["downed"] = false
			vital["eliminated"] = true
			player_vitals[player_id] = vital
			continue
		var downed_pos := _player_screen_position(player_id)
		var being_revived := false
		if player_id != network.self_id and not _local_is_down() and player_pos.distance_to(downed_pos) < 54.0:
			being_revived = true
		if room_connected:
			for teammate in remote_players:
				var rescuer_id := str(teammate.get("id", ""))
				if rescuer_id == player_id or _vital_is_out(rescuer_id):
					continue
				var rescuer_pos := _teammate_screen_position(teammate)
				if rescuer_pos.distance_to(downed_pos) < 54.0:
					being_revived = true
					break
		if being_revived:
			vital["reviveProgress"] = minf(REVIVE_SECONDS, float(vital["reviveProgress"]) + delta)
		else:
			vital["reviveProgress"] = maxf(0.0, float(vital["reviveProgress"]) - delta * 1.5)
		if float(vital["reviveProgress"]) >= REVIVE_SECONDS:
			vital["downed"] = false
			vital["hp"] = float(vital["maxHp"]) * 0.4
			vital["reviveProgress"] = 0.0
			if player_id == network.self_id:
				hp = float(vital["hp"])
		player_vitals[player_id] = vital

func _all_players_out() -> bool:
	if player_vitals.is_empty():
		return false
	for player_id in player_vitals:
		if not _vital_is_out(str(player_id)):
			return false
	return true

func _receive_enemy_shot(event: Dictionary) -> void:
	var from_value: Variant = event.get("from", {})
	var to_value: Variant = event.get("to", {})
	if not from_value is Dictionary or not to_value is Dictionary:
		return
	var shot_id := str(event.get("shotId", ""))
	if shot_id.is_empty():
		return
	for existing in enemy_shots:
		if str(existing.get("shotId", "")) == shot_id:
			return
	var from_pos := _world_to_screen(Vector2(float(from_value.get("x", 0.0)), float(from_value.get("z", 0.0))))
	var to_pos := _world_to_screen(Vector2(float(to_value.get("x", 0.0)), float(to_value.get("z", 0.0))))
	var travel := to_pos - from_pos
	if travel.length() < 1.0:
		return
	var duration := clampf(travel.length() / 215.0, 0.15, 3.5)
	enemy_shots.append({
		"pos": from_pos,
		"vel": travel / duration,
		"life": duration,
		"targetId": str(event.get("targetId", "")),
		"shotId": shot_id,
		"damage": float(event.get("damage", 10.0)),
		"authoritative": false
	})

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
				if not room_connected or is_host:
					enemy["hp"] = float(enemy["hp"]) - float(shot["damage"])
				_emit_particles(Vector2(shot["pos"]), GOLD, 8, 140.0)
				if (not room_connected or is_host) and float(enemy["hp"]) <= 0.0:
					if enemy["boss"]:
						boss_hp = 0.0
						for n in range(12):
							drops.append({"pos": Vector2(enemy["pos"]) + Vector2(randf_range(-35.0, 35.0), randf_range(-35.0, 35.0)), "value": 1})
					else:
						drops.append({"pos": enemy["pos"], "value": 1})
					kills += 1
					_emit_particles(Vector2(enemy["pos"]), RUST, 14, 190.0)
					enemies.remove_at(j)
				elif not room_connected or is_host:
					enemies[j] = enemy
				hit = true
				break
		if hit or float(shot["life"]) <= 0.0:
			shots.remove_at(i)
		else:
			shots[i] = shot

	for i in range(enemy_shots.size() - 1, -1, -1):
		var shot: Dictionary = enemy_shots[i]
		shot["delay"] = maxf(0.0, float(shot.get("delay", 0.0)) - delta)
		if float(shot["delay"]) > 0.0:
			enemy_shots[i] = shot
			continue
		shot["pos"] = Vector2(shot["pos"]) + Vector2(shot["vel"]) * delta
		shot["life"] = float(shot["life"]) - delta
		if bool(shot.get("server_managed", false)):
			if float(shot["life"]) <= 0.0:
				enemy_shots.remove_at(i)
			else:
				enemy_shots[i] = shot
			continue
		var target_id := str(shot.get("targetId", _local_player_id()))
		var target_pos := _player_screen_position(target_id)
		if target_pos.distance_to(Vector2(shot["pos"])) < 21.0:
			if bool(shot.get("authoritative", false)):
				_damage_player(target_id, float(shot.get("damage", 10.0)))
			_emit_particles(target_pos, RUST, 12, 130.0)
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
			drops.remove_at(i)
			_add_team_xp(int(drop["value"]))
			_emit_particles(pos, JADE, 7, 100.0)
			if not upgrade_choices.is_empty():
				return
		else:
			var direction := player_pos - pos
			if direction.length() < 145.0:
				pos += direction.normalized() * 170.0 * delta
			drop["pos"] = pos
			drops[i] = drop

func _add_team_xp(amount: int) -> void:
	xp += amount
	while xp >= xp_goal:
		xp -= xp_goal
		level += 1
		xp_goal = 5 + level * 3
	_open_upgrade()

func _collect_shared_pickup(pickup_id: String) -> void:
	for i in range(drops.size()):
		if str(drops[i].get("id", "")) == pickup_id:
			var pos: Vector2 = drops[i]["pos"]
			drops.remove_at(i)
			_add_team_xp(1)
			_emit_particles(pos, JADE, 10, 120.0)
			return

func _update_remote_drops() -> void:
	for i in range(drops.size() - 1, -1, -1):
		var drop: Dictionary = drops[i]
		if player_pos.distance_to(Vector2(drop["pos"])) < 27.0:
			var pickup_id := str(drop.get("id", ""))
			if not pickup_id.is_empty():
				network.send_action({"type": "player-pickup", "pickupId": pickup_id})
			_emit_particles(drop["pos"], JADE, 8, 100.0)
			drops.remove_at(i)

func _open_upgrade() -> void:
	var all := ["長槍淬鋒", "輕身步法", "青囊護心", "連弩機括"]
	all.shuffle()
	upgrade_choices = [all[0], all[1], all[2]]
	if level % 4 == 0:
		upgrade_choices[0] = "神兵覺醒"

func _choose_upgrade(index: int) -> void:
	if index < 0 or index >= upgrade_choices.size():
		return
	var chosen := upgrade_choices[index]
	upgrade_choices.clear()
	if crossplay_mode and room_connected:
		network.send_action({"type": "level-choice", "upgradeId": _upgrade_id_for_label(chosen)})
		return
	_apply_upgrade_label(chosen)
	if room_connected and is_host:
		network.send_action({"type": "level-choice", "upgradeId": _upgrade_id_for_label(chosen)})

func _apply_upgrade_label(label: String) -> void:
	var previous_max_hp := max_hp
	match label:
		"長槍淬鋒":
			damage *= 1.28
		"輕身步法":
			move_speed *= 1.14
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
	if room_connected:
		var max_hp_increase := max_hp - previous_max_hp
		for player_id_variant in player_vitals.keys():
			var player_id := str(player_id_variant)
			var vital: Dictionary = player_vitals[player_id]
			vital["maxHp"] = float(vital.get("maxHp", previous_max_hp)) + max_hp_increase
			player_vitals[player_id] = vital
		var own_vital: Dictionary = player_vitals.get(network.self_id, {})
		if not own_vital.is_empty():
			own_vital["hp"] = hp
			own_vital["maxHp"] = max_hp
			player_vitals[network.self_id] = own_vital

func _upgrade_id_for_label(label: String) -> String:
	match label:
		"長槍淬鋒": return "power"
		"連弩機括": return "tempo"
		"神兵覺醒": return "reach"
		_: return "speed"

func _apply_upgrade_id(upgrade_id: String) -> void:
	match upgrade_id:
		"power": _apply_upgrade_label("長槍淬鋒")
		"tempo": _apply_upgrade_label("連弩機括")
		"reach": _apply_upgrade_label("神兵覺醒")
		"speed": _apply_upgrade_label("輕身步法")

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
	var kind := str(event.get("type", ""))
	if kind == "welcome":
		var welcome_snapshot: Dictionary = event.get("snapshot", {})
		for p in welcome_snapshot.get("players", []):
			if p is Dictionary and str(p.get("id", "")) == network.self_id:
				selected_hero_id = str(p.get("heroId", selected_hero_id))
		_update_room_players(welcome_snapshot.get("players", []))
		var room_data: Dictionary = welcome_snapshot.get("room", {})
		crossplay_mode = str(room_data.get("ruleset", "")) == "crossplay-v1"
		current_map_id = str(room_data.get("mapId", current_map_id))
		var welcome_state: Variant = event.get("gameState")
		if room_data.get("status", "waiting") == "playing":
			_start_battle(false)
			if welcome_state is Dictionary and not welcome_state.is_empty():
				_apply_game_state(welcome_state)
	elif kind == "presence":
		var snapshot: Dictionary = event.get("snapshot", {})
		_update_room_players(snapshot.get("players", []))
	elif kind == "players":
		_update_room_players(event.get("players", []))
	elif kind == "start":
		if mode == "lobby":
			_start_battle(false)
		status_text = "隊伍已開始"
	elif kind == "game-state":
		if room_connected and (not is_host or crossplay_mode):
			_apply_game_state(event.get("state", {}))
	elif kind == "battle-result":
		_finish_battle_to_web(str(event.get("result", "defeat")))
	elif kind == "player-attack":
		if is_host and not crossplay_mode:
			_apply_remote_attack(event)
	elif kind == "player-pickup":
		if is_host and not crossplay_mode:
			_collect_shared_pickup(str(event.get("pickupId", "")))
	elif kind == "enemy-shot-fx":
		if not is_host:
			_receive_enemy_shot(event)
	elif kind == "level-choice":
		if not is_host and not crossplay_mode:
			_apply_upgrade_id(str(event.get("upgradeId", "")))
	queue_redraw()

func _update_room_players(players: Array) -> void:
	remote_players.clear()
	is_host = false
	var connected_ids: Array[String] = [network.self_id]
	for value in players:
		if not value is Dictionary:
			continue
		var player: Dictionary = value
		var player_id := str(player.get("id", ""))
		if player_id == network.self_id:
			is_host = bool(player.get("host", false))
			if crossplay_mode and mode == "battle":
				var authoritative_pos := _world_to_screen(Vector2(float(player.get("x", 0.0)), float(player.get("z", 0.0))))
				if player_pos.distance_to(authoritative_pos) > 35.0:
					player_pos = player_pos.lerp(authoritative_pos, 0.35)
		else:
			remote_players.append(player)
			connected_ids.append(player_id)
			var target := Vector2(float(player.get("x", 0.0)), float(player.get("z", 0.0)))
			if not remote_player_positions.has(player_id):
				remote_player_positions[player_id] = target
	for player_id in remote_player_positions.keys():
		if not connected_ids.has(str(player_id)):
			remote_player_positions.erase(player_id)
	if mode == "battle":
		for player_id in connected_ids:
			_ensure_vital(player_id)
	status_text = "房間已連線 · %d 位隊友" % remote_players.size()

func _interpolate_remote_players(delta: float) -> void:
	var blend := 1.0 - exp(-delta * 18.0)
	for player in remote_players:
		var player_id := str(player.get("id", ""))
		var target := Vector2(float(player.get("x", 0.0)), float(player.get("z", 0.0)))
		var current: Vector2 = remote_player_positions.get(player_id, target)
		remote_player_positions[player_id] = current.lerp(target, blend)

func _teammate_screen_position(player: Dictionary) -> Vector2:
	var player_id := str(player.get("id", ""))
	var raw := Vector2(float(player.get("x", 0.0)), float(player.get("z", 0.0)))
	var smooth: Vector2 = remote_player_positions.get(player_id, raw)
	return _world_to_screen(smooth)

func _interpolate_enemy_positions(delta: float) -> void:
	var blend := 1.0 - exp(-delta * 12.0)
	for i in range(enemies.size()):
		var enemy: Dictionary = enemies[i]
		var enemy_id := str(enemy.get("id", ""))
		var target: Vector2 = enemy_visual_targets.get(enemy_id, enemy.get("pos", Vector2.ZERO))
		enemy["pos"] = Vector2(enemy.get("pos", Vector2.ZERO)).lerp(target, blend)
		enemies[i] = enemy

func _apply_remote_attack(event: Dictionary) -> void:
	var target_id := str(event.get("targetId", ""))
	for i in range(enemies.size()):
		if str(enemies[i].get("id", "")) == target_id:
			var enemy: Dictionary = enemies[i]
			enemy["hp"] = float(enemy["hp"]) - clampf(float(event.get("damage", 1.0)), 1.0, 60.0)
			_emit_particles(enemy["pos"], GOLD, 7, 110.0)
			if float(enemy["hp"]) <= 0.0:
				boss_hp = 0.0 if enemy["boss"] else boss_hp
				drops.append({"pos": enemy["pos"], "value": 1})
				enemies.remove_at(i)
				kills += 1
			else:
				enemies[i] = enemy
			break

func _publish_game_state() -> void:
	var state_enemies: Array[Dictionary] = []
	var state_pickups: Array[Dictionary] = []
	for enemy in enemies:
		var world := _screen_to_world(enemy["pos"])
		state_enemies.append({
			"id": str(enemy.get("id", "")),
			"x": world.x,
			"z": world.y,
			"hp": 99 if enemy["boss"] else int(enemy["hp"]),
			"elite": enemy["boss"],
			"kind": "boss" if enemy["boss"] else ("archer" if enemy["ranged"] else "grunt")
		})
	for i in range(mini(drops.size(), 20)):
		var drop: Dictionary = drops[i]
		if not drop.has("id"):
			drop["id"] = "p-%d" % next_pickup_id
			next_pickup_id += 1
			drops[i] = drop
		var world := _screen_to_world(drop["pos"])
		state_pickups.append({"id": str(drop["id"]), "x": world.x, "z": world.y, "type": str(drop.get("type", "energy"))})
	var boss_state: Variant = null
	if boss_spawned and boss_hp > 0.0:
		boss_state = {"hp": boss_hp, "maxHp": 1600, "bossIndex": 0}
	network.send_game_state({
		"enemies": state_enemies,
		"pickups": state_pickups,
		"boss": boss_state,
		"elapsed": elapsed,
		"xp": xp,
		"level": level,
		"energy": 0,
		"playerVitals": player_vitals
	})

func _apply_game_state(state: Dictionary) -> void:
	if state.is_empty():
		return
	elapsed = float(state.get("elapsed", elapsed))
	boss_spawned = state.get("boss") is Dictionary and not state.get("boss").is_empty()
	if boss_spawned:
		boss_hp = float(state["boss"].get("hp", 0.0))
		boss_max_hp = float(state["boss"].get("maxHp", 1600.0))
	var previous_enemy_positions: Dictionary = {}
	var previous_enemy_hp: Dictionary = {}
	for old_enemy in enemies:
		previous_enemy_hp[str(old_enemy.get("id", ""))] = float(old_enemy.get("hp", 0.0))
		previous_enemy_positions[str(old_enemy.get("id", ""))] = old_enemy.get("pos", Vector2.ZERO)
	enemies.clear()
	var next_enemy_targets: Dictionary = {}
	for value in state.get("enemies", []):
		if not value is Dictionary:
			continue
		var enemy: Dictionary = value
		var enemy_id := str(enemy.get("id", ""))
		var is_boss: bool = str(enemy.get("kind", "")) == "boss"
		var target_pos := _world_to_screen(Vector2(float(enemy.get("x", 0.0)), float(enemy.get("z", 0.0))))
		var render_pos: Vector2 = previous_enemy_positions.get(enemy_id, target_pos)
		next_enemy_targets[enemy_id] = target_pos
		var hp_value := boss_hp if is_boss else float(enemy.get("hp", 42.0))
		if crossplay_mode and previous_enemy_hp.has(enemy_id) and hp_value < float(previous_enemy_hp[enemy_id]):
			_emit_particles(target_pos, GOLD, 5, 70.0)
		enemies.append({
			"id": enemy_id,
			"pos": render_pos,
			"hp": hp_value,
			"max_hp": boss_max_hp if is_boss else float(enemy.get("maxHp", 42.0)),
			"speed": 0.0,
			"ranged": str(enemy.get("kind", "")) == "archer",
			"kind": str(enemy.get("kind", "grunt")),
			"elite": bool(enemy.get("elite", false)),
			"boss": is_boss,
			"scale": 2.15 if is_boss else 1.0,
			"shot_clock": 9.0,
			"phase": 0.0
		})
	enemy_visual_targets = next_enemy_targets
	drops.clear()
	for value in state.get("pickups", []):
		if not value is Dictionary:
			continue
		drops.append({
			"id": str(value.get("id", "")),
			"pos": _world_to_screen(Vector2(float(value.get("x", 0.0)), float(value.get("z", 0.0)))),
			"value": 2 if str(value.get("type", "energy")) == "treasure" else 1,
			"type": str(value.get("type", "energy"))
		})
	enemy_shots.clear()
	for value in state.get("projectiles", []):
		if not value is Dictionary:
			continue
		var world_pos := Vector2(float(value.get("x", 0.0)), float(value.get("z", 0.0)))
		var world_velocity := Vector2(float(value.get("vx", 0.0)), float(value.get("vz", 0.0)))
		enemy_shots.append({
			"shotId": str(value.get("id", "")),
			"pos": _world_to_screen(world_pos),
			"vel": Vector2(world_velocity.x * 13.33, world_velocity.y * 13.33),
			"life": float(value.get("life", 0.0)),
			"delay": float(value.get("delay", 0.0)),
			"targetId": "",
			"authoritative": false,
			"server_managed": true,
			"pattern": str(value.get("pattern", "arrow"))
		})
	xp = int(state.get("xp", xp))
	level = int(state.get("level", level))
	if crossplay_mode:
		var progress_by_player: Dictionary = state.get("playerProgress", {})
		var mine: Dictionary = progress_by_player.get(network.self_id, {})
		if not mine.is_empty():
			xp = int(mine.get("xp", xp))
			level = int(mine.get("level", level))
			var pending: Array = mine.get("pendingChoices", [])
			upgrade_choices.clear()
			if not pending.is_empty():
				for upgrade_id in pending[0]:
					match str(upgrade_id):
						"power": upgrade_choices.append("長槍淬鋒")
						"tempo": upgrade_choices.append("連弩機括")
						"reach": upgrade_choices.append("神兵覺醒")
						"speed": upgrade_choices.append("輕身步法")
	xp_goal = 5 + (level - 1) * 2 if crossplay_mode else 5 + level * 3
	if crossplay_mode:
		var cooldowns: Dictionary = state.get("cooldowns", {})
		ability_ready_at = float(cooldowns.get(network.self_id, 0.0))
		var dash_cooldowns: Dictionary = state.get("dashCooldowns", {})
		dash_ready_at = float(dash_cooldowns.get(network.self_id, 0.0))
	if crossplay_mode and state.get("result") is String:
		_finish_battle_to_web(str(state.get("result")))
	var state_vitals: Variant = state.get("playerVitals", {})
	if state_vitals is Dictionary:
		player_vitals = state_vitals
		var own_vital: Dictionary = player_vitals.get(network.self_id, {})
		if not own_vital.is_empty():
			hp = float(own_vital.get("hp", hp))
			max_hp = float(own_vital.get("maxHp", max_hp))
	
func _screen_to_world(pos: Vector2) -> Vector2:
	var size := get_viewport_rect().size
	return Vector2(pos.x / maxf(size.x, 1.0) * 96.0 - 48.0, pos.y / maxf(size.y, 1.0) * 54.0 - 27.0)

func _world_to_screen(pos: Vector2) -> Vector2:
	var size := get_viewport_rect().size
	return Vector2((pos.x + 48.0) / 96.0 * size.x, (pos.y + 27.0) / 54.0 * size.y)

func _on_connection_changed(state: String) -> void:
	if state == "connecting":
		status_text = "正在連線到房間…"
	elif state == "connected":
		room_connected = true
		status_text = "房間已連線 · 可開始戰鬥"
	elif state.begins_with("error:"):
		room_connected = false
		status_text = "連線失敗 · 可先單人試玩"
	queue_redraw()

func _finish_battle_to_web(result: String) -> void:
	if navigating_to_lobby:
		return
	navigating_to_lobby = true
	mode = "victory" if result == "victory" else "defeat"
	if OS.has_feature("web"):
		network.leave_room()
		var safe_result := "victory" if result == "victory" else "defeat"
		var return_path := "/?result=%s&runId=%s&map=%s" % [safe_result, room_id.uri_encode(), current_map_id.uri_encode()]
		JavaScriptBridge.eval("window.location.replace('" + return_path + "')")

func _leave_battle_to_web() -> void:
	if navigating_to_lobby:
		return
	navigating_to_lobby = true
	network.leave_room()
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.location.replace('/?result=exit&runId=" + room_id.uri_encode() + "')")
	else:
		mode = "lobby"

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
	draw_string(UI_FONT, center + Vector2(-88, -160), "三國", HORIZONTAL_ALIGNMENT_CENTER, 176.0, 48, INK)
	draw_string(UI_FONT, center + Vector2(-150, -112), "亂世同征", HORIZONTAL_ALIGNMENT_CENTER, 300.0, 23, Color("#565b50"))
	_draw_button(Rect2(center + Vector2(-180, -70), Vector2(360, 58)), "快速加入", MOSS)
	_draw_button(Rect2(center + Vector2(-180, 2), Vector2(360, 58)), "建立房間", Color("#8b7967"))
	_draw_button(Rect2(center + Vector2(-130, 82), Vector2(260, 54)), "開始試玩", Color("#9a7867"))
	draw_string(UI_FONT, center + Vector2(-300, 175), status_text, HORIZONTAL_ALIGNMENT_CENTER, 600.0, 17, INK)
	if not room_id.is_empty():
		draw_string(UI_FONT, center + Vector2(-100, 207), "房間 " + room_id, HORIZONTAL_ALIGNMENT_CENTER, 200.0, 15, INK)
	draw_string(UI_FONT, Vector2(18, size.y - 20), "WASD / 方向鍵 移動 · 觸控任意位置拖曳", HORIZONTAL_ALIGNMENT_LEFT, size.x - 36, 14, Color("#565b50"))

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
		var boss_bullet := str(shot.get("pattern", "")) == "boss-fan"
		if float(shot.get("delay", 0.0)) > 0.0:
			draw_arc(shot["pos"], 18.0 if boss_bullet else 13.0, 0.0, TAU, 12, Color("#f2c46e", 0.58), 2.0, true)
		else:
			draw_circle(shot["pos"], 11.0 if boss_bullet else 8.0, Color("#a9574d") if boss_bullet else Color("#ae766b"))
			draw_circle(shot["pos"], 5.0, Color("#ffe08d") if boss_bullet else Color("#e6aa8d"))
	for particle in particles:
		draw_circle(particle["pos"], 2.3, particle["color"])
	for player in remote_players:
		var player_id := str(player.get("id", ""))
		var remote_pos := _teammate_screen_position(player)
		var tint := Color.from_hsv(float(player.get("colorIndex", 0)) / 6.0, 0.28, 0.78)
		var vital: Dictionary = player_vitals.get(player_id, {})
		var out := bool(vital.get("downed", false)) or bool(vital.get("eliminated", false))
		_draw_hero(remote_pos, 0.82, tint.darkened(0.45) if out else tint, Color("#494c4a"), Color("#bd9e68"), 0.0)
		_draw_player_vital(remote_pos, vital, 0.82)
	var own_vital: Dictionary = player_vitals.get(network.self_id, {})
	var own_out := bool(own_vital.get("downed", false)) or bool(own_vital.get("eliminated", false))
	var hero_colors := {"liubei": Color("#708b78"), "caocao": Color("#7b778c"), "sunquan": Color("#7896a1"), "lvbu": Color("#b47665")}
	var hero_color: Color = hero_colors.get(selected_hero_id, Color("#708b78"))
	_draw_hero(player_pos, 1.0 + minf(0.16, level * 0.008), hero_color.darkened(0.45) if own_out else hero_color, Color("#353b37"), Color("#c4a766"), 0.0)
	if room_connected:
		_draw_player_vital(player_pos, own_vital, 1.0)
	_draw_hud(size)
	if OS.has_feature("web") and crossplay_mode:
		draw_rect(Rect2(Vector2(15, 94), Vector2(100, 44)), Color("#293b33", 0.94))
		draw_rect(Rect2(Vector2(15, 94), Vector2(100, 44)), Color("#c6a96d"), false, 2.0)
		draw_string(UI_FONT, Vector2(18, 122), "返回大廳", HORIZONTAL_ALIGNMENT_CENTER, 94, 17, PAPER)
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
	var hero_labels := {"liubei": "劉備", "caocao": "曹操", "sunquan": "孫權", "lvbu": "呂布"}
	draw_string(UI_FONT, Vector2(145, 20), str(hero_labels.get(selected_hero_id, "劉備")), HORIZONTAL_ALIGNMENT_LEFT, 100, 16, PAPER)
	draw_string(UI_FONT, Vector2(25, 79), "Lv.%d  ·  %d" % [level, kills], HORIZONTAL_ALIGNMENT_LEFT, 170, 14, PAPER)
	var timer := int(maxf(0.0, 360.0 - elapsed))
	var time_text := "%02d:%02d" % [timer / 60, timer % 60]
	draw_string(UI_FONT, Vector2(size.x * 0.5 - 60, 42), time_text, HORIZONTAL_ALIGNMENT_CENTER, 120, 25, PAPER)
	if crossplay_mode:
		var ability_position := Vector2(size.x - 90.0, size.y - 90.0)
		var available := ability_ready_at <= Time.get_unix_time_from_system() * 1000.0
		draw_circle(ability_position, 39.0, Color("#b39761") if available else Color("#5e6661"))
		draw_circle(ability_position, 35.0, Color("#293b33"))
		draw_string(UI_FONT, ability_position + Vector2(-35.0, 8.0), "絕技" if available else "冷卻", HORIZONTAL_ALIGNMENT_CENTER, 70.0, 18, PAPER)
	if boss_spawned and boss_hp > 0.0:
		_draw_bar(Rect2(size.x * 0.3, 91, size.x * 0.4, 13), boss_hp / maxf(1.0, boss_max_hp), Color("#b66e5e"))
		draw_string(UI_FONT, Vector2(size.x * 0.5 - 60, 121), "董卓", HORIZONTAL_ALIGNMENT_CENTER, 120, 16, PAPER)
	for i in range(mini(6, remote_players.size())):
		var player_id := str(remote_players[i].get("id", ""))
		var vital: Dictionary = player_vitals.get(player_id, {})
		var marker := Vector2(size.x - 28 - i * 30, 39)
		draw_circle(marker, 12, Color("#a47769") if _vital_is_out(player_id) else Color("#9cab9e"))
		draw_circle(marker, 5, Color("#e0d1b7"))
		if not vital.is_empty():
			_draw_bar(Rect2(marker + Vector2(-11, 16), Vector2(22, 4)), float(vital.get("hp", 0.0)) / maxf(1.0, float(vital.get("maxHp", 100.0))), RUST)

func _draw_player_vital(pos: Vector2, vital: Dictionary, scale: float) -> void:
	if vital.is_empty():
		return
	var out := bool(vital.get("downed", false)) or bool(vital.get("eliminated", false))
	var bar_pos := pos + Vector2(-21.0 * scale, -47.0 * scale)
	_draw_bar(Rect2(bar_pos, Vector2(42.0 * scale, 5.0 * scale)), float(vital.get("hp", 0.0)) / maxf(1.0, float(vital.get("maxHp", 100.0))), RUST)
	if out:
		draw_arc(pos, 30.0 * scale, 0, TAU * clampf(float(vital.get("reviveProgress", 0.0)) / REVIVE_SECONDS, 0.0, 1.0), 32, GOLD, 4.0, true)

func _draw_bar(rect: Rect2, ratio: float, fill: Color) -> void:
	draw_rect(rect, Color("#45483e"), true, 4.0)
	draw_rect(Rect2(rect.position + Vector2(2, 2), Vector2(maxf(0.0, (rect.size.x - 4.0) * clampf(ratio, 0.0, 1.0)), rect.size.y - 4.0)), fill, true, 3.0)

func _draw_button(rect: Rect2, text: String, fill: Color) -> void:
	draw_rect(Rect2(rect.position + Vector2(0, 4), rect.size), Color(0.25, 0.26, 0.23, 0.25), true, 12.0)
	draw_rect(rect, fill, true, 12.0)
	draw_string(UI_FONT, rect.position + Vector2(0, rect.size.y * 0.5 + 7), text, HORIZONTAL_ALIGNMENT_CENTER, rect.size.x, 22, Color("#f1e9d8"))

func _draw_upgrade_overlay(size: Vector2) -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.12, 0.14, 0.13, 0.82))
	draw_string(UI_FONT, Vector2(0, size.y * 0.36), "將星突破", HORIZONTAL_ALIGNMENT_CENTER, size.x, 32, PAPER)
	var card_w := minf(260.0, size.x * 0.28)
	var total := card_w * 3.0 + 36.0
	var left := (size.x - total) * 0.5
	for i in range(3):
		var rect := Rect2(Vector2(left + i * (card_w + 18.0), size.y * 0.51), Vector2(card_w, 150.0))
		draw_rect(rect, Color("#d5ccb8"), true, 14.0)
		draw_circle(rect.position + Vector2(card_w * 0.5, 42), 25.0, Color("#879680") if i != 1 else Color("#bd956d"))
		draw_string(UI_FONT, rect.position + Vector2(0, 91), upgrade_choices[i], HORIZONTAL_ALIGNMENT_CENTER, card_w, 21, INK)
		draw_string(UI_FONT, rect.position + Vector2(0, 123), "點擊選擇", HORIZONTAL_ALIGNMENT_CENTER, card_w, 14, Color("#707064"))

func _draw_end(size: Vector2) -> void:
	_draw_battlefield(size)
	var is_win := mode == "victory"
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.12, 0.14, 0.13, 0.78))
	draw_string(UI_FONT, Vector2(0, size.y * 0.42), "此戰告捷" if is_win else "隊伍潰散", HORIZONTAL_ALIGNMENT_CENTER, size.x, 42, PAPER)
	draw_string(UI_FONT, Vector2(0, size.y * 0.51), "擊破 %d · 到達第 %d 級" % [kills, level], HORIZONTAL_ALIGNMENT_CENTER, size.x, 22, Color("#d4c8b1"))
	_draw_button(Rect2(size.x * 0.5 - 130, size.y * 0.62, 260, 58), "返回大廳", MOSS)

func draw_ellipse(center: Vector2, radius: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for i in range(20):
		var angle := TAU * float(i) / 20.0
		points.append(center + Vector2(cos(angle) * radius.x, sin(angle) * radius.y))
	draw_colored_polygon(points, color)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		network.leave_room()
	if what in [NOTIFICATION_APPLICATION_FOCUS_OUT, NOTIFICATION_WM_WINDOW_FOCUS_OUT]:
		_clear_movement_input()
