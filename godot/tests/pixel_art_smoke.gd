extends SceneTree
## CI smoke test: instantiate the actual atlas-based scene and verify
## all pixel sprites, frames and isometric TileMapLayer assets load in Godot 4.3.

func _initialize() -> void:
	call_deferred("_verify")

func _verify() -> void:
	var actor_resource: PackedScene = load("res://scenes/battle/pixel_actor.tscn")
	var world_resource: PackedScene = load("res://scenes/battle/pixel_world.tscn")
	if actor_resource == null or world_resource == null:
		push_error("Pixel scenes missing")
		quit(1)
		return
	var avatar: Node2D = actor_resource.instantiate()
	root.add_child(avatar)
	for kind in ["liubei", "caocao", "sunquan", "lvbu", "grunt", "runner", "archer", "boss"]:
		avatar.call("configure", "smoke", kind)
		var animated: AnimatedSprite2D = avatar.get_node("PixelAnimator")
		if animated.sprite_frames == null or animated.sprite_frames.get_animation_names().size() != 6:
			push_error("Bad animation atlas for " + kind)
			quit(1)
			return
		for animation in animated.sprite_frames.get_animation_names():
			if animated.sprite_frames.get_frame_count(animation) != 4:
				push_error("Missing sprite frames in " + kind + " / " + animation)
				quit(1)
				return
		if kind in ["liubei", "caocao", "sunquan", "lvbu", "grunt", "archer", "boss"]:
			var premium_path := "res://assets/pixel/actors/%s-premium.png" % kind
			var premium: Texture2D = load(premium_path)
			if premium == null or premium.get_size() != Vector2(224, 432):
				push_error("Premium actor atlas missing or wrong size: " + premium_path)
				quit(1)
				return
	avatar.call("set_visual_position", Vector2(120, 80), 0.016, true)
	avatar.call("play_attack")
	avatar.call("play_hit")
	var world: Node2D = world_resource.instantiate()
	root.add_child(world)
	var backdrop: Sprite2D = world.get_node_or_null("BattlefieldBackdrop")
	if backdrop == null or backdrop.texture.get_size() != Vector2(1672, 941):
		push_error("Premium 16:9 battlefield artwork did not load")
		quit(1)
		return
	var ground: TileMapLayer = world.get_node("Ground")
	if ground.tile_set == null or ground.get_used_cells().size() < 300:
		push_error("Isometric tilemap is empty")
		quit(1)
		return
	var depth: Node2D = world.get_node("Depth")
	if not depth.y_sort_enabled or depth.get_child_count() < 20:
		push_error("Depth props / Y-sort missing")
		quit(1)
		return
	var main_scene: PackedScene = load("res://scenes/main.tscn")
	var main_node: Control = main_scene.instantiate()
	root.add_child(main_node)
	await process_frame
	main_node.call("_start_battle")
	var mouse_press := InputEventMouseButton.new()
	mouse_press.button_index = MOUSE_BUTTON_LEFT
	mouse_press.pressed = true
	mouse_press.position = Vector2(400, 300)
	main_node.call("_unhandled_input", mouse_press)
	var mouse_drag := InputEventMouseMotion.new()
	mouse_drag.position = Vector2(440, 330)
	main_node.call("_unhandled_input", mouse_drag)
	if Vector2(main_node.get("move_vector")).length() < 0.1:
		push_error("Mouse drag did not start movement")
		quit(1)
		return
	var mouse_release := InputEventMouseButton.new()
	mouse_release.button_index = MOUSE_BUTTON_LEFT
	mouse_release.pressed = false
	mouse_release.position = mouse_drag.position
	main_node.call("_unhandled_input", mouse_release)
	if Vector2(main_node.get("move_vector")).length() > 0.001:
		push_error("Mouse release left movement stuck")
		quit(1)
		return
	for keycode in [KEY_D, KEY_S]:
		var key_down := InputEventKey.new()
		key_down.keycode = keycode
		key_down.pressed = true
		main_node.call("_unhandled_input", key_down)
	var key_up := InputEventKey.new()
	key_up.keycode = KEY_S
	key_up.pressed = false
	main_node.call("_unhandled_input", key_up)
	if Vector2(main_node.get("keys")) != Vector2.RIGHT:
		push_error("Releasing one movement key incorrectly cleared another held key")
		quit(1)
		return
	main_node.notification(NOTIFICATION_APPLICATION_FOCUS_OUT)
	if Vector2(main_node.get("keys")) != Vector2.ZERO or Vector2(main_node.get("move_vector")) != Vector2.ZERO:
		push_error("Losing focus did not clear movement input")
		quit(1)
		return
	print("PIXEL ART / INPUT SMOKE PASS: premium battlefield, hero/enemy animation atlases, mouse release stop, independent keys and focus-loss reset.")
	world.queue_free()
	avatar.queue_free()
	main_node.queue_free()
	quit(0)
